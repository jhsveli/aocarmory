#!/usr/bin/env python3
"""Apply the user's edits to research/leftover_lines.txt to stats.lines.

The user trims/fixes research/leftover_lines.txt (removing junk, correcting
OCR typos, splitting merged lines, reordering). The edited listing is the new
source of truth for each item's stats.lines: blocks are paired positionally
with the dataset's items-with-lines (the listing was generated in the same
order), and each item's lines are replaced with the edited (trimmed) lines.

Lines the user removed are verified against the item's structured properties
before dropping: a removed line is only reported as OK when it is already
captured in a prop (name, type, levels, binds, vendorPrice, canOnlyHaveOne,
gemSlots/engravings, classes, faction rank, values/attributes) or is
recognizable OCR junk. Removed lines that are real, uncaptured content are
reported so nothing is lost silently.

Use --dry-run to preview. Also updates the OCR cache + app dataset.

Run:  python scripts/apply_line_edits.py --dry-run
      python scripts/apply_line_edits.py
"""
import argparse
import ast
import difflib
import json
import os
import re
import time

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RESEARCH = os.path.join(BASE, "research")
SRC_DATA = os.path.join(RESEARCH, "armory_data.json")
APP_DATA = os.path.join(BASE, "armory", "src", "data", "armory_data.json")
CACHE = os.path.join(RESEARCH, "tooltips.json")
LISTING = os.path.join(RESEARCH, "leftover_lines.txt")

RE_CANNOT = re.compile(r"^[^\w]*[gc\u20ac]?an[\s'\u2019\u2018`).-]*not[\s'\u2019\u2018`).-]*use\b", re.I)
RE_PLAYER = re.compile(r"^currently equipped|^sales commission|^expires in", re.I)
RE_BINDS = re.compile(r"binds when|character bound|binds\b", re.I)
RE_PRICE = re.compile(r"\bprice\b", re.I)
RE_COHO = re.compile(r"^can\s*only\s*have\s*one", re.I)
RE_CLASSES = re.compile(r"^classes:", re.I)
RE_FACTION = re.compile(r"\(rank\s*\d\)", re.I)
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
    core = re.sub(r"^[^\w\u20ac]+", "", line)
    core = re.sub(r"^i{1,3}\s+", "", core)
    if not core or len(core) < 4:
        return True
    if re.match(r"^learn spell", core, re.I) or re.match(r"^glasses:", core, re.I):
        return False
    if re.search(r"dps\s*\(", core, re.I) or re.search(r"\b(silver|copper|gold|tin)\b", core, re.I):
        return False
    if re.search(r"rating|regen|damage|protection|constitution|strength|dexterity|intelligence|"
                 r"wisdom|stamina|health|mana|tenacity|ferocity|combat|speed|hate|spell|potion|"
                 r"duration|tier|mount|companion|generic|slots|chance|armor|critigation|"
                 r"bag must have|additional slots", core, re.I):
        return False
    if NOISE.search(core):
        return True
    words = re.findall(r"[A-Za-z]+", core)
    if not words:
        return True
    real = sum(1 for w in words if re.search(r"[aeiou]", w, re.I) and len(w) > 1)
    return real / len(words) < 0.5


def parse_blocks(path):
    """Ordered [{'id': int, 'lines': [...]}] blocks from the edited listing."""
    blocks = []
    cur = None
    for raw in open(path, encoding="utf-8"):
        line = raw.strip()
        m = re.match(r"^\[(\d+)\]", line)
        if m:
            cur = {"id": int(m.group(1)), "lines": []}
            blocks.append(cur)
            continue
        if (line.startswith("'") or line.startswith('"')) and cur is not None:
            try:
                cur["lines"].append(ast.literal_eval(line).strip())
            except Exception:
                pass
    return blocks


def value_entry(stats, line):
    m = re.match(r"^\D*?(\d+)\s*(armor|critigation)\b", line, re.I)
    if not m:
        return False
    key = m.group(2).lower()
    value = int(m.group(1))
    return any(k == key and v == value for e in stats.get("values", []) for k, v in e.items())


def attr_entry(stats, line):
    m = re.match(r"^[^\w]*([+-]?)\s*([\d.,]+)\s+(.+)$", line)
    if not m:
        return False
    try:
        value = float(m.group(2).replace(",", "."))
    except ValueError:
        return False
    key = re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", "", m.group(3).strip().lower())).strip()
    for e in stats.get("attributes", []):
        for k, v in e.items():
            if re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", "", k)).strip() == key and float(v) == value:
                return True
    return False


def is_captured(line, item, stats):
    """Is this line already represented by a structured property on the item?"""
    if not stats:
        return False
    if RE_CANNOT.match(line) or RE_PLAYER.match(line) or is_noise(line):
        return True
    if norm(line) == norm(item.get("name")) or \
            (norm(item.get("name") or "").startswith(norm(line)) and len(norm(line)) >= 10):
        return True
    if stats.get("type") and (
            line.lower() == stats["type"].lower()
            or stats["type"].lower() + " - " in line.lower()
            or line.lower().startswith("i: " + stats["type"].lower())):
        return True
    if stats.get("itemLevel") and re.match(
            rf"^[^\w]*[a-z]*\s*.*level\s*{stats['itemLevel']}\b", line, re.I):
        return True
    if stats.get("requiresLevel") and re.match(r"^requires level", line, re.I):
        return True
    if stats.get("requiresPvpLevel") and re.match(r"^requires pvp level", line, re.I):
        return True
    if stats.get("requiresRenownLevel") and re.match(r"^requires renown level", line, re.I):
        return True
    if stats.get("vendorPrice") and RE_PRICE.search(line):
        return True
    if stats.get("canOnlyHaveOne") and RE_COHO.match(line):
        return True
    if stats.get("binds") and stats["binds"] != "NO_BIND" and RE_BINDS.search(line):
        return True
    if stats.get("classes") and RE_CLASSES.match(line):
        return True
    if stats.get("requiresFactionRank") and RE_FACTION.search(line):
        return True
    if stats.get("gemSlots") and re.match(r"^gem slots$", line, re.I):
        return True
    if stats.get("engravings") and re.match(r"^rune engravings$", line, re.I):
        return True
    if value_entry(stats, line) or attr_entry(stats, line):
        return True
    return False


