#!/usr/bin/env python3
"""Review + fix the unparseable "Vendor Price" lines.

`extract_vendor_prices.py` leaves lines whose amounts OCR'd unreadably
("Vendor Price 40 Copper 7? Tin", "Vendor Price 42 Copper & Tin", ...) in
stats.lines. The recommended workflow is visual:

  python scripts/review_vendor_prices.py --review [--open]
      writes research/vendor_prices_review.html — one card per unparseable
      line with a zoomed, contrast-boosted crop of the price line from the
      tooltip screenshot and an editable text field. Read the amount from the
      picture, correct the text, press "Download fixes JSON" and save it as
      research/vendor_price_fixes.json.

  python scripts/review_vendor_prices.py --apply
      reads the review file, parses each edited "fixed" line, removes the
      original line from stats.lines, sets stats.vendorPrice, and regenerates
      the minified app dataset + OCR cache. Entries left unchanged (fixed
      empty or identical to the original line) are skipped and stay in
      stats.lines.

A plain-text fallback also exists:

  python scripts/review_vendor_prices.py --export
      writes research/vendor_price_fixes.json directly (edit the "fixed"
      fields by hand), then --apply as above.

Run:  python scripts/review_vendor_prices.py --review --open
      # fix the prices in the browser, download the JSON
      python scripts/review_vendor_prices.py --apply
"""
import argparse
import json
import os
import re
import sys
import time

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RESEARCH = os.path.join(BASE, "research")
SRC_DATA = os.path.join(RESEARCH, "armory_data.json")
APP_DATA = os.path.join(BASE, "armory", "src", "data", "armory_data.json")
CACHE = os.path.join(RESEARCH, "tooltips.json")
REVIEW_FILE = os.path.join(RESEARCH, "vendor_price_fixes.json")

sys.path.insert(0, BASE)
from scripts.extract_tooltips import _strip_decor  # noqa: E402
from scripts.extract_vendor_prices import parse_price_line  # noqa: E402

RE_PREFIX = re.compile(r"^[VMWY\u00a5]?endor Price\s+(.+)$", re.I)


def iter_items(data):
    for section in data["sections"]:
        for loc in section.get("locations", []):
            for cat in loc.get("categories", []):
                for set_ in cat.get("sets", []):
                    for item in set_.get("items", []):
                        yield section, loc, cat, set_, item


def prefilled_fix(line):
    """Best-effort cleaned price for lines whose trailing junk is pure noise.

    Consumes leading "<amount> <currency>" pairs and only strips the remainder
    when it is clearly frame noise — no digits, no currency word (so "& Tin",
    "S2Tin", "7? Tin" are left for the reviewer).
    """
    bare = _strip_decor(line)
    m = RE_PREFIX.match(bare)
    if not m:
        return line
    tail = m.group(1).strip()
    pairs = []
    pos = 0
    for pm in re.finditer(r"(\d+)\s+([A-Za-z]+)", tail):
        if tail[pos:pm.start()].strip():
            break  # non-whitespace gap -> mangled remnant
        pairs.append(pm.group(0))
        pos = pm.end()
    if not pairs or pos >= len(tail):
        return line
    junk = tail[pos:].strip()
    if re.search(r"\d", junk) or re.search(
            r"(?:gold|gald|silver|silyer|copper|gopper|tin|tir)", junk, re.I):
        return line
    return "Vendor Price " + " ".join(pairs)


def export():
    with open(SRC_DATA, encoding="utf-8") as fh:
        data = json.load(fh)
    entries = []
    for section, loc, cat, set_, item in iter_items(data):
        stats = item.get("stats")
        if not stats:
            continue
        for ln in stats.get("lines", []):
            if re.search(r"\bprice\b", ln, re.I) and parse_price_line(ln)[0] is None:
                entries.append({
                    "id": item["id"],
                    "name": item["name"],
                    "location": loc.get("name"),
                    "set": set_.get("name"),
                    "image": item.get("image"),
                    "line": ln,
                    "fixed": prefilled_fix(ln),
                })
    entries.sort(key=lambda e: e["id"])
    with open(REVIEW_FILE, "w", encoding="utf-8") as fh:
        json.dump(entries, fh, ensure_ascii=False, indent=2)
    print(f"exported {len(entries)} unparseable price lines -> {REVIEW_FILE}")


