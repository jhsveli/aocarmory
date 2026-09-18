#!/usr/bin/env python3
"""Lift faction-rank requirements out of stats.lines into stats.requiresFactionRank.

One-off data migration for research/armory_data.json. The OCR tooltip parser
bucket-captured lines like

    "Buying requires Rank"
    "Soldier (Rank 1) in Last Legion"

into stats["lines"]. This script parses the second line (tolerating the usual
OCR noise: "}" for ")", "\\" for ")", "in'" / "in/" / "lin" for "in",
"Yag-kasha" for "Yag-kosha", "4rena" for "Arena", ...) and writes the
structured form

    stats["requiresFactionRank"] = { "last legion": 1 }

removing the header + requirement lines from stats["lines"]. Faction display
names and per-rank titles live in the client language file
(armory/src/lib/faction-ranks.ts), keyed by the same lowercase faction key.

Regenerates the minified app dataset armory/src/data/armory_data.json from the
research file (same shape as scripts/extract_tooltips.py --merge).

Run:  python scripts/extract_faction_ranks.py
"""
import difflib
import json
import os
import re
import time

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RESEARCH = os.path.join(BASE, "research")
SRC_DATA = os.path.join(RESEARCH, "armory_data.json")
APP_DATA = os.path.join(BASE, "armory", "src", "data", "armory_data.json")

# Canonical factions: lowercase data key -> (display name, tooltip preposition).
# "with the faction" is genuine in-game text for Clan Vigdis and the Pit
# Master's Arena factions; everything else reads "... in <Faction>".
FACTIONS = {
    "brittle blade": ("Brittle Blade", "in"),
    "children of yag-kosha": ("Children of Yag-kosha", "in"),
    "clan vigdis": ("Clan Vigdis", "with the faction"),
    "hyrkanians": ("Hyrkanians", "in"),
    "jiang shi": ("Jiang Shi", "in"),
    "last legion": ("Last Legion", "in"),
    "pit master's arena (gladiators)": ("Pit Master's Arena (Gladiators)", "with the faction"),
    "pit master's arena (pit fighters)": ("Pit Master's Arena (Pit Fighters)", "with the faction"),
    "scarlet circle": ("Scarlet Circle", "in"),
    "scholars of cheng-ho": ("Scholars of Cheng-ho", "in"),
    "shadows of jade": ("Shadows of Jade", "in"),
    "tamarin's tigers": ("Tamarin's Tigers", "in"),
    "wolves of the steppes": ("Wolves of the Steppes", "in"),
    "yellow priests of yun": ("Yellow Priests of Yun", "in"),
}

# "Buying requires Rank" / "Purchasing this item requires Rank" (plus OCR
# variants: "Buying!", "Buying)", "iter"/"itern"). Only meaningful as the
# header of a faction requirement, so they are dropped alongside it.
RE_HEADER = re.compile(r"^(?:buying|purchasing)\b.{0,24}?\brequires? rank\b", re.I)

# "<Title> (Rank N) ..." — the closing paren is often OCR'd as "}", "]" or "\".
RE_REQ = re.compile(r"^(.+?)\s*\(\s*Rank\s*(\d)\s*[)\]}\\]", re.I)
# the faction name follows "in" / "with the faction" (possibly merged: "lin",
# "in�", "in'", "in/"); anything after the faction name is OCR junk.
RE_PREP = re.compile(r"(?:with the faction|in)\s*(.+)$", re.I)

MATCH_CUTOFF = 0.8


def _norm(s: str) -> str:
    """Lowercase + collapse OCR noise into a comparable token string."""
    s = s.lower()
    s = s.replace("\ufffd", "'").replace("\u2019", "'").replace("\u2018", "'")
    s = s.replace("4rena", "arena").replace("srena", "arena")  # OCR A -> 4 / S
    s = s.replace("ofj", "of j")  # "Shadows ofjJade"
    return re.sub(r"[^a-z0-9' ]+", " ", s).strip()


