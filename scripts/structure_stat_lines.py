#!/usr/bin/env python3
"""Move clean attribute/value lines from stats.lines into structured props.

The OCR tooltip parser bucket-captures lines it can't parse (leading frame
noise, mangled digits, "Iter" for "Item"). Earlier review passes verified
the digits; this pass moves the now-clean lines into the structured fields:

  * "231 Armor"                    -> values [{armor: 231}]
  * "58 Critigation Amount"        -> values [{critigation: 58}]
  * "72 additional slots" (bags)   -> values [{"additional slots": 72}]
  * "35,9 DPS (42 - 75}"           -> dps 35.9, damage {min: 42, max: 75}
  * "+123 Intelligence"            -> attributes [{intelligence: 123}]
  * "-35 Staggering Chance"        -> attributes [{"staggering chance": -35}]
  * "+5% Out of Combat Movement Speed" -> attributes [{"out of combat movement speed": {percent: 5}}]
  * "Chance on damage, Defiling Strike on target, 3 Procs per Minute"
                                   -> procs [{trigger: "on damage", spell: "Defiling Strike", ...}]
  * "Classes: Necromancer, ..."    -> classes [..]
  * "Dsaagger - Main Hand, Off Hand" -> type "Dagger", slots ["Main Hand", "Off Hand"]
  * "4 Iter Level 80 - Rare"       -> itemLevel 80 (OCR "Iter" = "Item")
  * "Vendor Price 2 Silver 50 Copper" -> vendorPrice

Lines that are attribute-shaped but carry NO sign ("52 Fatality Rating",
"142 Combat Rating (2HE)") are left in stats.lines and reported: the sign
(+/-) is ambiguous and needs a human decision. Lines still carrying '?' digits
are also left in lines — they are fixed via the screenshot review page
(scripts/review_attr_digits.py).

Attribute ordering inside an item is kept faithful to the tooltip screenshot:
the OCR cache's raw tooltip text is used to re-order the values/attributes
arrays after the move (entries not found in the tooltip keep their order).

Applied to research/armory_data.json, the OCR cache (research/tooltips.json)
and the regenerated minified app dataset armory/src/data/armory_data.json.
All files are written as UTF-8 (json.dump(..., ensure_ascii=False)).

Run:  python scripts/structure_stat_lines.py
"""
import copy
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
from scripts.extract_tooltips import (  # noqa: E402
    _strip_decor,
    _norm_attr_name,
    _clean_type_token,
    _norm_name,
    ATTR_TAIL_HINTS,
    CLASS_OCR_FIXES,
    RE_BINDS,
    TYPE_TOKENS,
)
from scripts.extract_vendor_prices import parse_price_line  # noqa: E402

# ---------------------------------------------------------------------------
# classification rules (operate on the cleaned lines in stats.lines)
# ---------------------------------------------------------------------------

