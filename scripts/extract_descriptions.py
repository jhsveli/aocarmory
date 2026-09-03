#!/usr/bin/env python3
"""Extract tooltip "Description:" blocks into stats.description (array of lines).

The OCR parser only sets stats.description for prose runs that appear without
a "Description:" label, so the label + its text usually sat in stats.lines.
This script, for every item whose lines contain a "Description:" header:

  * moves the lines after the header into stats["description"] as an ARRAY
    (each tooltip line is one element, preserving the line breaks), stopping
    before the "Gem Slots" section which is a separate tooltip block;
  * removes the header + extracted lines from stats["lines"];
  * replaces any stale parser-produced string description (e.g. one that
    absorbed the old "Can not use" noise) with the extracted block.

Existing string descriptions are converted to arrays (split on newlines).
Applied to research/armory_data.json, the OCR cache (research/tooltips.json)
and the regenerated minified app dataset armory/src/data/armory_data.json.
All files are written as UTF-8 (json.dump(..., ensure_ascii=False)).

Run:  python scripts/extract_descriptions.py
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

RE_HEADER = re.compile(r"^description:$", re.I)
RE_CUT = re.compile(r"^Gem Slots$", re.I)  # separate section, not description
RE_CAN_NOT_USE = re.compile(r"^can\s*'?t?\s*not\s*use", re.I)
# lines that are clearly OCR frame noise (kept in description but flagged)
RE_NOISE = re.compile(r"^(?:[^\w]|[a-z]{2,4} [a-z] )|^\W+$", re.I)


def lines_to_list(desc):
    """Normalize a (possibly string) description to a list of lines."""
    if desc is None:
        return None
    if isinstance(desc, list):
        return [ln for ln in desc if ln.strip() and not RE_CAN_NOT_USE.match(ln.strip())] or None
    parts = [ln.strip() for ln in desc.split("\n")]
    return [ln for ln in parts if ln and not RE_CAN_NOT_USE.match(ln)] or None


def scrub_stats(stats, flags):
    """Return True if anything changed."""
    if not stats:
        return False
    changed = False

    # 1. normalize a parser-produced string description into an array
    desc = stats.get("description")
    if isinstance(desc, str):
        stats["description"] = lines_to_list(desc)
        changed = True

    # 2. extract the Description: block from lines
    lines = stats.get("lines", [])
    for i, ln in enumerate(lines):
        if RE_HEADER.match(ln):
            j = i + 1
            while j < len(lines) and not RE_CUT.match(lines[j]):
                j += 1
            block = lines[i + 1:j]
            stats["lines"] = lines[:i] + lines[j:]
            if block:
                if stats.get("description"):
                    flags["overwritten"].append(stats["description"])
                stats["description"] = [ln for ln in block if ln.strip()]
                flags["garbled"].extend(ln for ln in block if RE_NOISE.match(ln))
            else:
                flags["empty_headers"].append(ln)
            changed = True
            break  # verified: at most one header per item
    return changed


def main():
    with open(SRC_DATA, encoding="utf-8") as fh:
        data = json.load(fh)

    flags = {"overwritten": [], "empty_headers": [], "garbled": []}
    touched = 0
    for section in data["sections"]:
        for loc in section.get("locations", []):
            for cat in loc.get("categories", []):
                for set_ in cat.get("sets", []):
                    for item in set_.get("items", []):
                        if scrub_stats(item.get("stats"), flags):
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
        if scrub_stats(entry.get("stats"), flags):
            cache_touched += 1
    with open(CACHE, "w", encoding="utf-8") as fh:
        json.dump(cache, fh, ensure_ascii=False, indent=1)

    print(f"items touched: {touched}")
    print(f"cache entries touched: {cache_touched}")
    print(f"descriptions overwritten (stale parser string): {len(flags['overwritten'])}")
    for d in flags["overwritten"][:8]:
        print(f"  overwrote: {d!r}")
    print(f"headers with no content (removed): {len(flags['empty_headers'])}")
    print(f"description lines flagged as OCR noise: {len(flags['garbled'])}")
    for ln in flags["garbled"][:12]:
        print(f"  {ln!r}")
    print(f"wrote {SRC_DATA}")
    print(f"wrote {APP_DATA}")
    print(f"wrote {CACHE}")


if __name__ == "__main__":
    main()
