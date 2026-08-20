#!/usr/bin/env python3
"""Edit OCR tooltip text and re-derive the structured stats.

research/tooltips.json is the source of truth for the OCR results; the app
datasets are baked copies of it. This script edits that cache, re-runs the
parser on changed items, and (with --merge) regenerates the datasets plus the
review page.

Usage:
  python scripts/fix_tooltips.py --find "Charred Earth"       # locate items
  python scripts/fix_tooltips.py --item 601                   # show an entry
  python scripts/fix_tooltips.py --item 601 --strip "^208%$"  # drop a noise line
  python scripts/fix_tooltips.py --item 601 --text "Binds when Picked Up
Requires Level 80"                                            # replace all text
  python scripts/fix_tooltips.py --strip "^ee |^208%$" --dry-run   # global preview
  python scripts/fix_tooltips.py --noise --dry-run            # built-in noise presets
  python scripts/fix_tooltips.py --merge                      # bake + refresh page
"""
import argparse
import json
import os
import re
import subprocess
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPTS = os.path.join(BASE, "scripts")
sys.path.insert(0, SCRIPTS)
RESEARCH = os.path.join(BASE, "research")
SRC_DATA = os.path.join(RESEARCH, "armory_data.json")
CACHE = os.path.join(RESEARCH, "tooltips.json")

from extract_tooltips import build_names, parse_stats  # noqa: E402

# Built-in "noise" presets: lines that OCR fabricates from the tooltip frame.
NOISE_STRIP = [
    # symbol / digit-only fragments ("208%", "0)", "| 7 |", "= - =")
    re.compile(r"^[\W\d_]+$"),
]
NOISE_REPLACE = [
    # U+FFFD replacement character from undecodable OCR bytes -> apostrophe
    ("\ufffd", "'"),
]


def is_letter_noise(line: str) -> bool:
    """Frame-noise lines OCR makes from the panel texture (\"ee ee ee\")."""
    letters = re.sub(r"[^a-zA-Z]", "", line)
    if len(letters) < 4:
        return False
    return len(set(letters.lower())) <= 2


def apply_fixes(lines, strip=None, noise=False, text=None):
    """Return (new_lines, changed:bool) after applying the requested fixes."""
    if text is not None:
        return [l for l in text.split("\n") if l.strip()], True
    out = []
    changed = False
    for raw in lines:
        ln = raw
        if noise:
            if is_letter_noise(ln) or any(p.match(ln) for p in NOISE_STRIP):
                changed = True
                continue
            for old, new in NOISE_REPLACE:
                if old in ln:
                    ln = ln.replace(old, new)
                    changed = True
        if strip:
            matched = False
            for pat in strip:
                if re.search(pat, ln):
                    changed = True
                    matched = True
                    break
            if matched:
                continue
        if ln.strip():
            out.append(ln)
        elif ln != raw:
            changed = True
    return out, changed


def show_entry(item_id, names, cache):
    entry = cache["items"].get(str(item_id))
    if not entry:
        print(f"no cached tooltip for item {item_id} ({names.get(item_id)})")
        return
    print(f"# {item_id} — {names.get(item_id)}")
    print("--- tooltip ---")
    print(entry.get("tooltip") or "(empty)")
    print("--- stats ---")
    print(json.dumps(entry.get("stats"), ensure_ascii=False, indent=1))


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--find", metavar="TEXT", help="list items whose name/id matches")
    ap.add_argument("--item", type=int, action="append", help="item id to show/edit (repeatable)")
    ap.add_argument("--text", help="replace the whole tooltip text for --item (\\n = line break)")
    ap.add_argument("--strip", action="append", help="drop lines matching this regex (repeatable)")
    ap.add_argument("--noise", action="store_true", help="apply the built-in noise presets")
    ap.add_argument("--dry-run", action="store_true", help="show what would change without writing")
    ap.add_argument("--merge", action="store_true", help="bake changes into datasets + review page")
    args = ap.parse_args()

    with open(SRC_DATA, encoding="utf-8") as fh:
        data = json.load(fh)
    names = build_names(data)
    with open(CACHE, encoding="utf-8") as fh:
        cache = json.load(fh)

    if args.find:
        needle = args.find.lower()
        hits = sorted(
            (int(k), v) for k, v in cache["items"].items()
            if needle in (names.get(int(k)) or "").lower() or needle in k
        )
        print(f"{len(hits)} match(es):")
        for iid, _ in hits[:40]:
            print(f"  {iid}  {names.get(iid)}")
        return

    if args.item and not (args.text or args.strip or args.noise):
        for iid in args.item:
            show_entry(iid, names, cache)
        return

    # ---- edits ----------------------------------------------------------
    if args.item:
        targets = [str(i) for i in args.item]
    elif args.text or args.strip or args.noise:
        targets = sorted(cache["items"], key=int)
    elif args.merge:
        # publish-only: bake the current cache into the datasets + review page
        subprocess.run([sys.executable, os.path.join(SCRIPTS, "extract_tooltips.py"), "--merge"],
                       check=True)
        subprocess.run([sys.executable, os.path.join(SCRIPTS, "review_tooltips.py")],
                       check=True)
        print("datasets + review page regenerated (no edits)")
        return
    else:
        ap.error("nothing to do: pass --find, --item, --merge, or an edit flag")

    changed_ids = []
    for key in targets:
        entry = cache["items"].get(key)
        if not entry:
            continue
        lines = (entry.get("tooltip") or "").split("\n")
        new_lines, changed = apply_fixes(
            lines, strip=args.strip, noise=args.noise,
            text=args.text if args.item and len(args.item) == 1 else None)
        # --text applies to a single --item only
        if not changed:
            continue
        changed_ids.append(int(key))
        if args.dry_run:
            old = [l for l in lines if l.strip()]
            print(f"--- {key} {names.get(int(key))}")
            for l in old:
                if l not in new_lines:
                    print(f"  - {l}")
            for l in new_lines:
                if l not in old:
                    print(f"  + {l}")
            continue
        entry["tooltip"] = "\n".join(new_lines) if new_lines else None
        entry["stats"] = parse_stats(new_lines, names.get(int(key))) if new_lines else None

    if args.dry_run:
        print(f"\ndry run: {len(changed_ids)} item(s) would change")
        return

    if not changed_ids:
        print("no changes applied (nothing matched)")
        return

    with open(CACHE, "w", encoding="utf-8") as fh:
        json.dump(cache, fh, ensure_ascii=False, indent=1)
    print(f"updated {len(changed_ids)} item(s) in {CACHE}")
    if not args.merge:
        print("next: python scripts/fix_tooltips.py --merge   (or add --merge to this run)")

    if args.merge:
        subprocess.run([sys.executable, os.path.join(SCRIPTS, "extract_tooltips.py"), "--merge"],
                       check=True)
        subprocess.run([sys.executable, os.path.join(SCRIPTS, "review_tooltips.py")],
                       check=True)
        print("datasets + review page regenerated")


if __name__ == "__main__":
    main()