RE_VALUE_ARMOR = re.compile(r"^(\d+)\s*Armor$", re.I)
RE_VALUE_CRIT = re.compile(r"^(\d+)\s*Critigation\s*Amount$", re.I)
RE_VALUE_SLOTS = re.compile(r"^(\d+)\s*additional\s*slots$", re.I)
# comma decimals ("35,9") and a trailing '}' instead of ')' are OCR quirks
RE_DPS = re.compile(r"^([\d.,]+)\s*DPS\s*\(\s*(\d+)\s*-\s*(\d+)\s*[)}]?\s*$", re.I)
# signed attribute lines with an integer or decimal value ("+7.7 Natural
# Stamina Regen"; no '?' — those stay for review)
RE_ATTR_SIGNED = re.compile(r"^([+-])\s*([\d.]+)\s+(.+)$")
# percentage attribute lines: "+5% Out of Combat Movement Speed"
RE_PERCENT_ATTR = re.compile(r"^([+-])\s*([\d.]+)%\s+(.+)$")
# rune-stone blessing sentences: "Increases your Constitution by +3%"
RE_PERCENT_SENTENCE = re.compile(r"^Increases your\s+(.+?)\s+by\s+([+-]?[\d.]+)%$", re.I)
# unsigned attribute-shaped line: "52 Fatality Rating" (sign unknown -> report)
RE_ATTR_UNSIGNED = re.compile(r"^(\d+)\s+(.+)$")
# OCR reads "Item Level" as "Iter Level", often with frame noise in front
RE_ITEM_LEVEL = re.compile(r"^[\W\d]*Ite[rm]n?\s*Level[: ]?\s*(\d+)", re.I)
# class restriction lines (OCR often reads "Classes" as "Glasses")
RE_CLASSES = re.compile(r"^(?:Classes|Glasses)[: ]?\s*(.+)$", re.I)
# "Learn Spell: <name>" on pet/mount/consumable items
RE_LEARN_SPELL = re.compile(r"^Learn Spell:\s*(.+)$", re.I)
# "Potion (Level 80)" -> type "Potion" + itemLevel 80
RE_POTION = re.compile(r"^Potion\s*\(\s*Level\s*(\d+)\s*\)$", re.I)
# "Mount : Description:" -> type "Mount" (the Description part is spurious)
RE_MOUNT = re.compile(r"^Mount\s*:?\s*Description", re.I)
# "Duration: 1 hour" / "Duration: 45 minutes" -> duration
RE_DURATION = re.compile(r"^Duration:?\s*(\d+)\s*(hour|hours|minute|minutes|second|seconds)$", re.I)
# "Must be used out of combat" -> boolean
RE_OUT_OF_COMBAT = re.compile(r"^Must be used out of combat$", re.I)
# linked-spell metadata (lives above the first Binds line; OCR cache only)
RE_TARGETING = re.compile(r"Targeting Mode\s+(.+)$", re.I)
RE_CASTING = re.compile(r"Casting Time\s+(.+)$", re.I)
RE_RECAST = re.compile(r"Recast\s+(.+)$", re.I)
# "Companions" (pet type line) / "Generic" (misc type line)
# "Companions eae" is OCR junk after the type token; strip to "Companion".
RE_COMPANIONS = re.compile(r"^Companions\b", re.I)
RE_GENERIC = re.compile(r"^Generic$", re.I)
RE_CONSUMABLE = re.compile(r"^Consumable$", re.I)
# "Mana Potions" / "Stamina Potions" following a percent attribute (rune stone)
RE_POTION_TARGET = re.compile(r"^([A-Za-z ]+ Potions)$")
# "Description" header introducing a description block
RE_DESC_HEADER = re.compile(r"^Description:?$", re.I)
# gem subtype line: "Hyperborean Gem" / "White Hand Gem" (known kinds only,
# so item names like "Fatal Hyperborean Hierophant Gem" never match)
RE_GEM_KIND = re.compile(r"^(Hyperborean|White Hand) Gem$")
# gem tier bonuses: "Tier 10: +150 Heal Rating" / "Tier 10: Chance on damage, ..."
RE_TIER = re.compile(r"^Tier\s*(\d+):\s*(.+)$", re.I)
# "Type - Slot(s)" lines the parser missed (leading junk / OCR'd type token)
RE_TYPE_SLOT = re.compile(r"^\s*(.+?)\s*-\s*([A-Za-z][A-Za-z, ]+)$")
# OCR-mangled variant: "Medium: Armor = Head"
RE_TYPE_SLOT_COLON = re.compile(r"^\s*(Medium|Light|Heavy|Cloth|Full Plate):\s*Armor\s*=\s*(.+)$", re.I)
# proc effects: "Chance on damage, Defiling Strike on target, 3 Procs per Minute"
RE_PROC = re.compile(
    r"^Chance\s+(on damage|of getting damage|of getting darnage|of getting darmage|"
    r"on receiving spell damage|on receiving spell darnage|on receiving spell darmage),\s*"
    r"(?:([^,]*?)\s+)?(?:on|an)\s+(self|target),\s*(\d+)\s+"
    r"(Procs per Minute|percent chance)$", re.I)

# signed attribute keys the dataset didn't know about but that are real
# (verified against the tooltip screenshot: the Hyrkanian mounts)
KNOWN_EXTRA = frozenset(("staggering chance",))

# one-off fixes for lines whose OCR mangled the value beyond a pattern
# (verified against the tooltip screenshots)
MANGLED_ATTR_FIXES = {
    # "S00 P¥P Hit Rating" -> the S00 is a misread 500, negative (screenshot)
    "S00 P\u00a5P Hit Rating": ("pvp hit rating", -500),
}

# OCR manglings in proc spell names (verified against the tooltip screenshots)
PROC_SPELL_FIXES = {
    "Sacrarisl Guard": "Sacrarial Guard",
    "Sacraris| Guard": "Sacrarial Guard",
    "Flar Strike": "Flaring Strike",
    "strike": "Gelid Strike",          # Soulsplitter
    "7 Re 2": "Scalding Revenge",      # Ring of Scalding
}
# procs whose spell name OCR dropped entirely, keyed by the full line
# (verified per screenshot)
PROC_MISSING_SPELL = {
    "Chance on receiving spell damage, on self, 1 percent chance": "Scalding Revenge",
}
PROC_TRIGGER_FIXES = {
    "of getting darnage": "of getting damage",
    "of getting darmage": "of getting damage",
    "on receiving spell darnage": "on receiving spell damage",
    "on receiving spell darmage": "on receiving spell damage",
}

# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------


def known_attr_keys(data):
    """Attribute property keys already present in the dataset."""
    keys = set()
    for section in data["sections"]:
        for loc in section.get("locations", []):
            for cat in loc.get("categories", []):
                for set_ in cat.get("sets", []):
                    for item in set_.get("items", []):
                        stats = item.get("stats")
                        if not stats:
                            continue
                        for entry in stats.get("attributes", []):
                            keys.update(entry)
    return keys


def is_known_attr(key, known):
    return key in known or key in KNOWN_EXTRA or any(h in key for h in ATTR_TAIL_HINTS)


def parse_dps_number(num):
    """'35,9' -> 35.9 (European comma decimal)."""
    return float(num.replace(",", "."))


def parse_duration(text):
    """Parse '1 hour' / '45 minutes' / '10 seconds' -> Duration dict or None."""
    m = re.match(r"^([\d.]+)\s*(hour|hours|minute|minutes|second|seconds)$",
                 text.strip(), re.I)
    if not m:
        return None
    value = float(m.group(1))
    value = int(value) if value.is_integer() else value
    unit = m.group(2).lower()
    if unit.startswith("hour"):
        return {"hours": value}
    if unit.startswith("minute"):
        return {"minutes": value}
    return {"seconds": value}


def extract_spell_metadata(stats, cache_entry):
    """Recover linked-spell metadata dropped by the parser as pre-binds noise.

    Pet/mount/consumable tooltips begin with the linked spell's box
    ("Targeting Mode ...", "Casting Time ...", "Recast ...") before the item's
    own "Binds ..." line; the parser discards everything above the binds line.
    Re-read those fields from the OCR cache's raw tooltip text.
    """
    if not cache_entry or not cache_entry.get("tooltip"):
        return 0
    changed = 0
    for raw in cache_entry["tooltip"].split("\n"):
        bare = _strip_decor(raw)
        if not bare:
            continue
        m = RE_TARGETING.search(bare)
        if m and not stats.get("targetingMode"):
            stats["targetingMode"] = m.group(1).strip()
            changed += 1
            continue
        m = RE_CASTING.search(bare)
        if m and not stats.get("castingTime"):
            dur = parse_duration(m.group(1))
            if dur:
                stats["castingTime"] = dur
                changed += 1
            continue
        m = RE_RECAST.search(bare)
        if m and not stats.get("recast"):
            dur = parse_duration(m.group(1))
            if dur:
                stats["recast"] = dur
                changed += 1
            continue
        m = RE_DURATION.match(bare)
        if m and not stats.get("duration"):
            dur = parse_duration(f"{m.group(1)} {m.group(2)}")
            if dur:
                stats["duration"] = dur
                changed += 1
            continue
    return changed


def clean_learn_spell(line, item_name):
    """Canonical spell name from a \"Learn Spell: ...\" line.

    Pet/mount/companion items teach the spell they are named after, so the
    item name is the ground truth for OCR-truncated spell text (\"Idol of
    Ya\" -> \"Idol of Yag\") and for description text merged onto the line
    (Path of the Enlightened). When the tooltip text names a different spell
    (\"Companion: Dust Fiend\" on a Mini-Pet item) the tooltip text wins.
    """
    spell = re.sub(r"^Learn Spell:\s*", "", line, flags=re.I).strip()
    spell = re.sub(r"[\s|_'.\u2019]+", " ", spell).strip()
    if not item_name:
        return spell

    def norm(s):
        return re.sub(r"[^a-z0-9]", "", s.lower())

    ns, ni = norm(spell), norm(item_name)
    if ni and (ns.startswith(ni) or ni.startswith(ns)):
        return item_name.strip()
    return spell


def parse_proc(line):
    """Parse a \"Chance ...\" line into a Proc dict, or None.

    Returns None only when the line isn't a proc-shaped line at all; malformed
    procs whose spell OCR dropped are repaired via PROC_MISSING_SPELL.
    """
    m = RE_PROC.match(line)
    if not m:
        return None
    trigger, spell, target, rate, unit = m.groups()
    trigger = PROC_TRIGGER_FIXES.get(trigger, trigger)
    spell = (spell or "").strip()
    if not spell:
        spell = PROC_MISSING_SPELL.get(line)
    spell = PROC_SPELL_FIXES.get(spell, spell)
    if not spell:
        return None
    return {
        "trigger": trigger,
        "spell": spell,
        "target": target,
        "rate": int(rate),
        "rateUnit": "ppm" if unit.lower().startswith("procs") else "percent",
    }


