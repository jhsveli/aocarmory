#!/usr/bin/env python3
"""Screenshot review for the unreadable "Gem Slots" values.

`extract_gems_engravings.py` leaves "Gem Slots" blocks whose values OCR'd
unreadably ("Kuthcheman 22?", "Pon 8 tag ORR eg Reo LN") in stats.lines. This
script supports fixing them visually:

  python scripts/review_gem_slots.py --review [--open]
      writes research/gem_slots_review.html — one card per block with a zoomed,
      contrast-boosted crop of the tooltip's gem-slot section and an editable
      text area (one value per line). Read the gem name/colors from the
      picture, correct the text, press "Download fixes JSON" and save it as
      research/gem_slot_fixes.json.

  python scripts/review_gem_slots.py --apply
      reads the review file; for each edited entry it parses the value lines,
      sets stats.gemSlots and removes the "Gem Slots" block from stats.lines,
      then regenerates the minified app dataset + OCR cache. Entries left
      unchanged stay in stats.lines.

Run:  python scripts/review_gem_slots.py --review --open
      # fix the values in the browser, download the JSON
      python scripts/review_gem_slots.py --apply
"""
import argparse
import base64
import io
import json
import os
import re
import sys
import time

import pytesseract
from PIL import Image

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RESEARCH = os.path.join(BASE, "research")
SRC_DATA = os.path.join(RESEARCH, "armory_data.json")
APP_DATA = os.path.join(BASE, "armory", "src", "data", "armory_data.json")
CACHE = os.path.join(RESEARCH, "tooltips.json")
IMAGES_DIR = os.path.join(RESEARCH, "images")
REVIEW_FILE = os.path.join(RESEARCH, "gem_slot_fixes.json")
OUT = os.path.join(RESEARCH, "gem_slots_review.html")

sys.path.insert(0, BASE)
from scripts.extract_tooltips import _ensure_tesseract, preprocess  # noqa: E402

# allow leading OCR/frame noise before the label, e.g. "; Gem Slots"
RE_GEM_LABEL = re.compile(r"^\W*gem slots$", re.I)


def iter_items(data):
    for section in data["sections"]:
        for loc in section.get("locations", []):
            for cat in loc.get("categories", []):
                for set_ in cat.get("sets", []):
                    for item in set_.get("items", []):
                        yield section, loc, cat, set_, item


def unreadable_blocks(data):
    """Items whose lines still carry a 'Gem Slots' block (id, name, loc, values)."""
    out = []
    for section, loc, cat, set_, item in iter_items(data):
        stats = item.get("stats")
        if not stats:
            continue
        lines = stats.get("lines", [])
        for i, ln in enumerate(lines):
            if RE_GEM_LABEL.match(ln):
                out.append((item["id"], item["name"], loc.get("name"),
                            lines[i + 1:], item.get("image")))
                break
    return out