def match_faction(part: str):
    """Map the OCR'd faction fragment to a canonical key (or None)."""
    n = _norm(part)
    if not n:
        return None
    best, best_ratio = None, 0.0
    for key, (display, _prep) in FACTIONS.items():
        cn = _norm(display)
        if n == cn:
            return key
        if n.startswith(cn):
            # faction matched, trailing OCR junk after it ("Hyrkanians Hyrkania.")
            ratio = 0.95
        else:
            ratio = max(
                difflib.SequenceMatcher(None, n, cn).ratio(),
                difflib.SequenceMatcher(None, n[: len(cn)], cn).ratio(),
            )
        if ratio > best_ratio:
            best, best_ratio = key, ratio
    return best if best_ratio >= MATCH_CUTOFF else None


def parse_requirement(line: str):
    """Return (faction_key, rank) for a requirement line, else None."""
    m = RE_REQ.match(line)
    if not m:
        return None
    rank = int(m.group(2))
    rest = line[m.end():]
    pm = RE_PREP.search(rest)
    if not pm:
        return None
    key = match_faction(pm.group(1))
    return (key, rank) if key else None


def main():
    with open(SRC_DATA, encoding="utf-8") as fh:
        data = json.load(fh)

    transformed = 0
    extracted = {}  # faction key -> count
    unmatched = []  # (item id, line) requirement-shaped lines that failed
    leftover_rank_lines = []  # (item id, line) "Rank" lines left in lines

    for section in data["sections"]:
        for loc in section.get("locations", []):
            for cat in loc.get("categories", []):
                for set_ in cat.get("sets", []):
                    for item in set_.get("items", []):
                        stats = item.get("stats")
                        if not stats or not stats.get("lines"):
                            continue
                        if stats.get("requiresFactionRank"):
                            continue  # idempotent
                        reqs = {}
                        drop = set()
                        for i, ln in enumerate(stats["lines"]):
                            if RE_HEADER.match(ln):
                                drop.add(i)
                                continue
                            parsed = parse_requirement(ln)
                            if parsed:
                                key, rank = parsed
                                reqs[key] = rank
                                drop.add(i)
                                continue
                            # requirement-shaped but faction unmatched
                            m = RE_REQ.match(ln)
                            if m and RE_PREP.search(ln[m.end():]):
                                unmatched.append((item["id"], ln))
                            elif re.search(r"\brank\b", ln, re.I):
                                leftover_rank_lines.append((item["id"], ln))
                        if reqs:
                            stats["requiresFactionRank"] = reqs
                            stats["lines"] = [ln for i, ln in enumerate(stats["lines"]) if i not in drop]
                            transformed += 1
                            for key, rank in reqs.items():
                                extracted[key] = extracted.get(key, 0) + 1

    data["meta"]["generated"] = time.strftime("%Y-%m-%dT%H:%M:%S")
    with open(SRC_DATA, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=1)
    os.makedirs(os.path.dirname(APP_DATA), exist_ok=True)
    with open(APP_DATA, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, separators=(",", ":"))

    print(f"transformed items: {transformed}")
    print(f"requirement pairs extracted: {sum(extracted.values())}")
    for key, n in sorted(extracted.items()):
        print(f"  {n:4d}  {key}")
    print(f"unmatched requirement lines: {len(unmatched)}")
    for iid, ln in unmatched:
        print(f"  [{iid}] {ln!r}")
    print(f"'Rank' lines left in stats.lines: {len(leftover_rank_lines)}")
    for iid, ln in leftover_rank_lines[:20]:
        print(f"  [{iid}] {ln!r}")
    if len(leftover_rank_lines) > 20:
        print(f"  ... and {len(leftover_rank_lines) - 20} more")
    print(f"wrote {SRC_DATA}")
    print(f"wrote {APP_DATA}")


if __name__ == "__main__":
    main()
