#!/usr/bin/env python3
"""Decode "Vendor Price" tooltip lines into stats.vendorPrice.

The OCR tooltip parser left "Vendor Price 2 Gold 50 Silver" style lines in
stats.lines. This script parses them (tolerating the usual OCR noise: V read
as M/W/Y/¥, "Gald"/"Silyer"/"Gopper"/"Tir" currency typos, S/O/i digit
confusions, trailing frame punctuation) into the structured field

    stats["vendorPrice"] = { "gold": 2, "silver": 50 }

and removes the line from stats.lines. Denomination order in the object
follows the tooltip line ("15 Silver 36 Copper 29 Tin"). Lines whose amounts
are genuinely unreadable (a "?" digit, letter junk after the price, ...) stay
in stats.lines untouched.

Applied to research/armory_data.json, the OCR cache (research/tooltips.json)
and the regenerated minified app dataset armory/src/data/armory_data.json.
All files are written as UTF-8 (json.dump(..., ensure_ascii=False)).

Run:  python scripts/extract_vendor_prices.py
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
from scripts.extract_tooltips import _strip_decor  # noqa: E402

# in-game vendor price denominations, with OCR typo variants
CURRENCY = {
    "gold": "gold", "gald": "gold",
    "silver": "silver", "silyer": "silver",
    "copper": "copper", "gopper": "copper",
    "tin": "tin", "tir": "tin",
}
# OCR reads digits as letters (5S -> 55, SO -> 50, i -> 1)
DIGIT_FIX = str.maketrans({"S": "5", "s": "5", "O": "0", "o": "0",
                           "i": "1", "I": "1", "l": "1", "L": "1"})
# "Vendor Price" with the V misread as M/W/Y/¥ and occasional leading "i " noise
RE_PRICE = re.compile(r"^(?:i\s+)?[VMWY\u00a5]?endor Price\s+(.+)$", re.I)
RE_PAIR = re.compile(r"(\S+)\s+([A-Za-z]+)")
RE_PUNCT_JUNK = re.compile(r"^[\W_]+$")  # trailing frame punctuation only


def parse_price_line(line):
    """Return (vendor_price_dict, None) or (None, skip_reason)."""
    bare = _strip_decor(line)
    m = RE_PRICE.match(bare)
    if not m:
        return None, "prefix"
    tail = m.group(1).strip()
    price = {}
    last_end = 0
    for pm in RE_PAIR.finditer(tail):
        num, cur = pm.group(1), pm.group(2).lower()
        canon = CURRENCY.get(cur)
        if canon is None:
            return None, "currency %r" % cur
        n = num.translate(DIGIT_FIX).rstrip(":'\u2019`.,")
        if not re.fullmatch(r"\d+", n):
            return None, "number %r" % num
        price[canon] = int(n)
        last_end = pm.end()
    if not price:
        return None, "empty"
    junk = tail[last_end:].strip()
    if junk and not RE_PUNCT_JUNK.match(junk):
        return None, "junk %r" % junk[:20]
    return price, None


def main():
    with open(SRC_DATA, encoding="utf-8") as fh:
        data = json.load(fh)

    items_touched = 0
    parsed = 0
    skipped = {}  # reason -> (item id, line)
    for section in data["sections"]:
        for loc in section.get("locations", []):
            for cat in loc.get("categories", []):
                for set_ in cat.get("sets", []):
                    for item in set_.get("items", []):
                        stats = item.get("stats")
                        if not stats or not stats.get("lines"):
                            continue
                        if stats.get("vendorPrice"):
                            continue  # idempotent
                        kept = []
                        for ln in stats["lines"]:
                            if not re.search(r"\bprice\b", ln, re.I):
                                kept.append(ln)
                                continue
                            price, reason = parse_price_line(ln)
                            if price is None:
                                skipped.setdefault(reason, []).append((item["id"], ln))
                                kept.append(ln)
                                continue
                            stats["vendorPrice"] = price
                            parsed += 1
                        stats["lines"] = kept
                        if stats.get("vendorPrice"):
                            items_touched += 1

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
        stats = entry.get("stats")
        if not stats or not stats.get("lines") or stats.get("vendorPrice"):
            continue
        kept = []
        for ln in stats["lines"]:
            if not re.search(r"\bprice\b", ln, re.I):
                kept.append(ln)
                continue
            price, _ = parse_price_line(ln)
            if price is None:
                kept.append(ln)
                continue
            stats["vendorPrice"] = price
        stats["lines"] = kept
        if stats.get("vendorPrice"):
            cache_touched += 1
    with open(CACHE, "w", encoding="utf-8") as fh:
        json.dump(cache, fh, ensure_ascii=False, indent=1)

    print(f"vendor prices decoded: {parsed}")
    print(f"items touched: {items_touched}")
    print(f"cache entries touched: {cache_touched}")
    total_skipped = sum(len(v) for v in skipped.values())
    print(f"lines left in stats.lines (unparseable): {total_skipped}")
    for reason, rows in sorted(skipped.items(), key=lambda kv: -len(kv[1]))[:15]:
        print(f"  {len(rows):4d}  {reason}")
    print(f"wrote {SRC_DATA}")
    print(f"wrote {APP_DATA}")
    print(f"wrote {CACHE}")


if __name__ == "__main__":
    main()
