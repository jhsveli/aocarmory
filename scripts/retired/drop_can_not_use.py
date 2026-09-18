#!/usr/bin/env python3
"""Drop character-specific "Can not use" lines from the parsed dataset.

OCR'd tooltips of faction/class gear include a "Can not use" line that
reflects the character the screenshot was taken on, not the item itself. This
script removes those lines from stats.lines and the raw tooltip text in
research/armory_data.json, applies the same cleanup to the OCR cache
(research/tooltips.json), and regenerates the minified app dataset
armory/src/data/armory_data.json. Text OCR merged onto the same line
(e.g. "Can not use room of the Atlantean ruins, summons a") keeps its
remainder.

All files are written as UTF-8 (json.dump(..., ensure_ascii=False)), matching
the rest of the pipeline.

Run:  python scripts/drop_can_not_use.py
"""
import json
import os
import time

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RESEARCH = os.path.join(BASE, "research")
SRC_DATA = os.path.join(RESEARCH, "armory_data.json")
APP_DATA = os.path.join(BASE, "armory", "src", "data", "armory_data.json")
CACHE = os.path.join(RESEARCH, "tooltips.json")

import re

RE_CNU = re.compile(r"^can\s*'?t?\s*not\s*use\b", re.I)
# tooltip screenshots draw a frame around the text; OCR picks up the
# decoration chars on the left/right of lines (same set as extract_tooltips)
DECOR_LEAD = re.compile(r"^[\s|_'`/.:*,\-\u2013\u2014]+")
DECOR_TAIL = re.compile(r"[\s|_'`/\-\u2013\u2014]+$")


def clean_lines(lines):
    """Strip the 'can not use' prefix from matching lines; drop emptied ones."""
    out = []
    for ln in lines:
        bare = DECOR_LEAD.sub("", ln)
        m = RE_CNU.match(bare)
        if not m:
            out.append(ln)
            continue
        rest = DECOR_TAIL.sub("", bare[m.end():]).strip()
        if rest and not re.fullmatch(r"[\W_]+", rest):
            out.append(rest)
    return out


def clean_text(text):
    """Line-wise version of clean_lines() for the raw tooltip text."""
    return "\n".join(clean_lines(text.splitlines()))


def scrub_item(item):
    """Return (stats_lines_removed, tooltip_removed) after cleaning one item."""
    removed = 0
    stats = item.get("stats")
    if stats and stats.get("lines"):
        before = len(stats["lines"])
        stats["lines"] = clean_lines(stats["lines"])
        removed += before - len(stats["lines"])
    tt = item.get("tooltip")
    if tt:
        cleaned = clean_text(tt)
        if cleaned != tt:
            item["tooltip"] = cleaned
            removed += 1
    return removed


def main():
    with open(SRC_DATA, encoding="utf-8") as fh:
        data = json.load(fh)

    touched = 0
    removed = 0
    for section in data["sections"]:
        for loc in section.get("locations", []):
            for cat in loc.get("categories", []):
                for set_ in cat.get("sets", []):
                    for item in set_.get("items", []):
                        n = scrub_item(item)
                        if n:
                            touched += 1
                            removed += n

    data["meta"]["generated"] = time.strftime("%Y-%m-%dT%H:%M:%S")
    with open(SRC_DATA, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=1)
    os.makedirs(os.path.dirname(APP_DATA), exist_ok=True)
    with open(APP_DATA, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, separators=(",", ":"))

    # keep the OCR cache consistent so a future --merge reproduces the dataset
    with open(CACHE, encoding="utf-8") as fh:
        cache = json.load(fh)
    cache_touched = 0
    for entry in cache.get("items", {}).values():
        n = scrub_item(entry)
        if n:
            cache_touched += 1
    with open(CACHE, "w", encoding="utf-8") as fh:
        json.dump(cache, fh, ensure_ascii=False, indent=1)

    print(f"items cleaned: {touched}")
    print(f"lines/occurrences removed: {removed}")
    print(f"cache entries cleaned: {cache_touched}")
    print(f"wrote {SRC_DATA}")
    print(f"wrote {APP_DATA}")
    print(f"wrote {CACHE}")


if __name__ == "__main__":
    main()
