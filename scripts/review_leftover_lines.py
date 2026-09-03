#!/usr/bin/env python3
"""Screenshot review for the leftover stats.lines content.

After the structured passes, stats.lines holds only prose, spell metadata,
mount-description headers and OCR noise fragments. This script gives a
human the full tooltip screenshot plus an editable list of those lines so
they can correct, delete or keep each one by hand:

  python scripts/review_leftover_lines.py --review [--open]
      writes research/leftover_lines_review.html — one card per item with a
      zoomed, contrast-boosted crop of the whole tooltip and a textarea
      containing the current leftover lines (one per row). Edit the text,
      press "Download fixes JSON" and save it as
      research/leftover_line_fixes.json.

  python scripts/review_leftover_lines.py --apply
      reads the review file; for each edited entry it replaces the item's
      stats.lines with the fixed lines (an empty textarea deletes them),
      updates the OCR cache, then re-runs the structure pass so anything
      that became clean moves into props. Entries left unchanged are kept.

Run:  python scripts/review_leftover_lines.py --review --open
      # fix the lines in the browser, download the JSON
      python scripts/review_leftover_lines.py --apply
"""
import argparse
import base64
import io
import json
import os
import re
import subprocess
import sys
import time

from PIL import Image

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RESEARCH = os.path.join(BASE, "research")
SRC_DATA = os.path.join(RESEARCH, "armory_data.json")
APP_DATA = os.path.join(BASE, "armory", "src", "data", "armory_data.json")
CACHE = os.path.join(RESEARCH, "tooltips.json")
IMAGES_DIR = os.path.join(RESEARCH, "images")
REVIEW_FILE = os.path.join(RESEARCH, "leftover_line_fixes.json")
OUT = os.path.join(RESEARCH, "leftover_lines_review.html")

sys.path.insert(0, BASE)
from scripts.extract_tooltips import _ensure_tesseract, preprocess  # noqa: E402
from scripts.structure_stat_lines import iter_items  # noqa: E402


def items_with_lines(data):
    """(id, name, location, lines, image) for every item still carrying lines."""
    out = []
    for section, loc, cat, set_, item in iter_items(data, with_path=True):
        stats = item.get("stats")
        if not stats or not stats.get("lines"):
            continue
        out.append((item["id"], item["name"], loc.get("name"),
                    list(stats["lines"]), item.get("image")))
    return out