def parse_tier_payload(payload, known):
    """Classify a \"Tier N: <payload>\" payload into (kind, entry) or None.

    kind is "values" / "attributes" / "procs"; entry is the single-item
    StatValue / Proc to append to the tier bonus.
    """
    proc = parse_proc(payload)
    if proc is not None:
        return "procs", proc

    m = RE_PERCENT_ATTR.match(payload)
    if m:
        key = _norm_attr_name(m.group(3))
        if is_known_attr(key, known):
            value = float(m.group(2))
            value = int(value) if value.is_integer() else value
            if m.group(1) == "-":
                value = -value
            return "attributes", {key: {"percent": value}}
        return None

    m = RE_VALUE_CRIT.match(payload)
    if m:
        return "values", {"critigation": int(m.group(1))}

    m = RE_ATTR_SIGNED.match(payload)
    if m:
        key = _norm_attr_name(m.group(3))
        if is_known_attr(key, known):
            value = float(m.group(2))
            value = int(value) if value.is_integer() else value
            if m.group(1) == "-":
                value = -value
            return "attributes", {key: value}
        return None

    return None


# ---------------------------------------------------------------------------
# tooltip-order re-ordering (keeps the in-game line order faithful)
# ---------------------------------------------------------------------------


# tooltip-tokenizer value regexes tolerate a '?' inside the digit run
# ("227? Armor") — such lines match by key alone with value None
RE_VALUE_ARMOR_Q = re.compile(r"^(\d+\??)\s*Armor$", re.I)
RE_VALUE_CRIT_Q = re.compile(r"^(\d+\??)\s*Critigation\s*Amount$", re.I)
RE_VALUE_SLOTS_Q = re.compile(r"^(\d+\??)\s*additional\s*slots$", re.I)


def tooltip_tokens(cache_entry):
    """Ordered (kind, key, value) tokens from the raw tooltip text, or None.

    kind is "values" or "attributes". Value lines whose digit OCR'd as
    '?' carry value None (matched by key only — a value key appears at most
    once per item); attribute lines with '?' digits are skipped for matching
    (their keys can repeat, so key-only matching would be unsafe).
    """
    if not cache_entry or not cache_entry.get("tooltip"):
        return None
    lines = cache_entry["tooltip"].split("\n")
    first_binds = next((i for i, ln in enumerate(lines) if RE_BINDS.match(ln)), None)
    tokens = []
    for i, ln in enumerate(lines):
        if first_binds is not None and i < first_binds:
            continue
        bare = _strip_decor(ln)
        if not bare:
            continue
        # raw tooltip lines carry frame/leading junk ("(231 Armor",
        # "fe 52 …") that _strip_decor doesn't remove; drop anything that
        # isn't a sign or digit before classifying.
        bare = re.sub(r"^[^+\-\d]+", "", bare)
        if not bare:
            continue
        m = RE_VALUE_ARMOR_Q.match(bare)
        if m:
            tokens.append(("values", "armor",
                           int(m.group(1)) if "?" not in m.group(1) else None))
            continue
        m = RE_VALUE_CRIT_Q.match(bare)
        if m:
            tokens.append(("values", "critigation",
                           int(m.group(1)) if "?" not in m.group(1) else None))
            continue
        m = RE_VALUE_SLOTS_Q.match(bare)
        if m:
            tokens.append(("values", "additional slots",
                           int(m.group(1)) if "?" not in m.group(1) else None))
            continue
        if "?" in bare:
            continue  # attribute digit unreadable -> cannot match safely
        m = RE_PERCENT_ATTR.match(bare)
        if m:
            value = float(m.group(2))
            value = int(value) if value.is_integer() else value
            if m.group(1) == "-":
                value = -value
            tokens.append(("attributes", _norm_attr_name(m.group(3)),
                           {"percent": value}))
            continue
        m = RE_ATTR_SIGNED.match(bare)
        if m:
            value = float(m.group(2))
            value = int(value) if value.is_integer() else value
            if m.group(1) == "-":
                value = -value
            tokens.append(("attributes", _norm_attr_name(m.group(3)), value))
    return tokens


