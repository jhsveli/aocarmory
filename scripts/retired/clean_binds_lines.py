#!/usr/bin/env python3
"""Remove redundant "Binds …" lines from stats.lines and sync stats.binds.

The OCR parser sets stats.binds from the tooltip's bind clause but leaves the
line itself in stats.lines ("Character Bound : Binds when Picked Up",
"Binds when Equipped", "~ Binds when Picked Up", ...). For every line that
carries a bind clause this script:

  * sets stats.binds from the line (the tooltip text is ground truth):
      "Binds when Picked Up / on Pickup / on Acquire" -> BIND_ON_PICKUP
      "Binds when Equipped / on Equip"                -> BIND_ON_EQUIP
      bare "Character Bound" (no clause)              -> BIND_ON_PICKUP
  * removes the line from stats.lines.

Applied to research/armory_data.json, the OCR cache (research/tooltips.json)
and the regenerated minified app dataset armory/src/data/armory_data.json.
All files are written as UTF-8 (json.dump(..., ensure_ascii=False)).

Run:  python scripts/clean_binds_lines.py
"""
import json
import os
import re
import time

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RESEARCH = os.path.join(BASE, "research")
SRC_DATA = os.path.join(RESEARCH, "armory_data.json")
APP_DATA = os.path.join(BASE, "armory", "src", "data", "armory_data.json")
CACHE = os.path.join(RESEARCH, "tooltips.json")

# leading OCR/frame noise before the bind label ("; ", "~ ", "“", "1 ", ...)
RE_LEAD_JUNK = re.compile(r"^[^A-Za-z]+")
RE_PICKUP = re.compile(r"binds when\s+(?:picked\s*['\u2018\u2019`]?\s*up|on pickup|on acquire)", re.I)
RE_EQUIP = re.compile(r"binds when\s+(?:equipped|on equip)\b", re.I)
RE_CHAR_BOUND = re.compile(r"^character bound\b[^a-z]*$", re.I)


def implied_binds(line):
    """Bind state implied by a line, or None if it is not a binds line."""
    bare = RE_LEAD_JUNK.sub("", line)
    if RE_PICKUP.search(bare):
        return "BIND_ON_PICKUP"
    if RE_EQUIP.search(bare):
        return "BIND_ON_EQUIP"
    if RE_CHAR_BOUND.match(bare):
        return "BIND_ON_PICKUP"  # character-bound on acquire
    return None


def scrub_stats(stats, flags):
    if not stats or not stats.get("lines"):
        return False
    kept = []
    changed = False
    for ln in stats["lines"]:
        binds = implied_binds(ln)
        if binds is None:
            kept.append(ln)
            continue
        if stats.get("binds") != binds:
            flags["binds_changed"].append((stats.get("binds"), binds, ln))
        stats["binds"] = binds
        changed = True
    stats["lines"] = kept
    return changed


def main():
    with open(SRC_DATA, encoding="utf-8") as fh:
        data = json.load(fh)

    flags = {"binds_changed": []}
    removed = 0
    touched = 0
    for section in data["sections"]:
        for loc in section.get("locations", []):
            for cat in loc.get("categories", []):
                for set_ in cat.get("sets", []):
                    for item in set_.get("items", []):
                        stats = item.get("stats")
                        if not stats:
                            continue
                        before = len(stats.get("lines", []))
                        if scrub_stats(stats, flags):
                            touched += 1
                            removed += before - len(stats["lines"])

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
        if scrub_stats(entry.get("stats"), flags):
            cache_touched += 1
    with open(CACHE, "w", encoding="utf-8") as fh:
        json.dump(cache, fh, ensure_ascii=False, indent=1)

    print(f"items touched: {touched}")
    print(f"binds lines removed: {removed}")
    print(f"cache entries touched: {cache_touched}")
    print(f"binds values changed: {len(flags['binds_changed'])}")
    for old, new, ln in flags["binds_changed"]:
        print(f"  {old!r} -> {new!r}  ({ln[:60]!r})")
    print(f"wrote {SRC_DATA}")
    print(f"wrote {APP_DATA}")
    print(f"wrote {CACHE}")


if __name__ == "__main__":
    main()
