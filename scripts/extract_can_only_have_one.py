#!/usr/bin/env python3
"""Extract "Can Only Have One" tooltip lines into stats.canOnlyHaveOne.

The unique-item restriction was left in stats.lines. This script sets
stats.canOnlyHaveOne = true for every item whose lines carry a "Can Only Have
One" line and removes the line (dropping OCR/frame remnants like " :", " }",
"¥ = …" or a redundant "Description:" label; keeping real text merged onto
the line, e.g. "… Furious Spirit to fight beside you in battle.").

Applied to research/armory_data.json, the OCR cache (research/tooltips.json)
and the regenerated minified app dataset armory/src/data/armory_data.json.
All files are written as UTF-8 (json.dump(..., ensure_ascii=False)).

Run:  python scripts/extract_can_only_have_one.py
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

RE_COHO = re.compile(r"^can\s*only\s*have\s*one\b", re.I)


def coho_remainder(line):
    """Text after the 'Can Only Have One' prefix that is worth keeping, else ''."""
    rest = line[RE_COHO.match(line).end():].strip()
    rest = re.sub(r"^[:}\s]+", "", rest)
    if not rest:
        return ""
    if rest.lower() == "description:":  # redundant header (block already extracted)
        return ""
    if not rest[0].isalpha():
        return ""  # "¥ = Ue Cas" and other OCR remnants
    return rest


def scrub_stats(stats, kept_remainders):
    if not stats or not stats.get("lines"):
        return False
    kept = []
    changed = False
    for ln in stats["lines"]:
        if not RE_COHO.match(ln):
            kept.append(ln)
            continue
        stats["canOnlyHaveOne"] = True
        rest = coho_remainder(ln)
        if rest:
            kept.append(rest)
            kept_remainders.append((rest, ln))
        changed = True
    stats["lines"] = kept
    return changed


def write_json(path, data, minified=False):
    with open(path, "w", encoding="utf-8") as fh:
        if minified:
            json.dump(data, fh, ensure_ascii=False, separators=(",", ":"))
        else:
            json.dump(data, fh, ensure_ascii=False, indent=1)


def main():
    with open(SRC_DATA, encoding="utf-8") as fh:
        data = json.load(fh)

    kept_remainders = []
    touched = removed = 0
    for section in data["sections"]:
        for loc in section.get("locations", []):
            for cat in loc.get("categories", []):
                for set_ in cat.get("sets", []):
                    for item in set_.get("items", []):
                        stats = item.get("stats")
                        if not stats:
                            continue
                        before = len(stats.get("lines", []))
                        if scrub_stats(stats, kept_remainders):
                            touched += 1
                            removed += before - len(stats["lines"])

    data["meta"]["generated"] = time.strftime("%Y-%m-%dT%H:%M:%S")
    write_json(SRC_DATA, data)
    write_json(APP_DATA, data, minified=True)

    with open(CACHE, encoding="utf-8") as fh:
        cache = json.load(fh)
    cache_touched = 0
    for entry in cache.get("items", {}).values():
        if scrub_stats(entry.get("stats"), kept_remainders):
            cache_touched += 1
    write_json(CACHE, cache)

    print(f"items touched: {touched}")
    print(f"'Can Only Have One' lines removed: {removed}")
    print(f"cache entries touched: {cache_touched}")
    print(f"merged-text remainders kept ({len(kept_remainders)}):")
    for rest, ln in kept_remainders[:5]:
        print(f"  {rest!r}  (from {ln!r})")
    print(f"wrote {SRC_DATA}")
    print(f"wrote {APP_DATA}")
    print(f"wrote {CACHE}")


if __name__ == "__main__":
    main()
