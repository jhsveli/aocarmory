#!/usr/bin/env python3
"""Generate a self-contained HTML page for manually reviewing the OCR results.

Pairs every item's tooltip screenshot (research/images/) with its OCR text and
structured stats (research/tooltips.json) so the extraction can be spot-checked
in a browser. The page is static and works offline from file://:

    python scripts/review_tooltips.py              # write research/tooltips_review.html
    python scripts/review_tooltips.py --open       # ... and open it in the browser
    python scripts/review_tooltips.py --sample 200 # only the first N items

Page features: search, filters (no OCR data / suspiciously short), random
sampling, pagination, and a "reviewed" tracker persisted in localStorage.
"""
import argparse
import json
import os
import sys
import time

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RESEARCH = os.path.join(BASE, "research")
SRC_DATA = os.path.join(RESEARCH, "armory_data.json")
CACHE = os.path.join(RESEARCH, "tooltips.json")
IMAGES_DIR = os.path.join(RESEARCH, "images")
OUT = os.path.join(RESEARCH, "tooltips_review.html")


def build_records(data, cache, sample=0):
    records = []
    for section in data["sections"]:
        for loc in section.get("locations", []):
            for cat in loc.get("categories", []):
                for set_ in cat.get("sets", []):
                    for item in set_.get("items", []):
                        entry = cache["items"].get(str(item["id"]))
                        img = None
                        if item.get("image"):
                            img = os.path.basename(item["image"].split("?")[0])
                        records.append({
                            "id": item["id"],
                            "name": item.get("name"),
                            "rarity": item.get("rarity"),
                            "slot": item.get("slot"),
                            "img": img,
                            "hasImg": bool(img and os.path.exists(os.path.join(IMAGES_DIR, img))),
                            "tooltip": entry["tooltip"] if entry else None,
                            "stats": entry["stats"] if entry else None,
                        })
    if sample:
        records = records[:sample]
    return records


