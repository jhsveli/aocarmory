#!/usr/bin/env python3
"""Extract "Rune Engravings" and "Gem Slots" blocks into structured arrays.

The tooltip's rune engraving names ("Rune Engravings / Eternal Winter /
Winter Sun") were previously folded into stats.description, and the gem slot
content ("Gem Slots / Blue Red Yellow", "Gem Slots / Chaos") stayed in
stats.lines. This script:

  * moves the rune names into stats["engravings"] and removes the label +
    names from stats.description (dropping the description property when the
    block was its only content);
  * moves the gem values into stats["gemSlots"], splitting pure color lists
    into individual colors and keeping named gems whole; the "Gem Slots"
    label + values are removed from stats.lines;
  * leaves blocks with unreadable values ("Kuthcheman 22?", OCR garbage) in
    stats.lines untouched and reports them.

Value types are bounded: scripts/extract_tooltips.py's OCR fixes apply (e.g.
"4shur" -> "Ashur"), and the app's TypeScript types enumerate the resulting
values (see armory/src/types.ts).

Applied to research/armory_data.json, the OCR cache (research/tooltips.json)
and the regenerated minified app dataset armory/src/data/armory_data.json.
All files are written as UTF-8 (json.dump(..., ensure_ascii=False)).

Run:  python scripts/extract_gems_engravings.py
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

RE_RUNE_LABEL = re.compile(r"^rune engravings$", re.I)
# allow leading OCR/frame noise before the label, e.g. "; Gem Slots"
RE_GEM_LABEL = re.compile(r"^\W*gem slots$", re.I)
RUNE_FIX = {"4shur": "Ashur"}  # OCR reads the A of "Ashur" as a 4

COLORS = {"blue", "red", "yellow", "white", "black", "green"}
KNOWN_GEMS = {
    "chaos",
    "eldritch occult chaos",
    "kuthcheman white hand",
    "onslaught hyperborean",
    "onslaught kuthcheman hyperborean white hand",
}


def parse_gem_values(lines):
    """Gem slot values from the lines after 'Gem Slots', or None if unreadable."""
    values = []
    for ln in lines:
        tokens = re.findall(r"[A-Za-z]+", ln)
        if not tokens:
            return None, "empty line %r" % ln
        if all(t.lower() in COLORS for t in tokens):
            values.extend(t for t in tokens)
            continue
        key = " ".join(tokens).lower()
        if key in KNOWN_GEMS:
            values.append(" ".join(tokens))
            continue
        return None, "unreadable %r" % ln
    return values, None


def scrub_stats(stats, flags):
    if not stats:
        return False
    changed = False

    # --- rune engravings out of the description block ---
    desc = stats.get("description")
    if isinstance(desc, list):
        for i, ln in enumerate(desc):
            if RE_RUNE_LABEL.match(ln):
                engravings = [RUNE_FIX.get(v, v) for v in desc[i + 1:]]
                if engravings:
                    stats["engravings"] = engravings
                rest = [x for x in desc[:i] if x.strip()]
                if rest:
                    stats["description"] = rest
                else:
                    stats.pop("description", None)
                changed = True
                break

    # --- gem slots out of lines ---
    lines = stats.get("lines", [])
    for i, ln in enumerate(lines):
        if RE_GEM_LABEL.match(ln):
            j = i + 1
            while j < len(lines) and not RE_GEM_LABEL.match(lines[j]):
                j += 1
            values, reason = parse_gem_values(lines[i + 1:j])
            if values is None:
                flags["left_in_lines"].append((reason, lines[i:j]))
                break  # keep the whole block for later review
            stats["gemSlots"] = values
            stats["lines"] = lines[:i] + lines[j:]
            changed = True
            break
    return changed


def main():
    with open(SRC_DATA, encoding="utf-8") as fh:
        data = json.load(fh)

    flags = {"left_in_lines": []}
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
    print(f"gem-slot blocks left in stats.lines (unreadable values): {len(flags['left_in_lines'])}")
    for reason, block in flags["left_in_lines"]:
        print(f"  {reason}  block={block!r}")
    print(f"wrote {SRC_DATA}")
    print(f"wrote {APP_DATA}")
    print(f"wrote {CACHE}")


if __name__ == "__main__":
    main()