PAGE_TEMPLATE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>AoC Armory — vendor price review</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; font-family: "Segoe UI", system-ui, sans-serif; background: #14100c; color: #e8dcbe; }
  header { padding: 14px 20px; background: #1a1512; border-bottom: 1px solid #7a6424; position: sticky; top: 0; z-index: 5; }
  h1 { margin: 0 0 6px; font-size: 18px; color: #c9a961; }
  p.hint { margin: 0; font-size: 13px; color: #b3a683; }
  .toolbar { display: flex; gap: 12px; align-items: center; margin-top: 10px; flex-wrap: wrap; }
  .toolbar input[type=text] { background: #221b13; color: #e8dcbe; border: 1px solid #5a4a22; padding: 5px 8px; border-radius: 4px; width: 220px; }
  button { background: #7a6424; color: #14100c; border: 0; border-radius: 4px; padding: 7px 14px; font-weight: 600; cursor: pointer; }
  button:hover { background: #967c2e; }
  #status { font-size: 13px; color: #8fbf6f; }
  .card { display: flex; gap: 16px; padding: 12px 20px; border-bottom: 1px solid #241c12; align-items: flex-start; }
  .card img { border: 1px solid #5a4a22; background: #000; image-rendering: pixelated; max-width: 720px; height: auto; flex: 0 0 auto; }
  .meta { flex: 1 1 auto; min-width: 260px; }
  .meta .name { font-weight: 600; color: #d8c9a8; }
  .meta .sub { font-size: 12px; color: #9a8d6e; margin: 2px 0 8px; }
  .meta .raw { font-family: Consolas, monospace; font-size: 13px; color: #c77; margin-bottom: 6px; }
  .meta input { width: 100%; box-sizing: border-box; background: #221b13; color: #e8dcbe;
                border: 1px solid #5a4a22; padding: 6px 8px; border-radius: 4px; font-family: Consolas, monospace; font-size: 13px; }
  .meta input.ok { border-color: #4a7a2e; }
  .meta .badge { display: inline-block; font-size: 11px; color: #14100c; background: #5a4a22; border-radius: 3px; padding: 1px 6px; margin-left: 8px; }
  details.crop { margin-top: 6px; }
  summary { cursor: pointer; color: #9a8d6e; font-size: 12px; }
  #download { position: fixed; right: 18px; bottom: 18px; padding: 10px 18px; font-size: 14px; box-shadow: 0 2px 8px #000a; }
</style>
</head>
<body>
<header>
  <h1>Vendor price fixes</h1>
  <p class="hint">Each card shows the price line from the item's tooltip screenshot, zoomed.
  Read the amount from the picture and correct the text field (e.g. replace a "?" digit).
  Leave a field unchanged to skip that item. Then press <b>Download fixes JSON</b> and save it as
  <code>research/vendor_price_fixes.json</code> — the apply step reads that file.</p>
  <div class="toolbar">
    <input type="text" id="filter" placeholder="filter by id / name…">
    <button id="reset">Reset all to OCR text</button>
    <span id="status"></span>
  </div>
</header>
<main id="cards"></main>
<button id="download">⬇ Download fixes JSON</button>
<script>
const CARDS = __CARDS__;
const root = document.getElementById("cards");
const state = new Map(); // id -> input element

function render(list) {
  root.innerHTML = "";
  for (const c of list) {
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
    sub.textContent = [c.location, c.set].filter(Boolean).join(" · ");
    const raw = document.createElement("div");
    raw.className = "raw";
    raw.textContent = "OCR: " + c.line;
    const input = document.createElement("input");
    input.type = "text";
    input.value = c.line;
    input.dataset.orig = c.line;
    input.spellcheck = false;
    input.addEventListener("input", () => {
      input.classList.toggle("ok", input.value.trim() !== c.line);
    });
    state.set(c.id, input);
    meta.append(name, sub, raw, input);
    div.appendChild(meta);
    if (c.img) {
      const wrap = document.createElement("div");
      const img = document.createElement("img");
      img.src = "data:image/png;base64," + c.img;
      img.alt = "price line crop";
      img.title = c.line;
      wrap.appendChild(img);
      div.appendChild(wrap);
    }
    root.appendChild(div);
  }
  updateStatus();
}

function updateStatus() {
  const changed = [...state.values()].filter(i => i.value.trim() !== i.dataset.orig).length;
  document.getElementById("status").textContent = changed + " / " + state.size + " fixed";
}

document.getElementById("filter").addEventListener("input", (e) => {
  const q = e.target.value.toLowerCase();
  const list = CARDS.filter(c => !q || c.name.toLowerCase().includes(q) || String(c.id) === q);
  render(list);
});
document.getElementById("reset").addEventListener("click", () => {
  for (const [id, input] of state) {
    const c = CARDS.find(x => x.id === id);
    if (c) input.value = c.line;
  }
  updateStatus();
});
document.getElementById("download").addEventListener("click", () => {
  const fixes = CARDS.map(c => ({
    id: c.id,
    name: c.name,
    location: c.location,
    set: c.set,
    line: c.line,
    fixed: (state.get(c.id) || { value: c.line }).value.trim(),
  }));
  const blob = new Blob([JSON.stringify(fixes, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "vendor_price_fixes.json";
  a.click();
  URL.revokeObjectURL(a.href);
});
render(CARDS);
</script>
</body>
</html>
"""


def review():
    """Generate a self-contained HTML page for reading the price off the screenshots.

    Each of the 57 unparseable lines is shown with a zoomed crop of its tooltip
    price line and an editable text field. The user reads the digit from the
    screenshot, fixes the text, and downloads the fixes JSON — which is exactly
    the file `--apply` consumes.
    """
    import base64
    import io

    import pytesseract
    from PIL import Image, ImageOps

    from scripts.extract_tooltips import _ensure_tesseract, preprocess

    pyt = _ensure_tesseract()
    IMAGES_DIR = os.path.join(RESEARCH, "images")
    OUT = os.path.join(RESEARCH, "vendor_prices_review.html")

    with open(SRC_DATA, encoding="utf-8") as fh:
        data = json.load(fh)

    cards = []
    for section, loc, cat, set_, item in iter_items(data):
        stats = item.get("stats")
        if not stats:
            continue
        for ln in stats.get("lines", []):
            if not (re.search(r"\bprice\b", ln, re.I) and parse_price_line(ln)[0] is None):
                continue
            fname = os.path.basename((item.get("image") or "").split("?")[0])
            img_path = os.path.join(IMAGES_DIR, fname)
            crop_b64 = None
            if os.path.exists(img_path):
                try:
                    orig = Image.open(img_path)
                    proc = preprocess(orig, binarize=False, scale=2)
                    data_ = pyt.image_to_data(
                        proc, lang="eng", config="--oem 3 --psm 6",
                        output_type=pytesseract.Output.DICT)
                    ys = []
                    for i in range(len(data_["text"])):
                        t = data_["text"][i].strip()
                        if re.match(r"^[VMWY\u00a5]?endor$", t, re.I) or t.lower() == "price":
                            ys.append((data_["top"][i], data_["top"][i] + data_["height"][i]))
                    if ys:
                        top = min(y for y, _ in ys) - 6
                        bottom = max(y for _, y in ys) + 6
                    else:
                        top = int(proc.height * 0.86)
                        bottom = int(proc.height * 0.97)
                    # back to original coordinates, clamp, crop full width
                    top, bottom = top // 2, bottom // 2
                    top, bottom = max(0, top), min(orig.height, bottom)
                    if bottom > top:
                        band = orig.crop((0, top, orig.width, bottom)).convert("L")
                        # percentile stretch: the price line is dimmer than the
                        # rest of the tooltip, so boost its contrast for review
                        px = sorted(band.getdata())
                        lo = px[min(len(px) - 1, len(px) // 20)]
                        hi = px[min(len(px) - 1, len(px) * 19 // 20)]
                        if hi > lo:
                            band = band.point(
                                lambda v: min(255, max(0, int((v - lo) * 255 / (hi - lo)))))
                        band = band.resize((band.width * 5, band.height * 5), Image.LANCZOS)
                        buf = io.BytesIO()
                        band.save(buf, format="PNG")
                        crop_b64 = base64.b64encode(buf.getvalue()).decode("ascii")
                except Exception as exc:  # noqa: BLE001 - keep the page build alive
                    crop_b64 = None
            cards.append({
                "id": item["id"],
                "name": item["name"],
                "location": loc.get("name"),
                "set": set_.get("name"),
                "line": ln,
                "img": crop_b64,
            })

    cards_json = json.dumps(cards, ensure_ascii=False).replace("</", "<\\/")
    html = PAGE_TEMPLATE.replace("__CARDS__", cards_json)
    with open(OUT, "w", encoding="utf-8") as fh:
        fh.write(html)
    print(f"wrote {OUT} ({len(cards)} items) — open it, fix the prices, download the JSON, then run --apply")


def apply_fix(stats, original_line, price):
    """Remove original_line from stats.lines and store the price. True if done."""
    if not stats or "lines" not in stats:
        return False
    for i, ln in enumerate(stats["lines"]):
        if ln == original_line:
            del stats["lines"][i]
            stats["vendorPrice"] = price
            return True
    return False


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
        # the "Vendor Price " prefix is optional in the review file
        if not re.search(r"\bprice\b", fixed, re.I):
            fixed = "Vendor Price " + fixed
        price, reason = parse_price_line(fixed)
        if price is None:
            errors.append((entry["id"], fixed, "still unparseable (%s)" % reason))
            continue
        hits = []
        for section, loc, cat, set_, item in iter_items(data):
            if item["id"] != entry["id"]:
                continue
            if apply_fix(item.get("stats"), entry["line"], price):
                hits.append(item)
        if not hits:
            errors.append((entry["id"], entry["line"], "line not found in item"))
            continue
        applied.append((entry["id"], entry["line"], price))
        # keep the OCR cache consistent
        cached = cache.get("items", {}).get(str(entry["id"]))
        if cached:
            apply_fix(cached.get("stats"), entry["line"], price)

    data["meta"]["generated"] = time.strftime("%Y-%m-%dT%H:%M:%S")
    with open(SRC_DATA, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=1)
    os.makedirs(os.path.dirname(APP_DATA), exist_ok=True)
    with open(APP_DATA, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, separators=(",", ":"))
    with open(CACHE, "w", encoding="utf-8") as fh:
        json.dump(cache, fh, ensure_ascii=False, indent=1)

    print(f"applied: {len(applied)}")
    for iid, line, price in applied:
        print(f"  [{iid}] {line!r} -> {price}")
    print(f"skipped (unchanged): {len(unchanged)}")
    for iid, line in unchanged[:10]:
        print(f"  [{iid}] {line!r}")
    if len(unchanged) > 10:
        print(f"  ... and {len(unchanged) - 10} more")
    print(f"errors: {len(errors)}")
    for iid, line, err in errors:
        print(f"  [{iid}] {line!r}: {err}")
    print(f"wrote {SRC_DATA}")
    print(f"wrote {APP_DATA}")
    print(f"wrote {CACHE}")


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--export", action="store_true", help="write the review file")
    ap.add_argument("--apply", action="store_true", help="apply the reviewed fixes")
    ap.add_argument("--review", action="store_true",
                    help="write research/vendor_prices_review.html (screenshot crops + inputs)")
    ap.add_argument("--open", action="store_true", help="open the generated HTML page (with --review)")
    args = ap.parse_args()
    if args.export:
        export()
    elif args.apply:
        apply()
    elif args.review:
        review()
        if args.open:
            os.startfile(os.path.join(RESEARCH, "vendor_prices_review.html"))  # noqa: S606
    else:
        ap.error("pass --export, --apply or --review")


if __name__ == "__main__":
    main()