TEMPLATE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>AoC Armory — tooltip OCR review</title>
<style>
  :root {
    --ink: #26221c; --ink-soft: #6f665a; --line: #dcd3c2; --bg: #f7f3e9;
    --panel: #fffdf7; --gold: #a67c1a; --ok: #3d7a46; --warn: #b07a1a; --bad: #b03a2a;
    --r-mundane: #8a8a89; --r-superior: #6e6e6e; --r-enchanted: #4a8a35;
    --r-rare: #006ea7; --r-epic: #8d11be; --r-legendary: #c07d1a;
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--ink);
         font: 14px/1.45 system-ui, "Segoe UI", sans-serif; }
  header { position: sticky; top: 0; z-index: 10; background: #2b241c; color: #f0e6d0;
           padding: 10px 16px; box-shadow: 0 2px 8px rgba(0,0,0,.3); }
  header h1 { font-size: 15px; margin: 0 0 8px; }
  .controls { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  input[type=search], select, button {
    font: inherit; padding: 4px 8px; border: 1px solid #5a4f40; border-radius: 4px;
    background: #f7f3e9; color: var(--ink); }
  button { cursor: pointer; background: #efe7d4; }
  button:hover { background: #e6dbc0; }
  .count { font-size: 12px; opacity: .85; }
  .count b { color: #f0c060; }
  main { padding: 14px 16px 40px; display: flex; flex-direction: column; gap: 10px;
         max-width: 900px; margin: 0 auto; }
  .pager { display: flex; gap: 8px; align-items: center; justify-content: center; }
  .card { display: flex; gap: 14px; background: var(--panel);
          border: 1px solid var(--line); border-radius: 8px; padding: 10px; }
  .card.no-data { border-color: var(--bad); border-width: 2px; }
  .card.short  { border-color: var(--warn); border-width: 2px; }
  .card.reviewed { opacity: .72; }
  .card img { width: 137px; height: auto; align-self: flex-start; flex: none;
              border: 1px solid var(--line); border-radius: 4px; background: #1a1512; }
  .meta { font-size: 12px; color: var(--ink-soft); margin: 2px 0 6px; }
  .name { font-weight: 700; font-size: 15px; }
  .r-mundane { color: var(--r-mundane); } .r-superior { color: var(--r-superior); }
  .r-enchanted { color: var(--r-enchanted); } .r-rare { color: var(--r-rare); }
  .r-epic { color: var(--r-epic); } .r-legendary { color: var(--r-legendary); }
  .badge { display: inline-block; font-size: 11px; font-weight: 700; color: #fff;
           border-radius: 3px; padding: 1px 6px; margin-left: 6px; vertical-align: 2px; }
  .badge.bad { background: var(--bad); } .badge.warn { background: var(--warn); }
  pre { white-space: pre-wrap; margin: 0 0 8px; background: #f4efe2;
        border: 1px solid var(--line); border-radius: 4px; padding: 8px;
        font: 12px/1.5 ui-monospace, Consolas, monospace; }
  .stats { font-size: 12px; color: #4a443a; }
  .stats .attr { color: #2f6b2f; }
  .stats .k { color: var(--ink-soft); }
  .card button.review { align-self: flex-start; margin-left: auto; white-space: nowrap; }
  .card.reviewed button.review { background: var(--ok); color: #fff; border-color: var(--ok); }
  .empty { text-align: center; color: var(--ink-soft); padding: 40px 0; }
</style>
</head>
<body>
<header>
  <h1>AoC Armory — tooltip OCR review</h1>
  <div class="controls">
    <input type="search" id="q" placeholder="Search name / id / text…" autocomplete="off">
    <select id="mode">
      <option value="all">All items</option>
      <option value="nodata">No OCR data</option>
      <option value="short">Short (&lt;5 lines)</option>
    </select>
    <select id="pageSize">
      <option>10</option><option selected>25</option><option>50</option><option>100</option>
    </select>
    <button id="random" title="Show 20 random items">Random 20</button>
    <button id="clearRandom" title="Clear the random selection">Clear random</button>
    <button id="resetProgress">Reset progress</button>
    <span class="count" id="count"></span>
  </div>
</header>
<main id="main"></main>
<div class="pager" id="pager"></div>
<script>
const RECORDS = __DATA__;
const KEY = "aocarmory.reviewed";
const BIND_LABEL = {
  BIND_ON_PICKUP: "Binds when Picked Up",
  BIND_ON_EQUIP: "Binds when Equipped",
  NO_BIND: "No Bind",
};

let page = 0, pageSize = 25, q = "", mode = "all", selection = null;
let reviewed = loadReviewed();

function loadReviewed() {
  try { return new Set(JSON.parse(localStorage.getItem(KEY) || "[]")); }
  catch { return new Set(); }
}
function saveReviewed() { localStorage.setItem(KEY, JSON.stringify([...reviewed])); }

function filtered() {
  let list = RECORDS;
  if (selection) list = selection.map((i) => RECORDS[i]);
  if (mode === "nodata") list = list.filter((r) => !r.tooltip);
  else if (mode === "short") list = list.filter((r) => r.tooltip && r.tooltip.split(String.fromCharCode(10)).length < 5);
  if (q) {
    const needle = q.toLowerCase();
    list = list.filter((r) =>
      (r.name || "").toLowerCase().includes(needle) ||
      String(r.id).includes(needle) ||
      (r.tooltip || "").toLowerCase().includes(needle) ||
      (r.slot || "").toLowerCase().includes(needle));
  }
  return list;
}

function statsRows(stats) {
  const rows = [];
  if (stats.level) rows.push(["Level", String(stats.level)]);
  if (stats.type) rows.push(["Type", stats.type]);
  if (stats.armor) rows.push(["Armor", String(stats.armor)]);
  if (stats.damage) rows.push(["Damage", stats.damage.min + " - " + stats.damage.max]);
  if (stats.dps) rows.push(["DPS", String(stats.dps)]);
  if (stats.requires) rows.push(["Requires", stats.requires]);
  if (stats.binds) rows.push(["Binds", BIND_LABEL[stats.binds] || stats.binds]);
  if (stats.set) rows.push(["Set", stats.set]);
  for (const b of stats.setBonuses || []) rows.push(["Set bonus", b]);
  for (const a of stats.attributes || []) rows.push(["Attribute", a]);
  for (const e of stats.effects || []) rows.push(["Effect", e]);
  if (stats.description) rows.push(["Description", stats.description]);
  for (const l of stats.lines || []) rows.push(["Line", l]);
  return rows;
}

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

function renderCard(r) {
  const card = el("div", "card");
  if (!r.tooltip) card.classList.add("no-data");
  else if (r.tooltip.split(String.fromCharCode(10)).length < 5) card.classList.add("short");
  if (reviewed.has(r.id)) card.classList.add("reviewed");

  if (r.img && r.hasImg) {
    const a = el("a", null);
    a.href = "images/" + r.img;
    a.target = "_blank";
    const img = document.createElement("img");
    img.loading = "lazy";
    img.decoding = "async";
    img.alt = r.name || String(r.id);
    img.src = "images/" + r.img;
    a.appendChild(img);
    card.appendChild(a);
  } else {
    card.appendChild(el("div", "meta", "[image missing]"));
  }

  const body = el("div", null);
  const name = el("div", "name " + (r.rarity ? "r-" + r.rarity.toLowerCase() : ""), r.name || "(unnamed)");
  const badges = [];
  if (!r.tooltip) badges.push(el("span", "badge bad", "no OCR data"));
  else if (r.tooltip.split(String.fromCharCode(10)).length < 5) badges.push(el("span", "badge warn", "short"));
  if (badges.length) {
    const wrap = el("span", null);
    badges.forEach((b) => wrap.appendChild(b));
    name.appendChild(wrap);
  }
  body.appendChild(name);
  body.appendChild(el("div", "meta", "#" + r.id + (r.slot ? " · " + r.slot : "")));
  body.appendChild(el("pre", null, r.tooltip || "— no OCR text —"));
  if (r.stats) {
    const stats = el("div", "stats");
    for (const [k, v] of statsRows(r.stats)) {
      const row = el("div", null);
      row.appendChild(el("span", "k", k + ": "));
      row.appendChild(el("span", k === "Attribute" ? "attr" : null, v));
      stats.appendChild(row);
    }
    body.appendChild(stats);
  }
  card.appendChild(body);

  const btn = el("button", "review", reviewed.has(r.id) ? "✓ reviewed" : "Mark reviewed");
  btn.addEventListener("click", () => {
    if (reviewed.has(r.id)) reviewed.delete(r.id); else reviewed.add(r.id);
    saveReviewed();
    render();
  });
  card.appendChild(btn);
  return card;
}

function render() {
  const list = filtered();
  const pages = Math.max(1, Math.ceil(list.length / pageSize));
  if (page >= pages) page = pages - 1;
  const slice = list.slice(page * pageSize, (page + 1) * pageSize);

  const main = document.getElementById("main");
  main.textContent = "";
  if (!slice.length) {
    main.appendChild(el("div", "empty", "Nothing matches the current filters."));
  } else {
    slice.forEach((r) => main.appendChild(renderCard(r)));
  }

  document.getElementById("count").textContent =
    reviewed.size + " / " + RECORDS.length + " reviewed · showing " +
    list.length + (selection ? " (random selection)" : "");

  const pager = document.getElementById("pager");
  pager.textContent = "";
  const prev = el("button", null, "‹ Prev");
  prev.disabled = page === 0;
  prev.addEventListener("click", () => { page--; render(); });
  const next = el("button", null, "Next ›");
  next.disabled = page >= pages - 1;
  next.addEventListener("click", () => { page++; render(); });
  const info = el("span", "count", "Page " + (page + 1) + " / " + pages);
  pager.appendChild(prev); pager.appendChild(info); pager.appendChild(next);
}

document.getElementById("q").addEventListener("input", (e) => { q = e.target.value.trim(); page = 0; render(); });
document.getElementById("mode").addEventListener("change", (e) => { mode = e.target.value; page = 0; render(); });
document.getElementById("pageSize").addEventListener("change", (e) => { pageSize = parseInt(e.target.value, 10); page = 0; render(); });
document.getElementById("random").addEventListener("click", () => {
  const n = Math.min(20, RECORDS.length);
  const idx = new Set();
  while (idx.size < n) idx.add(Math.floor(Math.random() * RECORDS.length));
  selection = [...idx];
  page = 0; render();
});
document.getElementById("clearRandom").addEventListener("click", () => { selection = null; page = 0; render(); });
document.getElementById("resetProgress").addEventListener("click", () => {
  reviewed = new Set(); saveReviewed(); render();
});
render();
</script>
</body>
</html>
"""


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--sample", type=int, default=0,
                    help="only include the first N items (quick look)")
    ap.add_argument("--open", action="store_true",
                    help="open the generated page in the default browser")
    args = ap.parse_args()

    with open(SRC_DATA, encoding="utf-8") as fh:
        data = json.load(fh)
    with open(CACHE, encoding="utf-8") as fh:
        cache = json.load(fh)

    records = build_records(data, cache, sample=args.sample)
    blob = json.dumps(records, ensure_ascii=False).replace("</", "<\\/")
    html = TEMPLATE.replace("__DATA__", blob)

    with open(OUT, "w", encoding="utf-8") as fh:
        fh.write(html)

    n_with = sum(1 for r in records if r["tooltip"])
    n_img = sum(1 for r in records if r["hasImg"])
    print(f"wrote {OUT} ({os.path.getsize(OUT) / 1e6:.1f} MB)")
    print(f"records={len(records)} withTooltip={n_with} imagesPresent={n_img}")
    print("open it in a browser (double-click the file); images load from research/images/")
    if args.open:
        import webbrowser
        webbrowser.open("file://" + os.path.abspath(OUT).replace(os.sep, "/"))


if __name__ == "__main__":
    main()