def reorder_by_tooltip(stats, cache_entry):
    """Re-order stats.values / stats.attributes to match the tooltip text.

    Entries not found in the tooltip keep their relative order (appended after
    the matched ones, in original order). Value tokens whose digit was '?' in
    the tooltip match by key alone.
    """
    tokens = tooltip_tokens(cache_entry)
    if tokens is None:
        return

    def order_for(kind, key, value):
        for idx, (k, tk, tv) in enumerate(tokens):
            if k == kind and tk == key and (tv is None or tv == value):
                tokens[idx] = (k, None, None)  # consume
                return idx
        return None

    for kind, field in (("values", "values"), ("attributes", "attributes")):
        entries = stats.get(field)
        if not entries:
            continue
        keyed = []
        for entry in entries:
            for key, value in entry.items():
                keyed.append((key, value))
        order = []
        for key, value in keyed:
            pos = order_for(kind, key, value)
            order.append((pos if pos is not None else 1 << 30, key, value))
        # stable sort: matched entries keep tooltip order, unmatched keep input
        # order after them (1 << 30 for all unmatched preserves insertion order)
        order.sort(key=lambda t: (t[0],))
        stats[field] = [{key: value} for _, key, value in order]


# ---------------------------------------------------------------------------
# the structure pass
# ---------------------------------------------------------------------------


