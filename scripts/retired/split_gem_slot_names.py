#!/usr/bin/env python3
"""Re-split composite gem-slot values into the named-slot vocabulary.

The first gem-slot extraction (scripts/extract_gems_engravings.py) treated
some multi-word OCR lines as single values ("Onslaught Kuthcheman Hyperborean
White Hand"). Domain knowledge says gem slots are either socket colors or one
of the four named raid slots (Kuthcheman, Onslaught, White Hand, Hyperborean)
and can be mixed — so composite values are re-split against that vocabulary.
Values with words outside the vocabulary (e.g. the "Chaos" gem family) are
left untouched.

Applied to research/armory_data.json, the OCR cache (research/tooltips.json)
and the regenerated minified app dataset armory/src/data/armory_data.json.

Run:  python scripts/split_gem_slot_names.py
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
from scripts.review_gem_slots import VOCAB_RE  # noqa: E402


def split_values(values):
    """Split composite values into vocabulary slots; keep non-vocab values whole."""
    out = []
    for v in values:
        matches = list(VOCAB_RE.finditer(v))
        if not matches:
            out.append(v)
            continue
        covered = "".join(m.group(0) for m in matches)
        letters = re.sub(r"[^A-Za-z]", "", v)
        if letters.lower() != re.sub(r"[^A-Za-z]", "", covered).lower():
            out.append(v)  # words outside the vocabulary (e.g. "Eldritch Occult Chaos")
            continue
        out.extend(" ".join(w.capitalize() for w in m.group(0).split()) for m in matches)
    return out


def scrub_stats(stats, report):
    if not stats or not stats.get("gemSlots"):
        return False
    before = stats["gemSlots"]
    after = split_values(before)
    if after != before:
        stats["gemSlots"] = after
        report.append((before, after))
        return True
    return False


def main():
    with open(SRC_DATA, encoding="utf-8") as fh:
        data = json.load(fh)

    report = []
    touched = 0
    for section in data["sections"]:
        for loc in section.get("locations", []):
            for cat in loc.get("categories", []):
                for set_ in cat.get("sets", []):
                    for item in set_.get("items", []):
                        if scrub_stats(item.get("stats"), report):
                            touched += 1

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
        if scrub_stats(entry.get("stats"), report):
            cache_touched += 1
    with open(CACHE, "w", encoding="utf-8") as fh:
        json.dump(cache, fh, ensure_ascii=False, indent=1)

    print(f"items touched: {touched}")
    print(f"cache entries touched: {cache_touched}")
    print(f"re-splits (dataset):")
    seen = set()
    for before, after in report:
        key = (tuple(before), tuple(after))
        if key not in seen:
            seen.add(key)
            print(f"  {before!r} -> {after!r}")
    print(f"wrote {SRC_DATA}")
    print(f"wrote {APP_DATA}")
    print(f"wrote {CACHE}")


if __name__ == "__main__":
    main()
