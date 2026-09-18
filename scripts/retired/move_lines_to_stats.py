#!/usr/bin/env python3
"""Move OCR-mangled stat lines into the structured stats fields.

The OCR tooltip parser only accepts integer attribute values, so lines whose
numbers carry a comma/period decimal ("+4,3 Natural Stamina Regen",
"+4,.5 Natural Mana Regen") fell through into stats.lines. This script:

  * moves attribute-shaped lines (signed number + known attribute label) into
    stats.attributes, normalizing the value (comma -> decimal point, stray
    punctuation collapsed) and the label via the parser's own OCR fixes;
  * recovers weapon DPS lines with comma decimals ("25,3 DPS (31 - 53)") into
    stats.dps / stats.damage;
  * fixes known one-off manglings: item 968's "874 Armar" -> armor value, and
    item 1880's attribute key that OCR noise polluted ("+40 immunity rating").

Applied to research/armory_data.json, the OCR cache (research/tooltips.json)
and the regenerated minified app dataset armory/src/data/armory_data.json.
All files are written as UTF-8 (json.dump(..., ensure_ascii=False)).

Run:  python scripts/move_lines_to_stats.py
"""
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

sys.path.insert(0, BASE)
from scripts.extract_tooltips import _strip_decor, _norm_attr_name, ATTR_TAIL_HINTS  # noqa: E402

RE_ATTR_LIKE = re.compile(r"^([+-]?\s*[\d.,]+)\s+(.+)$")
RE_DPS = re.compile(r"^([\d.,]+)\s*DPS\s*\(\s*(\d+)\s*-\s*([\d.]+)\s*\)\s*$", re.I)
# attribute keys must be plain words (a pre-existing bug stored "+40 immunity
# rating" as a key; that form is recovered separately below)
RE_PLAIN_KEY = re.compile(r"^[a-z][a-z0-9 ()]*$")


def parse_number(num):
    """Parse an OCR'd number like '+4,3' / '+4,.5' / '+5.5' / '42'."""
    sign = -1 if num.lstrip().startswith("-") else 1
    s = num.lstrip("+-").strip().replace(",", ".")
    s = re.sub(r"\.{2,}", ".", s)  # "+4,.5" -> "4.5"
    s = s.rstrip(".")
    if not re.fullmatch(r"\d+(?:\.\d+)?", s):
        return None
    v = sign * float(s)
    return int(v) if v.is_integer() else v


def known_attr_keys(data):
    """Attribute property keys already present in the dataset (plain ones)."""
    keys = set()
    for section in data["sections"]:
        for loc in section.get("locations", []):
            for cat in loc.get("categories", []):
                for set_ in cat.get("sets", []):
                    for item in set_.get("items", []):
                        stats = item.get("stats")
                        if not stats:
                            continue
                        for entry in stats.get("attributes", []):
                            keys.update(k for k in entry if RE_PLAIN_KEY.match(k))
    return keys


def scrub_stats(stats, known):
    """Move misplaced stat lines into structured fields. Returns change count."""
    if not stats:
        return 0
    changed = 0
    kept = []
    for ln in stats.get("lines", []):
        bare = _strip_decor(ln)

        m = RE_ATTR_LIKE.match(bare)
        if m:
            num, label = m.group(1).replace(" ", ""), m.group(2)
            key = _norm_attr_name(label)
            if key in known or any(h in key for h in ATTR_TAIL_HINTS):
                value = parse_number(num)
                if value is not None:
                    stats.setdefault("attributes", []).append({key: value})
                    changed += 1
                    continue

        m = RE_DPS.match(bare)
        if m and not stats.get("dps"):
            value = parse_number(m.group(1))
            if value is not None:
                stats["dps"] = value
                stats["damage"] = {"min": int(m.group(2)), "max": int(m.group(3))}
                changed += 1
                continue

        kept.append(ln)

    # armor line with OCR-mangled label ("874 Armar" -> armor value)
    for ln in list(kept):
        bare = _strip_decor(ln)
        m = RE_ATTR_LIKE.match(bare)
        if m and _norm_attr_name(m.group(2)) == "armar":
            value = parse_number(m.group(1).replace(" ", ""))
            if value is not None:
                stats.setdefault("values", []).insert(0, {"armor": int(value)})
                kept.remove(ln)
                changed += 1
                break

    # attribute keys polluted by OCR noise, e.g. "+40 immunity rating"
    for entry in stats.get("attributes", []):
        for key in list(entry):
            m = re.match(r"^([+-]?\d+)\s+(.+)$", key)
            if m and not RE_PLAIN_KEY.match(key):
                value = parse_number(m.group(1))
                if value is not None:
                    del entry[key]
                    entry[m.group(2).strip()] = value
                    changed += 1

    stats["lines"] = kept
    return changed


def main():
    with open(SRC_DATA, encoding="utf-8") as fh:
        data = json.load(fh)
    known = known_attr_keys(data)

    items_touched = 0
    changes = 0
    for section in data["sections"]:
        for loc in section.get("locations", []):
            for cat in loc.get("categories", []):
                for set_ in cat.get("sets", []):
                    for item in set_.get("items", []):
                        stats = item.get("stats")
                        if not stats:
                            continue
                        n = scrub_stats(stats, known)
                        if n:
                            items_touched += 1
                            changes += n

    data["meta"]["generated"] = time.strftime("%Y-%m-%dT%H:%M:%S")
    with open(SRC_DATA, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=1)
    os.makedirs(os.path.dirname(APP_DATA), exist_ok=True)
    with open(APP_DATA, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, separators=(",", ":"))

    with open(CACHE, encoding="utf-8") as fh:
        cache = json.load(fh)
    cache_touched = 0
    for entry in cache.get("items", {}).values():
        if scrub_stats(entry.get("stats"), known):
            cache_touched += 1
    with open(CACHE, "w", encoding="utf-8") as fh:
        json.dump(cache, fh, ensure_ascii=False, indent=1)

    print(f"known attribute keys: {len(known)}")
    print(f"items touched: {items_touched}")
    print(f"total changes: {changes}")
    print(f"cache entries touched: {cache_touched}")
    print(f"wrote {SRC_DATA}")
    print(f"wrote {APP_DATA}")
    print(f"wrote {CACHE}")


if __name__ == "__main__":
    main()
