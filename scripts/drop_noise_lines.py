#!/usr/bin/env python3
"""Drop leftover OCR noise from stats.lines (dry-run / apply).

Removes lines that carry no item information, in order:

  * "Can Only Have One"-style leftovers that belong to the dropped
    character-specific classes: "Can not use" OCR variants ("Gan not use",
    "€an not use", "Can not-use", ...), "Currently equipped ...",
    "Sales Commission ...", "Expires in ...".
  * redundant item-name lines ("Boots of the Bloodhunter" restating the
    item's own name, including OCR-variant spellings and dropped "(nm)").
  * frame noise — garbled OCR of the tooltip frame ("ee ae he et es, eg LR",
    "[ic ee a ed RS ees ic", ...). A line is only dropped as noise when its
    content has no real markers (learn spell, "Glasses:" restrictions,
    attribute words, DPS lines, price words, ...).

Use --dry-run to list what would be dropped without touching the files.
Applied to research/armory_data.json, the OCR cache (research/tooltips.json)
and the regenerated minified app dataset armory/src/data/armory_data.json.

Run:  python scripts/drop_noise_lines.py --dry-run
      python scripts/drop_noise_lines.py
"""
import argparse
import difflib
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

RE_CANNOT = re.compile(r"^[^\w]*[gc\u20ac]?an[\s'\u2019\u2018`).-]*not[\s'\u2019\u2018`).-]*use\b", re.I)
RE_PLAYER = re.compile(r"^currently equipped|^sales commission|^expires in", re.I)
RE_LEARN = re.compile(r"^learn spell", re.I)
RE_GLASSES = re.compile(r"^glasses:", re.I)
RE_DPS = re.compile(r"dps\s*\(", re.I)
RE_PRICE_WORD = re.compile(r"\b(silver|copper|gold|tin)\b", re.I)
# real stat/proc/type markers that must never be dropped as noise
RE_REAL = re.compile(
    r"rating|regen|damage|protection|constitution|strength|dexterity|intelligence|"
    r"wisdom|stamina|health|mana|tenacity|ferocity|combat|speed|hate|spell|potion|"
    r"duration|tier|mount|companion|generic|slots|chance|armor|critigation|"
    r"bag must have|additional slots", re.I)

NOISE = re.compile(
    r"(?i)(?:^|\s)(?:ee+|ae+|ea+|a{2,}|e{2,}|SS+|ES+|oe|reo|eae|eee)\b"
    r"|^[\W_]+$"
    r"|^i{1,3}\s"
    r"|^\[.*?(?:ee|ae|e\b)"
    r"|^[a-z]{1,3}(?:ee|ae|SS)"
    r"|\b(?:Se|Tee|Pere|ees|eet|aes|hes|ees)\b"
)


def norm(s):
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())


def is_noise(line):
    """Garbled frame text, after excluding lines with real content markers."""
    core = re.sub(r"^[^\w\u20ac]+", "", line)
    core = re.sub(r"^i{1,3}\s+", "", core)
    if not core or len(core) < 4:
        return True
    if RE_LEARN.match(core) or RE_GLASSES.match(core):
        return False
    if RE_DPS.search(core) or RE_PRICE_WORD.search(core):
        return False
    if RE_REAL.search(core):
        return False
    if NOISE.search(core):
        return True
    words = re.findall(r"[A-Za-z]+", core)
    if not words:
        return True
    real = sum(1 for w in words if re.search(r"[aeiouy]", w, re.I) and len(w) > 1)
    return real / len(words) < 0.5


def is_redundant_name(line, item_name):
    """The line restates the item's own name (incl. OCR/'(nm)' variants)."""
    n_ln, n_name = norm(line), norm(item_name)
    if not n_ln or len(n_ln) < 10:
        return False
    if n_ln == n_name or n_name.startswith(n_ln) or n_ln.startswith(n_name):
        return True
    ratio = difflib.SequenceMatcher(None, n_ln, n_name).ratio()
    return ratio >= 0.9


def scrub_stats(stats, item_name, dropped):
    if not stats or not stats.get("lines"):
        return False
    kept = []
    changed = False
    for ln in stats["lines"]:
        if RE_CANNOT.match(ln) or RE_PLAYER.match(ln) or is_redundant_name(ln, item_name) \
                or is_noise(ln):
            dropped.append((item_name, ln))
            changed = True
            continue
        kept.append(ln)
    stats["lines"] = kept
    return changed


def iter_items(data):
    for section in data["sections"]:
        for loc in section.get("locations", []):
            for cat in loc.get("categories", []):
                for set_ in cat.get("sets", []):
                    for item in set_.get("items", []):
                        yield item


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--dry-run", action="store_true", help="only list what would be dropped")
    args = ap.parse_args()

    with open(SRC_DATA, encoding="utf-8") as fh:
        data = json.load(fh)

    dropped = []
    touched = 0
    for item in iter_items(data):
        stats = item.get("stats")
        if stats and scrub_stats(stats, item.get("name"), dropped):
            touched += 1

    if args.dry_run:
        print(f"would drop {len(dropped)} lines across {touched} items")
        for name, ln in sorted(dropped, key=lambda x: (x[1], x[0])):
            print(f"  {ln!r}   ({name[:44]})")
        return

    data["meta"]["generated"] = time.strftime("%Y-%m-%dT%H:%M:%S")
    with open(SRC_DATA, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=1)
    with open(APP_DATA, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, separators=(",", ":"))

    with open(CACHE, encoding="utf-8") as fh:
        cache = json.load(fh)
    cache_dropped = []
    cache_touched = 0
    names = {str(item["id"]): item.get("name", "") for item in iter_items(data)}
    for key, entry in cache.get("items", {}).items():
        if scrub_stats(entry.get("stats"), names.get(key, ""), cache_dropped):
            cache_touched += 1
    with open(CACHE, "w", encoding="utf-8") as fh:
        json.dump(cache, fh, ensure_ascii=False, indent=1)

    print(f"lines dropped: {len(dropped)}")
    print(f"items touched: {touched}")
    print(f"cache entries touched: {cache_touched}")
    print(f"wrote {SRC_DATA}")
    print(f"wrote {APP_DATA}")
    print(f"wrote {CACHE}")


if __name__ == "__main__":
    main()