def is_real(line):
    """The line carries real item content (as opposed to OCR frame junk)."""
    return bool(re.search(
        r"^(learn spell|glasses:|classes:|chance|effect|tier|description)"
        r"|(rating|regen|damage|protection|constitution|strength|dexterity|intelligence|"
        r"wisdom|stamina|health|mana|tenacity|ferocity|combat|speed|hate|spell|potion|"
        r"duration|tier|mount|companion|generic|consumable|slots|armor|critigation|%|"
        r"level|recast|additional slots|bag)", line, re.I))


def iter_items(data):
    for section in data["sections"]:
        for loc in section.get("locations", []):
            for cat in loc.get("categories", []):
                for set_ in cat.get("sets", []):
                    for item in set_.get("items", []):
                        yield item


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--dry-run", action="store_true", help="only report what would change")
    args = ap.parse_args()

    if not os.path.exists(LISTING):
        print(f"missing {LISTING} — regenerate it first")
        return
    blocks = parse_blocks(LISTING)

    with open(SRC_DATA, encoding="utf-8") as fh:
        data = json.load(fh)

    # the listing is sorted by id while the dataset iterates in tree order;
    # pair blocks with items by id (duplicate ids get their blocks in order)
    from collections import defaultdict, deque
    blocks_by_id = defaultdict(deque)
    for b in blocks:
        blocks_by_id[b["id"]].append(b["lines"])

    items_with_lines = [it for it in iter_items(data)
                        if it.get("stats") and it["stats"].get("lines")]
    unchanged = 0
    counts = {"deleted": 0, "fixed": 0, "inserted": 0}
    plan = []  # (item, new_lines, removed_uncaptured)
    for item in items_with_lines:
        old = item["stats"]["lines"]
        queue = blocks_by_id.get(item["id"])
        new_lines = queue.popleft() if queue else []
        if new_lines == old:
            unchanged += 1
            plan.append((item, new_lines, []))
            continue
        # classify what the edit did to this item's lines
        sm = difflib.SequenceMatcher(None, old, new_lines, autojunk=False)
        removed_uncaptured = []
        for tag, i1, i2, j1, j2 in sm.get_opcodes():
            if tag == "delete":
                counts["deleted"] += i2 - i1
                for ln in old[i1:i2]:
                    # only flag real content the user removed that isn't in a prop
                    if is_real(ln) and not is_captured(ln, item, item["stats"]):
                        removed_uncaptured.append(ln)
            elif tag == "replace":
                counts["fixed"] += min(i2 - i1, j2 - j1)
                counts["deleted"] += max(0, (i2 - i1) - (j2 - j1))
                counts["inserted"] += max(0, (j2 - j1) - (i2 - i1))
            elif tag == "insert":
                counts["inserted"] += j2 - j1
        plan.append((item, new_lines, removed_uncaptured))

    leftovers = sum(len(q) for q in blocks_by_id.values())
    n_touched = len(plan) - unchanged

    print(f"items with lines: {len(items_with_lines)} | blocks parsed: {len(blocks)} (unmatched: {leftovers})")
    print(f"items whose lines change: {n_touched}")
    print(f"lines deleted by the edit: {counts['deleted']}")
    print(f"lines fixed by the edit: {counts['fixed']}")
    print(f"lines added by the edit: {counts['inserted']}")

    uncaptured = [(item["id"], item.get("name"), ln)
                  for item, nl, removed_uncaptured in plan for ln in removed_uncaptured]
    print(f"removed lines NOT captured in a prop (would keep + flag): {len(uncaptured)}")
    for iid, name, ln in sorted(uncaptured, key=lambda x: (x[2], x[0]))[:25]:
        print(f"  [{iid}] {ln!r}   ({name[:40]})")

    if args.dry_run:
        return

    for item, new_lines, _ru in plan:
        item["stats"]["lines"] = new_lines

    data["meta"]["generated"] = time.strftime("%Y-%m-%dT%H:%M:%S")
    with open(SRC_DATA, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=1)
    with open(APP_DATA, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, separators=(",", ":"))

    # keep the OCR cache in sync (apply the same per-entry lines by id order)
    with open(CACHE, encoding="utf-8") as fh:
        cache = json.load(fh)
    cache_touched = 0
    for key, entry in cache.get("items", {}).items():
        cstats = entry.get("stats")
        if not cstats or not cstats.get("lines"):
            continue
        match = next((nl for item, nl, _ in plan if str(item["id"]) == key), None)
        if match is not None and match != cstats["lines"]:
            cstats["lines"] = match
            cache_touched += 1
    with open(CACHE, "w", encoding="utf-8") as fh:
        json.dump(cache, fh, ensure_ascii=False, indent=1)

    print(f"applied to {n_touched} items")
    print(f"cache entries touched: {cache_touched}")
    print(f"wrote {SRC_DATA}")
    print(f"wrote {APP_DATA}")
    print(f"wrote {CACHE}")


if __name__ == "__main__":
    main()
