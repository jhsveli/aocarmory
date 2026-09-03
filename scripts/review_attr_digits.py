#!/usr/bin/env python3
"""Screenshot review for the unreadable attribute/value digits in stats.lines.

The structure pass (scripts/structure_stat_lines.py) moved every clean
attribute/value line into the structured props. What remains in stats.lines is:

  * attribute lines whose digit OCR'd unreadably ("+? Hit Rating",
    "+4? Constitution", "+7?.7 Natural Stamina Regen");
  * value lines with a mangled leading digit ("S74 Armor", "$30 Armor",
    "#10 Armor" — OCR misreads of '4', often the tens/units are fine);
  * DPS lines with an unreadable digit ("67.3 DPS (5? - 135)").

This script supports fixing them visually:

  python scripts/review_attr_digits.py --review [--open]
      writes research/attr_digits_review.html — one card per problem line with a
      zoomed, contrast-boosted crop of that line in the tooltip screenshot and
      an editable text area (the full line, e.g. "+56 Natural Mana Regen").
      Read the missing digits from the picture, correct the text, press
      "Download fixes JSON" and save it as research/attr_digit_fixes.json.

  python scripts/review_attr_digits.py --apply
      reads the review file; for each edited entry it replaces the line in
      stats.lines (research dataset + OCR cache + minified app dataset), then
      re-runs the structure pass so the now-clean lines move into props.
      Entries left unchanged stay in stats.lines.

Run:  python scripts/review_attr_digits.py --review --open
      # fix the values in the browser, download the JSON
      python scripts/review_attr_digits.py --apply
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

import pytesseract
from PIL import Image

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RESEARCH = os.path.join(BASE, "research")
SRC_DATA = os.path.join(RESEARCH, "armory_data.json")
APP_DATA = os.path.join(BASE, "armory", "src", "data", "armory_data.json")
CACHE = os.path.join(RESEARCH, "tooltips.json")
IMAGES_DIR = os.path.join(RESEARCH, "images")
REVIEW_FILE = os.path.join(RESEARCH, "attr_digit_fixes.json")
OUT = os.path.join(RESEARCH, "attr_digits_review.html")

sys.path.insert(0, BASE)
from scripts.extract_tooltips import _ensure_tesseract, preprocess  # noqa: E402
from scripts.structure_stat_lines import (  # noqa: E402
    iter_items,
    known_attr_keys,
    scrub_stats,
)

# a line needs review when it carries a '?' digit, or it is an
# armor/critigation/DPS value whose digit OCR'd as $ / S / # (misreads of '4',
# e.g. "S74 Armor"). The mangled-char check is scoped to the digit runs only,
# so the 'S' in "DPS" or "Stamina" never flags a clean line.
RE_QUESTION = re.compile(r"\?")
RE_MANGLED = re.compile(r"[$S#]")
RE_ARMOR_DIGITS = re.compile(r"^([\W$S#]*\d[\W$S#]*\d*)\s*[A&4S]rmor$", re.I)
RE_CRIT_DIGITS = re.compile(r"^([\W$S#]*\d[\W$S#]*\d*)\s*[CG]ritigation\s*(?:Amount|Armount)$", re.I)
RE_DPS_DIGITS = re.compile(r"^[\W$S#]*[\d.,]+\s*DPS\s*\(\s*([\d$S#]+)\s*-\s*([\d$S#]+)\s*[)}]", re.I)


def needs_review(line):
    """True when the line's digits are unreadable and need a screenshot look."""
    if RE_QUESTION.search(line):
        return True
    m = RE_ARMOR_DIGITS.match(line)
    if m and RE_MANGLED.search(m.group(1)):
        return True
    m = RE_CRIT_DIGITS.match(line)
    if m and RE_MANGLED.search(m.group(1)):
        return True
    m = RE_DPS_DIGITS.match(line)
    if m and (RE_MANGLED.search(m.group(1)) or RE_MANGLED.search(m.group(2))):
        return True
    return False

# distinctive tail words of the problem line, used to locate the row in the
# screenshot (longest-first so "Natural Stamina Regen" beats "Stamina Regen").
def label_words(line):
    """Significant words of a line used to find its row in the tooltip image."""
    bare = re.sub(r"^[^\w]+", "", line)
    bare = re.sub(r"[(){}]", " ", bare)
    words = [w for w in re.split(r"\s+", bare) if re.search(r"[A-Za-z]", w)]
    # drop the OCR-mangled digit token ("S74", "77?") and generic noise
    words = [w for w in words if not re.fullmatch(r"[+\-]?[\d.,?]+", w)]
    return words


def problem_lines(data):
    """Items with a stats.lines entry needing digit review: (id, name, loc, line)."""
    out = []
    for section, loc, cat, set_, item in iter_items(data, with_path=True):
        stats = item.get("stats")
        if not stats:
            continue
        for ln in stats.get("lines", []):
            if needs_review(ln):
                out.append((item["id"], item["name"], loc.get("name"), ln, item.get("image")))
    return out