def crop_tooltip(image_path, pyt):
    """Whole tooltip, zoomed 3x with contrast boost; base64 PNG or None."""
    try:
        orig = Image.open(image_path)
        band = orig.convert("L")
        px = sorted(band.getdata())
        lo = px[min(len(px) - 1, len(px) // 20)]
        hi = px[min(len(px) - 1, len(px) * 19 // 20)]
        if hi > lo:
            band = band.point(lambda v: min(255, max(0, int((v - lo) * 255 / (hi - lo)))))
        band = band.resize((band.width * 3, band.height * 3), Image.LANCZOS)
        buf = io.BytesIO()
        band.save(buf, format="PNG")
        return base64.b64encode(buf.getvalue()).decode("ascii")
    except Exception:  # noqa: BLE001 - keep the page build alive
        return None


PAGE_TEMPLATE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>AoC Armory — leftover lines review</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; font-family: "Segoe UI", system-ui, sans-serif; background: #14100c; color: #e8dcbe; }
  header { padding: 14px 20px; background: #1a1512; border-bottom: 1px solid #7a6424; position: sticky; top: 0; z-index: 5; }
  h1 { margin: 0 0 6px; font-size: 18px; color: #c9a961; }
  p.hint { margin: 0; font-size: 13px; color: #b3a683; }
  .toolbar { display: flex; gap: 12px; align-items: center; margin-top: 10px; }
  button { background: #7a6424; color: #14100c; border: 0; border-radius: 4px; padding: 7px 14px; font-weight: 600; cursor: pointer; }
  button:hover { background: #967c2e; }
  #status { font-size: 13px; color: #8fbf6f; }
  .card { display: flex; gap: 16px; padding: 12px 20px; border-bottom: 1px solid #241c12; align-items: flex-start; }
  .card img { border: 1px solid #5a4a22; background: #000; image-rendering: pixelated; max-width: 420px; height: auto; flex: 0 0 auto; }
  .meta { flex: 1 1 auto; min-width: 280px; }
  .meta .name { font-weight: 600; color: #d8c9a8; }
  .meta .sub { font-size: 12px; color: #9a8d6e; margin: 2px 0 8px; }
  .meta .raw { font-family: Consolas, monospace; font-size: 12px; color: #c77; margin-bottom: 6px; white-space: pre-wrap; }
  .meta textarea { width: 100%; box-sizing: border-box; background: #221b13; color: #e8dcbe;
                   border: 1px solid #5a4a22; padding: 6px 8px; border-radius: 4px;
                   font-family: Consolas, monospace; font-size: 13px; resize: vertical; }
  .meta textarea.ok { border-color: #4a7a2e; }
  .badge { display: inline-block; font-size: 11px; color: #14100c; background: #5a4a22; border-radius: 3px; padding: 1px 6px; margin-left: 8px; }
  #download { position: fixed; right: 18px; bottom: 18px; padding: 10px 18px; font-size: 14px; box-shadow: 0 2px 8px #000a; }
</style>
</head>
<body>
<header>
  <h1>Leftover stats.lines review</h1>
  <p class="hint">Each card shows an item's remaining unstructured lines next to its tooltip screenshot.
  Fix OCR typos, merge/drop noise, or delete a line by emptying its row (to drop a line entirely, remove it
  from the textarea). Keep the line order. Then press <b>Download fixes JSON</b> and save it as
  <code>research/leftover_line_fixes.json</code> — the apply step replaces the lines and re-runs the structure pass.</p>
  <div class="toolbar">
    <button id="reset">Reset all to OCR text</button>
    <span id="status"></span>
  </div>
</header>
<main id="cards"></main>
<button id="download">⬇ Download fixes JSON</button>
<script>
const CARDS = __CARDS__;
const root = document.getElementById("cards");
const state = new Map();

function render() {
  root.innerHTML = "";
  for (const c of CARDS) {
    const div = document.createElement("div");
    div.className = "card";
    const meta = document.createElement("div");
    meta.className = "meta";
    const name = document.createElement("div");
    name.className = "name";
    name.textContent = c.name;
    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = "id " + c.id;
    name.appendChild(badge);
    const sub = document.createElement("div");
    sub.className = "sub";
    sub.textContent = c.location || "";
    const raw = document.createElement("div");
    raw.className = "raw";
    raw.textContent = "OCR lines: " + c.lines.join("\\n");
    const ta = document.createElement("textarea");
    ta.rows = Math.max(2, c.lines.length);
    ta.value = c.lines.join("\\n");
    ta.dataset.orig = ta.value;
    ta.addEventListener("input", () => ta.classList.toggle("ok", ta.value !== ta.dataset.orig));
    state.set(c.id, ta);
    meta.append(name, sub, raw, ta);
    div.appendChild(meta);
    if (c.img) {
      const img = document.createElement("img");
      img.src = "data:image/png;base64," + c.img;
      img.alt = "tooltip crop";
      div.appendChild(img);
    }
    root.appendChild(div);
  }
  updateStatus();
}

function updateStatus() {
  const changed = [...state.values()].filter(i => i.value !== i.dataset.orig).length;
  document.getElementById("status").textContent = changed + " / " + state.size + " edited";
}

document.getElementById("reset").addEventListener("click", () => {
  for (const ta of state.values()) ta.value = ta.dataset.orig;
  updateStatus();
});
document.getElementById("download").addEventListener("click", () => {
  const fixes = CARDS.map(c => ({
    id: c.id,
    name: c.name,
    lines: c.lines,
    fixed: (state.get(c.id) || { value: c.lines.join("\\n") }).value.split("\\n"),
  }));
  const blob = new Blob([JSON.stringify(fixes, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "leftover_line_fixes.json";
  a.click();
  URL.revokeObjectURL(a.href);
});
render();
</script>
</body>
</html>
"""


def review():
    pyt = _ensure_tesseract()
    with open(SRC_DATA, encoding="utf-8") as fh:
        data = json.load(fh)
    cards = []
    for iid, name, location, lines, image in items_with_lines(data):
        crop = None
        if image:
            fname = os.path.basename(image.split("?")[0])
            path = os.path.join(IMAGES_DIR, fname)
            if os.path.exists(path):
                crop = crop_tooltip(path, pyt)
        cards.append({"id": iid, "name": name, "location": location,
                      "lines": lines, "img": crop})
    cards.sort(key=lambda c: c["id"])
    html = PAGE_TEMPLATE.replace("__CARDS__",
                                 json.dumps(cards, ensure_ascii=False).replace("</", "<\\/"))
    with open(OUT, "w", encoding="utf-8") as fh:
        fh.write(html)
    print(f"wrote {OUT} ({len(cards)} items) — fix the lines, download the JSON, then run --apply")


def apply():
    with open(REVIEW_FILE, encoding="utf-8") as fh:
        entries = json.load(fh)
    with open(SRC_DATA, encoding="utf-8") as fh:
        data = json.load(fh)
    with open(CACHE, encoding="utf-8") as fh:
        cache = json.load(fh)

    fixes = {}
    for entry in entries:
        fixed = [ln for ln in (entry.get("fixed") or []) if ln.strip()]
        if fixed == entry.get("lines"):
            continue
        fixes[entry["id"]] = fixed

    applied = 0
    for section, loc, cat, set_, item in iter_items(data, with_path=True):
        stats = item.get("stats")
        if not stats or item["id"] not in fixes:
            continue
        stats["lines"] = list(fixes[item["id"]])
        applied += 1

    for key, entry in cache.get("items", {}).items():
        iid = int(key)
        if iid not in fixes:
            continue
        cstats = entry.get("stats")
        if cstats is not None:
            cstats["lines"] = list(fixes[iid])

    data["meta"]["generated"] = time.strftime("%Y-%m-%dT%H:%M:%S")
    with open(SRC_DATA, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=1)
    with open(CACHE, "w", encoding="utf-8") as fh:
        json.dump(cache, fh, ensure_ascii=False, indent=1)

    print(f"applied line edits to {applied} item(s)")
    print("re-running the structure pass to move any now-clean lines into props...")
    subprocess.run([sys.executable, os.path.join(BASE, "scripts", "structure_stat_lines.py")],
                   check=True)


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--review", action="store_true", help="write the review HTML page")
    ap.add_argument("--open", action="store_true", help="open the page (with --review)")
    ap.add_argument("--apply", action="store_true", help="apply the reviewed fixes")
    args = ap.parse_args()
    if args.review:
        review()
        if args.open:
            os.startfile(OUT)  # noqa: S606
    elif args.apply:
        apply()
    else:
        ap.error("pass --review or --apply")


if __name__ == "__main__":
    main()