def scrub_stats(stats, known, cache_entry=None, name=None):
    """Move clean lines into props. Returns (changes, report dict)."""
    if not stats:
        return 0, {}
    changed = 0
    kept = []
    in_desc_block = False
    report = {"values": [], "attributes": [], "dps": [], "itemLevel": [],
              "classes": [], "type": [], "vendor": [], "procs": [],
              "learnSpell": [], "tier": [], "duration": [], "gemKind": [],
              "mustBeUsedOutOfCombat": [], "castingTime": [], "recast": [],
              "potionTarget": [], "descHeader": [], "descBlock": [],
              "nameEcho": [], "descEcho": [],
              "unsigned": [], "unknown": [], "question": [], "junk": []}

    for raw in stats.get("lines", []):
        bare = _strip_decor(raw)
        if not bare:
            continue

        # redundant item-name echo (OCR'd name line that the parser's
        # name-drop missed, e.g. "Entropy" on the Entropy talisman)
        if name and _norm_name(bare) == _norm_name(name):
            changed += 1
            report["nameEcho"].append(bare)
            continue

        # '?' digits -> screenshot review (leave in lines)
        if "?" in bare:
            report["question"].append(bare)
            kept.append(raw)
            continue

        m = RE_VALUE_ARMOR.match(bare)
        if m and not any("armor" in v for v in stats.get("values", [])):
            stats.setdefault("values", []).append({"armor": int(m.group(1))})
            changed += 1
            report["values"].append(bare)
            continue
        m = RE_VALUE_CRIT.match(bare)
        if m and not any("critigation" in v for v in stats.get("values", [])):
            stats.setdefault("values", []).append({"critigation": int(m.group(1))})
            changed += 1
            report["values"].append(bare)
            continue
        m = RE_VALUE_SLOTS.match(bare)
        if m and not any("additional slots" in v for v in stats.get("values", [])):
            stats.setdefault("values", []).append({"additional slots": int(m.group(1))})
            changed += 1
            report["values"].append(bare)
            continue

        m = RE_DPS.match(bare)
        if m and not stats.get("dps"):
            stats["dps"] = parse_dps_number(m.group(1))
            stats["damage"] = {"min": int(m.group(2)), "max": int(m.group(3))}
            changed += 1
            report["dps"].append(bare)
            continue

        m = RE_PERCENT_ATTR.match(bare)
        if m:
            key = _norm_attr_name(m.group(3))
            if is_known_attr(key, known):
                value = float(m.group(2))
                value = int(value) if value.is_integer() else value
                if m.group(1) == "-":
                    value = -value
                stats.setdefault("attributes", []).append({key: {"percent": value}})
                changed += 1
                report["attributes"].append(bare)
            else:
                report["unknown"].append(bare)
                kept.append(raw)
            continue

        m = RE_ATTR_SIGNED.match(bare)
        if m:
            key = _norm_attr_name(m.group(3))
            if is_known_attr(key, known):
                value = float(m.group(2))
                value = int(value) if value.is_integer() else value
                if m.group(1) == "-":
                    value = -value
                stats.setdefault("attributes", []).append({key: value})
                changed += 1
                report["attributes"].append(bare)
            else:
                report["unknown"].append(bare)
                kept.append(raw)
            continue

        # one-off OCR-mangled attribute values (screenshot-verified)
        fixed = MANGLED_ATTR_FIXES.get(bare)
        if fixed:
            key, value = fixed
            stats.setdefault("attributes", []).append({key: value})
            changed += 1
            report["attributes"].append(bare)
            continue

        m = RE_PERCENT_SENTENCE.match(bare)
        if m:
            key = _norm_attr_name(m.group(1))
            if is_known_attr(key, known):
                value = float(m.group(2))
                value = int(value) if value.is_integer() else value
                stats.setdefault("attributes", []).append({key: {"percent": value}})
                changed += 1
                report["attributes"].append(bare)
            else:
                report["unknown"].append(bare)
                kept.append(raw)
            continue

        m = RE_ATTR_UNSIGNED.match(bare)
        if m:
            key = _norm_attr_name(m.group(2))
            if is_known_attr(key, known):
                # sign is ambiguous (+/-) -> human decision, keep in lines
                report["unsigned"].append(bare)
                kept.append(raw)
                continue

        m = RE_ITEM_LEVEL.match(bare)
        if m and "itemLevel" not in stats:
            stats["itemLevel"] = int(m.group(1))
            changed += 1
            report["itemLevel"].append(bare)
            continue

        # class restriction: "Classes: Necromancer, ..." / OCR "Glasses:"
        m = RE_CLASSES.match(bare)
        if m and not stats.get("classes"):
            stats["classes"] = [
                CLASS_OCR_FIXES.get(c.strip(), c.strip())
                for c in m.group(1).split(",") if c.strip()
            ]
            changed += 1
            report["classes"].append(bare)
            continue

        # "Learn Spell: <name>" on pet/mount/consumable items
        m = RE_LEARN_SPELL.match(bare)
        if m and not stats.get("learnSpell"):
            stats["learnSpell"] = clean_learn_spell(bare, name)
            changed += 1
            report["learnSpell"].append(bare)
            continue

        # "Potion (Level 80)" -> type "Potion" + itemLevel 80
        m = RE_POTION.match(bare)
        if m:
            if "itemLevel" not in stats:
                stats["itemLevel"] = int(m.group(1))
            if not stats.get("type"):
                stats["type"] = "Potion"
            changed += 1
            report["type"].append(bare)
            continue

        # "Duration: 1 hour" / "Duration: 45 minutes" -> duration
        m = RE_DURATION.match(bare)
        if m:
            amount = int(m.group(1))
            unit = "hours" if m.group(2).startswith("hour") else "minutes"
            stats["duration"] = {unit: amount}
            changed += 1
            report["duration"].append(bare)
            continue

        # "Must be used out of combat" -> boolean
        m = RE_OUT_OF_COMBAT.match(bare)
        if m:
            stats["mustBeUsedOutOfCombat"] = True
            changed += 1
            report["mustBeUsedOutOfCombat"].append(bare)
            continue

        # linked-spell metadata lines (Furious Spirit keeps them in lines)
        m = RE_CASTING.search(bare)
        if m and not stats.get("castingTime"):
            dur = parse_duration(m.group(1))
            if dur:
                stats["castingTime"] = dur
                changed += 1
                report["castingTime"].append(bare)
                continue
        m = RE_RECAST.search(bare)
        if m and not stats.get("recast"):
            dur = parse_duration(m.group(1))
            if dur:
                stats["recast"] = dur
                changed += 1
                report["recast"].append(bare)
                continue

        # potion-target lines on a rune stone: "Mana Potions" / "Stamina Potions"
        # attach to the "+10% Increase to damage or healing" potion effect
        m = RE_POTION_TARGET.match(bare)
        if m:
            target = m.group(1).strip()
            attached = False
            for entry in reversed(stats.get("attributes", [])):
                for key, value in entry.items():
                    if (isinstance(value, dict) and "percent" in value
                            and "healing" in key):
                        value.setdefault("appliesTo", []).append(target)
                        changed += 1
                        report["potionTarget"].append(bare)
                        attached = True
                        break
                if attached:
                    break
            if attached:
                continue

        # "Description" header introducing a description block
        m = RE_DESC_HEADER.match(bare)
        if m:
            in_desc_block = True
            changed += 1
            report["descHeader"].append(bare)
            continue
        if in_desc_block:
            # everything after the "Description" header is description prose
            stats.setdefault("description", []).append(raw)
            changed += 1
            report["descBlock"].append(bare)
            continue

        # "Mount : Description:" -> type "Mount"
        m = RE_MOUNT.match(bare)
        if m and not stats.get("type"):
            stats["type"] = "Mount"
            changed += 1
            report["type"].append(bare)
            continue

        # "Companions" -> type "Companion" (pet items; description follows)
        m = RE_COMPANIONS.match(bare)
        if m and not stats.get("type"):
            stats["type"] = "Companion"
            changed += 1
            report["type"].append(bare)
            continue

        # "Generic" -> type "Generic" (misc/vanity items)
        m = RE_GENERIC.match(bare)
        if m and not stats.get("type"):
            stats["type"] = "Generic"
            changed += 1
            report["type"].append(bare)
            continue

        # "Consumable" -> type "Consumable" (books, caches, teaching items)
        m = RE_CONSUMABLE.match(bare)
        if m and not stats.get("type"):
            stats["type"] = "Consumable"
            changed += 1
            report["type"].append(bare)
            continue

        # gem subtype line: "Hyperborean Gem" / "White Hand Gem"
        m = RE_GEM_KIND.match(bare)
        if m and not stats.get("gemKind"):
            stats["gemKind"] = m.group(1).strip()
            changed += 1
            report["gemKind"].append(bare)
            continue

        # gem tier bonuses: "Tier 10: +150 Heal Rating"
        m = RE_TIER.match(bare)
        if m:
            kind_entry = parse_tier_payload(m.group(2), known)
            if kind_entry is not None:
                kind, entry = kind_entry
                tier = int(m.group(1))
                bonus = stats.setdefault("tierBonuses", {}).setdefault(
                    tier, {"values": [], "attributes": [], "procs": []})
                bonus.setdefault(kind, []).append(entry)
                changed += 1
                report["tier"].append(bare)
                continue

        # type - slot lines the parser missed (OCR'd type token / junk prefix)
        m = RE_TYPE_SLOT.match(bare)
        if m and not stats.get("type"):
            t = _clean_type_token(m.group(1))
            if t in TYPE_TOKENS:
                slots = [s.strip() for s in m.group(2).split(",") if s.strip()]
                stats["type"] = t
                if slots:
                    stats["slots"] = slots
                changed += 1
                report["type"].append(bare)
                continue
        m = RE_TYPE_SLOT_COLON.match(bare)
        if m and not stats.get("type"):
            armor_kind = m.group(1)
            slot = m.group(2).strip()
            stats["type"] = armor_kind + " Armor"
            stats["slots"] = [slot]
            changed += 1
            report["type"].append(bare)
            continue

        # proc effects: "Chance on damage, X on target, 3 Procs per Minute"
        proc = parse_proc(bare)
        if proc is not None:
            stats.setdefault("procs", []).append(proc)
            changed += 1
            report["procs"].append(bare)
            continue

        # "Vendor Price ..." echo (parser missed the OCR-mangled prefix)
        if not stats.get("vendorPrice"):
            price, reason = parse_price_line(bare)
            if price is not None:
                stats["vendorPrice"] = price
                changed += 1
                report["vendor"].append(bare)
                continue

        report["junk"].append(bare)
        kept.append(raw)

    # Pet items: the "Companions" type line is followed by the description
    # prose (and often a spurious "Description:" header). Everything after
    # the header is description prose — move it all into stats.description.
    # ("Companions eae" is an OCR-garbled type token the parser captured.)
    if stats.get("type", "").startswith("Companions") and kept:
        stats["type"] = "Companion"
        desc = stats.setdefault("description", [])
        rest = []
        for ln in kept:
            bare = _strip_decor(ln)
            low = bare.lower().strip()
            if low in ("description", "description:", "desc:"):
                changed += 1
                continue  # spurious header, drop
            desc.append(ln)
            changed += 1
        kept = rest

    # A line that only restates words already captured in stats.description
    # is a run-on OCR echo of the description block (e.g. Path of the
    # Enlightened duplicates its own description) — drop it.
    if stats.get("description") and kept:
        desc_words = set(re.findall(r"[a-z']+", " ".join(stats["description"]).lower()))
        rest = []
        for ln in kept:
            words = set(re.findall(r"[a-z']+", _strip_decor(ln).lower()))
            if words and words <= desc_words:
                changed += 1
                report["descEcho"].append(_strip_decor(ln))
                continue
            rest.append(ln)
        kept = rest

    # Gem subtype fallback: the "White Hand Gem" line was consumed by the
    # parser (not in lines) for the White Hand gems; the item name still
    # names the kind ("White Hand Gem of Holy Storm").
    if not stats.get("gemKind") and name:
        km = re.search(r"(Hyperborean|White Hand) Gem", name)
        if km:
            stats["gemKind"] = km.group(1)
            changed += 1

    # linked-spell metadata (Targeting Mode / Casting Time / Recast) sits above
    # the first Binds line in pet/mount/consumable tooltips and was dropped by
    # the parser; recover it from the OCR cache's raw tooltip text.
    if cache_entry is not None:
        changed += extract_spell_metadata(stats, cache_entry)

    stats["lines"] = kept
    if changed and cache_entry is not None:
        reorder_by_tooltip(stats, cache_entry)
    return changed, report