def crop_line(image_path, pyt, words):
    """Crop the tooltip row containing `words`; return base64 PNG or None."""
    try:
        orig = Image.open(image_path)
        proc = preprocess(orig, binarize=False, scale=2)
        data = pyt.image_to_data(proc, lang="eng", config="--oem 3 --psm 6",
                                 output_type=pytesseract.Output.DICT)
        hits = []
        for i in range(len(data["text"])):
            t = data["text"][i].strip()
            if not t:
                continue
            tl = t.lower()
            for w in words:
                wl = w.lower()
                if wl in tl or tl in wl and len(wl) >= 4:
                    hits.append((data["top"][i], data["top"][i] + data["height"][i]))
                    break
        if not hits:
            return None
        top = min(y for y, _ in hits) - 6
        bottom = max(y for _, y in hits) + 6
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
<title>AoC Armory — attribute/value digit review</title>
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
  <h1>Attribute / value digit review</h1>
  <p class="hint">Each card shows one line from an item's tooltip whose digits OCR'd unreadably
  (<code>?</code>, or a <code>$</code>/<code>S</code>/<code>#</code> misread for <code>4</code>).
  Read the correct digits from the zoomed screenshot crop and fix the text area (keep the sign —
  <code>+</code>/<code>-</code> — and the property name as-is). Leave a field unchanged to skip it.
  Then press <b>Download fixes JSON</b> and save it as <code>research/attr_digit_fixes.json</code> —
  the apply step replaces the lines and re-runs the structure pass.</p>
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
    ta.rows = 1;
    ta.value = c.line;
    ta.dataset.orig = c.line;
    ta.addEventListener("input", () => ta.classList.toggle("ok", ta.value.trim() !== c.line));
    state.set(c.id + "\\u0000" + c.line, ta);
    meta.append(name, sub, raw, ta);
    div.appendChild(meta);
    if (c.img) {
      const img = document.createElement("img");
      img.src = "data:image/png;base64," + c.img;
      img.alt = "line crop";
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
  for (const ta of state.values()) ta.value = ta.dataset.orig;
  updateStatus();
});
document.getElementById("download").addEventListener("click", () => {
  const fixes = CARDS.map(c => ({
    id: c.id,
    name: c.name,
    line: c.line,
    fixed: (state.get(c.id + "\\u0000" + c.line) || { value: c.line }).value.trim(),
  }));
  const blob = new Blob([JSON.stringify(fixes, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "attr_digit_fixes.json";
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
    seen = set()
    for iid, name, location, line, image in problem_lines(data):
        if (iid, line) in seen:
            continue
        seen.add((iid, line))
        crop = None
        if image:
            fname = os.path.basename(image.split("?")[0])
            path = os.path.join(IMAGES_DIR, fname)
            if os.path.exists(path):
                crop = crop_line(path, pyt, label_words(line))
        cards.append({"id": iid, "name": name, "location": location,
                      "line": line, "img": crop})
    cards.sort(key=lambda c: (c["id"], c["line"]))
    html = PAGE_TEMPLATE.replace("__CARDS__",
                                 json.dumps(cards, ensure_ascii=False).replace("</", "<\\/"))
    with open(OUT, "w", encoding="utf-8") as fh:
        fh.write(html)
    print(f"wrote {OUT} ({len(cards)} lines) — fix the digits, download the JSON, then run --apply")


def validate_fixed(line):
    """Return an error message when the line still has unreadable digits."""
    if needs_review(line):
        return "digits still unreadable"
    return None


def apply():
    with open(REVIEW_FILE, encoding="utf-8") as fh:
        entries = json.load(fh)
    with open(SRC_DATA, encoding="utf-8") as fh:
        data = json.load(fh)
    with open(CACHE, encoding="utf-8") as fh:
        cache = json.load(fh)

    fixes = {}
    for entry in entries:
        fixed = (entry.get("fixed") or "").strip()
        if not fixed or fixed == entry.get("line"):
            continue
        err = validate_fixed(fixed)
        if err:
            print(f"  skip [{entry['id']}] {entry.get('line')!r} -> {fixed!r}: {err}")
            continue
        fixes.setdefault(entry["id"], []).append((entry.get("line"), fixed))

    applied = 0
    for section, loc, cat, set_, item in iter_items(data, with_path=True):
        stats = item.get("stats")
        if not stats or item["id"] not in fixes:
            continue
        lines = stats.get("lines", [])
        new_lines = list(lines)
        for old, new in fixes[item["id"]]:
            try:
                i = new_lines.index(old)
            except ValueError:
                continue
            new_lines[i] = new
            applied += 1
        stats["lines"] = new_lines

    # same replacement in the OCR cache stats
    for key, entry in cache.get("items", {}).items():
        iid = int(key)
        if iid not in fixes:
            continue
        cstats = entry.get("stats")
        if not cstats:
            continue
        clines = cstats.get("lines", [])
        new_lines = list(clines)
        for old, new in fixes[iid]:
            try:
                i = new_lines.index(old)
            except ValueError:
                continue
            new_lines[i] = new
        cstats["lines"] = new_lines

    data["meta"]["generated"] = time.strftime("%Y-%m-%dT%H:%M:%S")
    with open(SRC_DATA, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=1)
    with open(CACHE, "w", encoding="utf-8") as fh:
        json.dump(cache, fh, ensure_ascii=False, indent=1)

    print(f"applied {applied} line fix(es)")
    print("re-running the structure pass to move the now-clean lines into props...")
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