def crop_band(image_path, pyt):
    """Crop the gem-slot section (label + values) from the screenshot."""
    try:
        orig = Image.open(image_path)
        proc = preprocess(orig, binarize=False, scale=2)
        data = pyt.image_to_data(proc, lang="eng", config="--oem 3 --psm 6",
                                 output_type=pytesseract.Output.DICT)
        gem_y = []
        all_bottoms = []
        for i in range(len(data["text"])):
            t = data["text"][i].strip()
            if not t:
                continue
            if t.lower() in ("gem", "slots"):
                gem_y.append((data["top"][i], data["top"][i] + data["height"][i]))
            all_bottoms.append(data["top"][i] + data["height"][i])
        if not gem_y:
            return None
        top = min(y for y, _ in gem_y) - 8
        # the value lines sit below the label; extend to the last word in the
        # tooltip (the gem block is at the bottom of these tooltips)
        bottom = max(max(all_bottoms), max(y for _, y in gem_y)) + 8
        top, bottom = max(0, top // 2), min(orig.height, bottom // 2)
        if bottom <= top:
            return None
        band = orig.crop((0, top, orig.width, bottom)).convert("L")
        px = sorted(band.getdata())
        lo = px[min(len(px) - 1, len(px) // 20)]
        hi = px[min(len(px) - 1, len(px) * 19 // 20)]
        if hi > lo:
            band = band.point(lambda v: min(255, max(0, int((v - lo) * 255 / (hi - lo)))))
        band = band.resize((band.width * 5, band.height * 5), Image.LANCZOS)
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
<title>AoC Armory — gem slot review</title>
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
  .card img { border: 1px solid #5a4a22; background: #000; image-rendering: pixelated; max-width: 640px; height: auto; flex: 0 0 auto; }
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
  <h1>Gem slot fixes</h1>
  <p class="hint">Each card shows the "Gem Slots" section from the item's tooltip screenshot, zoomed.
  Read the gem name / slot colors from the picture and correct the text area (one value per line).
  Leave a field unchanged to skip that item. Then press <b>Download fixes JSON</b> and save it as
  <code>research/gem_slot_fixes.json</code> — the apply step reads that file.</p>
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
    raw.textContent = "OCR: " + c.line;
    const ta = document.createElement("textarea");
    ta.rows = Math.max(1, c.line.split("\\n").length);
    ta.value = c.line;
    ta.dataset.orig = c.line;
    ta.addEventListener("input", () => ta.classList.toggle("ok", ta.value.trim() !== c.line));
    state.set(c.id, ta);
    meta.append(name, sub, raw, ta);
    div.appendChild(meta);
    if (c.img) {
      const img = document.createElement("img");
      img.src = "data:image/png;base64," + c.img;
      img.alt = "gem slots crop";
      div.appendChild(img);
    }
    root.appendChild(div);
  }
  updateStatus();
}

function updateStatus() {
  const changed = [...state.values()].filter(i => i.value.trim() !== i.dataset.orig).length;
  document.getElementById("status").textContent = changed + " / " + state.size + " fixed";
}

document.getElementById("reset").addEventListener("click", () => {
  for (const [id, ta] of state) {
    const c = CARDS.find(x => x.id === id);
    if (c) ta.value = c.line;
  }
  updateStatus();
});
document.getElementById("download").addEventListener("click", () => {
  const fixes = CARDS.map(c => ({
    id: c.id,
    name: c.name,
    line: c.line,
    fixed: (state.get(c.id) || { value: c.line }).value.trim(),
  }));
  const blob = new Blob([JSON.stringify(fixes, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "gem_slot_fixes.json";
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
    for iid, name, location, values, image in unreadable_blocks(data):
        crop = None
        if image:
            fname = os.path.basename(image.split("?")[0])
            path = os.path.join(IMAGES_DIR, fname)
            if os.path.exists(path):
                crop = crop_band(path, pyt)
        cards.append({
            "id": iid,
            "name": name,
            "location": location,
            "line": "\n".join(values),
            "img": crop,
        })
    html = PAGE_TEMPLATE.replace("__CARDS__",
                                 json.dumps(cards, ensure_ascii=False).replace("</", "<\\/"))
    with open(OUT, "w", encoding="utf-8") as fh:
        fh.write(html)
    print(f"wrote {OUT} ({len(cards)} items) — fix the values, download the JSON, then run --apply")


# gem slot vocabulary: socket colors + the named slots (Kuthcheman-raid gems
# plus the "Eldritch/Occult/Chaos" chaos-gem slots), mixable in any order.
# "White Hand" is matched before "White" (longest first).
VOCAB = ["White Hand", "Hyperborean", "Kuthcheman", "Onslaught",
         "Eldritch", "Occult", "Chaos",
         "Black", "Blue", "Green", "Red", "White", "Yellow"]
VOCAB_RE = re.compile("|".join(sorted(VOCAB, key=len, reverse=True)), re.I)


def parse_fixed_values(lines):
    """Parse reviewed values: colors and named slots, mixable in any order.

    Accepts one value per line, or a quoted comma-separated list such as
    '"Onslaught", "Kuthcheman", "White Hand"'. Unrecognized words and lines
    still carrying '?' are rejected.
    """
    values = []
    for ln in lines:
        if not ln.strip():
            continue
        if "?" in ln:
            return None, "still has '?' in %r" % ln
        matches = list(VOCAB_RE.finditer(ln))
        if not matches:
            return None, "no recognized gem value in %r" % ln
        pos = 0
        for m in matches:
            gap = ln[pos:m.start()]
            if re.search(r"[A-Za-z]", gap):
                return None, "unrecognized word in %r" % ln
            pos = m.end()
        if re.search(r"[A-Za-z]", ln[pos:]):
            return None, "unrecognized word in %r" % ln
        values.extend(" ".join(w.capitalize() for w in m.group(0).split())
                      for m in matches)
    return values, None


def apply():
    with open(REVIEW_FILE, encoding="utf-8") as fh:
        entries = json.load(fh)
    with open(SRC_DATA, encoding="utf-8") as fh:
        data = json.load(fh)
    with open(CACHE, encoding="utf-8") as fh:
        cache = json.load(fh)

    applied, unchanged, errors = [], [], []
    for entry in entries:
        fixed = (entry.get("fixed") or "").strip()
        if not fixed or fixed == entry.get("line"):
            unchanged.append((entry["id"], entry.get("line")))
            continue
        values, reason = parse_fixed_values(fixed.split("\n"))
        if values is None:
            errors.append((entry["id"], fixed, reason))
            continue
        hits = 0
        for section, loc, cat, set_, item in iter_items(data):
            if item["id"] != entry["id"]:
                continue
            stats = item.get("stats")
            lines = stats.get("lines", [])
            for i, ln in enumerate(lines):
                if RE_GEM_LABEL.match(ln):
                    stats["gemSlots"] = values
                    stats["lines"] = lines[:i]  # block runs to the end
                    hits += 1
                    break
        if not hits:
            errors.append((entry["id"], entry["line"], "Gem Slots block not found"))
            continue
        applied.append((entry["id"], entry["line"], values))
        cached = cache.get("items", {}).get(str(entry["id"]))
        if cached:
            cstats = cached.get("stats")
            if cstats:
                clines = cstats.get("lines", [])
                for i, ln in enumerate(clines):
                    if RE_GEM_LABEL.match(ln):
                        cstats["gemSlots"] = values
                        cstats["lines"] = clines[:i]
                        break

    data["meta"]["generated"] = time.strftime("%Y-%m-%dT%H:%M:%S")
    with open(SRC_DATA, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=1)
    os.makedirs(os.path.dirname(APP_DATA), exist_ok=True)
    with open(APP_DATA, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, separators=(",", ":"))
    with open(CACHE, "w", encoding="utf-8") as fh:
        json.dump(cache, fh, ensure_ascii=False, indent=1)

    print(f"applied: {len(applied)}")
    for iid, line, values in applied:
        print(f"  [{iid}] {line!r} -> {values}")
    print(f"skipped (unchanged): {len(unchanged)}")
    print(f"errors: {len(errors)}")
    for iid, line, err in errors:
        print(f"  [{iid}] {line!r}: {err}")
    print(f"wrote {SRC_DATA}")
    print(f"wrote {APP_DATA}")
    print(f"wrote {CACHE}")


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