def iter_items(data, with_path=False):
    """Yield items (or (section, loc, cat, set_, item) when with_path=True)."""
    for section in data["sections"]:
        for loc in section.get("locations", []):
            for cat in loc.get("categories", []):
                for set_ in cat.get("sets", []):
                    for item in set_.get("items", []):
                        if with_path:
                            yield section, loc, cat, set_, item
                        else:
                            yield item


def main():
    with open(SRC_DATA, encoding="utf-8") as fh:
        data = json.load(fh)
    known = known_attr_keys(data)

    with open(CACHE, encoding="utf-8") as fh:
        cache = json.load(fh)

    totals = {k: [] for k in ("values", "attributes", "dps", "itemLevel",
                              "classes", "type", "vendor", "procs", "learnSpell",
                              "tier", "duration", "gemKind",
                              "mustBeUsedOutOfCombat", "castingTime", "recast",
                              "potionTarget", "descHeader", "descBlock", "nameEcho", "descEcho",
                              "unsigned", "unknown", "question", "junk")}
    items_touched = 0
    changes = 0
    for item in iter_items(data):
        stats = item.get("stats")
        if not stats:
            continue
        entry = cache.get("items", {}).get(str(item["id"]))
        n, rep = scrub_stats(stats, known, entry, item.get("name"))
        if n:
            items_touched += 1
            changes += n
        for k, v in rep.items():
            totals[k].extend(v)

    # keep the OCR cache's parsed stats in sync (so --merge doesn't revert)
    names = {str(it["id"]): it.get("name") for it in iter_items(data)}
    cache_touched = 0
    for key, entry in cache.get("items", {}).items():
        # pass the entry itself so extract_spell_metadata can read its tooltip
        n, _rep = scrub_stats(entry.get("stats"), known, cache_entry=entry,
                              name=names.get(key))
        if n:
            cache_touched += 1
    # (cache entries share stats objects with the data via url_entry, so the
    # data-level pass above already updated most of them; this catches stragglers)

    data["meta"]["generated"] = time.strftime("%Y-%m-%dT%H:%M:%S")
    with open(SRC_DATA, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=1)

    # app dataset: minified and without the raw tooltip text (the React app
    # renders from stats only; research/armory_data.json + tooltips.json keep
    # the raw OCR text as ground truth for re-parsing)
    app = copy.deepcopy(data)
    for item in iter_items(app):
        item.pop("tooltip", None)
    os.makedirs(os.path.dirname(APP_DATA), exist_ok=True)
    with open(APP_DATA, "w", encoding="utf-8") as fh:
        json.dump(app, fh, ensure_ascii=False, separators=(",", ":"))
    with open(CACHE, "w", encoding="utf-8") as fh:
        json.dump(cache, fh, ensure_ascii=False, indent=1)

    print(f"known attribute keys: {len(known)}")
    print(f"items touched: {items_touched}")
    print(f"total changes: {changes}")
    print(f"cache entries touched: {cache_touched}")
    print("\n-- moved into props --")
    for k in ("values", "attributes", "dps", "itemLevel", "classes", "type",
              "vendor", "procs", "learnSpell", "tier", "duration", "gemKind"):
        lines = totals[k]
        print(f"{k}: {len(lines)}")
        for ln in sorted(set(lines))[:60]:
            print(f"    {ln}")
        if len(set(lines)) > 60:
            print(f"    ... and {len(set(lines)) - 60} more")
    print("\n-- LEFT in stats.lines --")
    # Recount from the mutated data: post-loop rules (companion prose,
    # description echoes) can drop lines after the per-line junk tally, so
    # the loop totals above would over-count.
    final_lines = []
    for item in iter_items(data):
        stats = item.get("stats") or {}
        final_lines.extend(stats.get("lines", []))
    print(f"total lines remaining after all rules ({len(final_lines)}):")
    for ln in sorted(set(_strip_decor(l) for l in final_lines)):
        print(f"    {ln}")
    print(f"\nwrote {SRC_DATA}")
    print(f"wrote {APP_DATA}")
    print(f"wrote {CACHE}")


if __name__ == "__main__":
    main()
