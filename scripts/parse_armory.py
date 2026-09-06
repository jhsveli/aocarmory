#!/usr/bin/env python3
"""Parse archived AoC Armory HTML into a clean JSON data model.

Produces research/armory_data.json:
  sections: [{id, name, locations: [{name, coords, type, categories:
             [{name, sets: [{name, classes, builder, items:
             [{id, name, rarity, slot, price, drop, image}]}]}]}]}]
  classes:  [{name, sets: [{section, set, builder}]}]   (from armorsets page)
  meta:     counts + source info
"""
import html
import json
import os
import re

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SECTIONS_DIR = os.path.join(BASE, "research", "sections")
PAGES_DIR = os.path.join(BASE, "research", "pages")
OUT = os.path.join(BASE, "research", "armory_data.json")

SLOTS = {
    "head", "shoulder", "chest", "hands", "belt", "legs", "feet", "wrist",
    "back", "necklace", "ring", "1hb", "1he", "1heranger", "2hb", "2he",
    "bow", "crossbow", "dagger", "talisman", "polearm", "staff",
    "ammunition", "shield",
}

# Item-kind tokens from the HTML that are NOT worn equipment slots (mounts,
# consumables, potions, pets, backpacks, generic items). These stay slot-less;
# the tooltip provides their type instead (e.g. "Consumable").
NON_SLOT_TOKENS = frozenset(("mount", "consumable", "potion", "pet", "generic", "backpack"))

# NOTE: Item.slot was removed from the data model — slot info is derived from
# the tooltip stats (see armory/src/lib/equip.ts). The SLOTS/NON_SLOT_TOKENS
# sets above are kept only to document the original HTML slot tokens.
RARITIES = {"Mundane", "Superior", "Enchanted", "Rare", "Epic", "Legendary"}

# ---------------------------------------------------------------------------
# minimal tree builder
# ---------------------------------------------------------------------------

VOID_ELEMENTS = {"area", "base", "br", "col", "embed", "hr", "img",
                "input", "link", "meta", "param", "source", "track", "wbr"}


def build_tree(src: str):
    """Return a list of top-level node dicts: {tag, attrs, text, children}."""
    # strip scripts/styles first so their text doesn't pollute
    src = re.sub(r"<script.*?</script>", "", src, flags=re.S | re.I)
    src = re.sub(r"<style.*?</style>", "", src, flags=re.S | re.I)

    tokens = re.findall(
        r"<!--.*?-->|<![^>]*>|</?\s*[a-zA-Z][^>]*>|[^<]+", src, flags=re.S)

    root_children = []
    stack = []  # list of node dicts
    pending_text = ""

    def flush_text():
        nonlocal pending_text
        if pending_text:
            t = html.unescape(pending_text)
            if stack:
                stack[-1]["children"].append(t)
                stack[-1]["text"] += t
            else:
                root_children.append(t)
            pending_text = ""

    for tok in tokens:
        if tok.startswith("<!--") or tok.startswith("<!"):
            continue
        if tok.startswith("</"):
            flush_text()
            if stack:
                stack.pop()
            continue
        if tok.startswith("<"):
            flush_text()
            self_closing = tok.rstrip().endswith("/>")
            m = re.match(r"<\s*([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>", tok)
            if not m:
                continue
            tag, attrs_s = m.groups()
            attrs = {}
            for am in re.finditer(
                    r"([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:\"([^\"]*)\"|'([^']*)'|([^\s>]+))",
                    attrs_s):
                attrs[am.group(1)] = am.group(2) or am.group(3) or am.group(4) or ""
            node = {"tag": tag.lower(), "attrs": attrs, "text": "", "children": []}
            if stack:
                stack[-1]["children"].append(node)
            else:
                root_children.append(node)
            if not (self_closing or tag.lower() in VOID_ELEMENTS):
                stack.append(node)
            continue
        # plain text
        pending_text += tok
    flush_text()
    return root_children


def walk(node, tag=None, cls=None):
    """Yield nodes matching tag and/or css class (deep-first)."""
    if not isinstance(node, dict):
        return
    if node.get("tag") == tag and (cls is None or cls in node["attrs"].get("class", "").split()):
        yield node
    for c in node.get("children", []):
        if isinstance(c, dict):
            yield from walk(c, tag, cls)

def direct_text(node):
    """Text directly inside node (not nested elements)."""
    out = []
    for c in node.get("children", []):
        if isinstance(c, str):
            out.append(c)
    return " ".join(" ".join(out).split())


def inner_text(node):
    """All descendant text, concatenated."""
    out = []
    stack = list(node.get("children", []))
    while stack:
        c = stack.pop()
        if isinstance(c, str):
            out.append(c)
        else:
            stack.extend(c.get("children", []))
    return " ".join(" ".join(out).split())


def first_link_text(node):
    """Text of the first <a> descendant (used for names)."""
    for a in walk(node, "a"):
        t = inner_text(a)
        if t:
            return t
    return None


# ---------------------------------------------------------------------------
# price parsing
# ---------------------------------------------------------------------------

# Coin image -> canonical price-currency key. Any coin not listed here keeps
# its image stem (without ".png") as the key, so Simple Trophies, Relics,
# badges, shards, copper/tin etc. are all preserved instead of being dropped.
COIN_KEYS = {
    "mark_of_acclaim.png": "mark",
    "rare_trophy.png": "trophy",
    "gold.png": "gold",
    "silver.png": "silver",
}


def coin_key(src: str) -> str:
    name = src.rsplit("/", 1)[-1]
    return COIN_KEYS.get(name, name[:-4] if name.endswith(".png") else name)


def parse_price(span: dict):
    """Extract the purchase price from a span.price node whose children
    interleave coin images with amounts, e.g. [img(mark), '980', img(gold),
    '12']. Any coin icon is accepted (the archive prices items in Simple
    Trophies, Relics, badges, copper/tin, ...). A silver coin followed by text
    marks a dungeon drop location instead — the site never prices in silver."""
    price = {}
    drop = None
    currency = None
    for c in span.get("children", []):
        if isinstance(c, str):
            val = c.strip()
            if not val:
                continue
            if currency == "silver":
                drop = val
            elif currency and val.isdigit():
                price[currency] = int(val)
            currency = None
            continue
        src = c.get("attrs", {}).get("src", "")
        currency = coin_key(src)
    return price, drop


# ---------------------------------------------------------------------------
# section page parsing
# ---------------------------------------------------------------------------

def find_content(tree):
    """Locate the #content div anywhere in the tree (fall back to body)."""
    stack = list(tree)
    while stack:
        node = stack.pop()
        if isinstance(node, dict):
            if node.get("tag") == "div" and "content" in node["attrs"].get("id", ""):
                return node
            stack.extend(node.get("children", []))
    for node in tree:
        if isinstance(node, dict) and node.get("tag") == "body":
            return node
    return None


def parse_section(sid: int, name: str, path: str):
    tree = build_tree(open(path, encoding="utf-8", errors="replace").read())
    content = find_content(tree)
    if content is None:
        return None

    locations = []
    for ul in walk(content, "ul", "locations"):
        for li in ul.get("children", []):
            if not isinstance(li, dict) or li.get("tag") != "li":
                continue
            li_cls = li["attrs"].get("class", "")
            loc = {"name": None, "coords": None, "type": None, "categories": []}
            for kind in ("merchant", "dungeon", "raid"):
                if kind in li_cls.split():
                    loc["type"] = kind
            # location name lives inside the first link (a > strong); coords in
            # the li's direct text, e.g. "(550,130)".
            loc["name"] = first_link_text(li)
            dt = direct_text(li)
            m = re.search(r"\((-?\d+,-?\d+)\)", dt)
            if m:
                loc["coords"] = m.group(1)

            for cat_ul in walk(li, "ul", "categories"):
                for cat_li in cat_ul.get("children", []):
                    if not isinstance(cat_li, dict) or cat_li.get("tag") != "li":
                        continue
                    cat = {"name": first_link_text(cat_li), "sets": []}
                    set_uls = list(walk(cat_li, "ul", "sets"))
                    item_uls = list(walk(cat_li, "ul", "items"))
                    if set_uls:
                        for set_ul in set_uls:
                            for set_li in set_ul.get("children", []):
                                if not isinstance(set_li, dict) or set_li.get("tag") != "li":
                                    continue
                                s = parse_set(set_li)
                                if s:
                                    cat["sets"].append(s)
                    elif item_uls:
                        # category lists items directly (no set grouping)
                        items = []
                        for item_ul in item_uls:
                            for item_li in item_ul.get("children", []):
                                if not isinstance(item_li, dict) or item_li.get("tag") != "li":
                                    continue
                                item = parse_item(item_li)
                                if item:
                                    items.append(item)
                        cat["sets"].append({"name": None, "classes": [], "builder": None, "items": items})
                    loc["categories"].append(cat)
            locations.append(loc)

    return {"id": sid, "name": name, "locations": locations}


def parse_set(set_li: dict):
    """Parse a set <li>: first link holds the name, direct text the class tags
    ([HoX] etc), an optional ab= link, and a nested ul.items."""
    set_ = {"name": None, "classes": [], "builder": None, "items": []}
    set_["name"] = first_link_text(set_li)
    dt = direct_text(set_li)
    classes = re.findall(r"\[([^\]]+)\]", dt)
    set_["classes"] = [c.strip() for c in classes]

    for a in walk(set_li, "a"):
        href = a["attrs"].get("href", "")
        if "ab=" in href:
            m = re.search(r"ab=([^&\s]+)", href)
            set_["builder"] = m.group(1) if m else href

    for item_ul in walk(set_li, "ul", "items"):
        for item_li in item_ul.get("children", []):
            if not isinstance(item_li, dict) or item_li.get("tag") != "li":
                continue
            item = parse_item(item_li)
            if item:
                set_["items"].append(item)
    return set_


def parse_item(item_li: dict):
    """Parse an item <li>: optional price span + <a class='Rarity'>Name</a>."""
    item = {"id": None, "name": None, "rarity": None,
            "price": None, "drop": None, "image": None}
    # price span
    for span in walk(item_li, "span", "price"):
        price, drop = parse_price(span)
        if any(price.values()) or drop:
            item["price"] = price
            item["drop"] = drop
    # item link
    for a in walk(item_li, "a"):
        href = a["attrs"].get("href", "")
        cls = a["attrs"].get("class", "").split()
        aid = a["attrs"].get("id", "")
        if not aid.startswith("item-"):
            continue
        m = re.match(r"item-(\d+)-\d+", aid)
        if m:
            item["id"] = int(m.group(1))
        item["name"] = inner_text(a)
        for c in cls:
            if c in RARITIES:
                item["rarity"] = c
        if href:
            # normalize wayback-rewritten urls back to the live static host
            m = re.search(r"static\.is-better-than\.tv(/armory/[a-z0-9_()\-]+\.(?:jpg|png|gif))", href)
            if m:
                href = "https://static.is-better-than.tv" + m.group(1)
            elif href.startswith("//"):
                href = "https:" + href
        item["image"] = href or None
    if item["name"] is None and item["id"] is None:
        return None
    return item


# ---------------------------------------------------------------------------
# armorsets page parsing (class -> sets)
# ---------------------------------------------------------------------------

def parse_armorsets(path: str):
    tree = build_tree(open(path, encoding="utf-8", errors="replace").read())
    content = find_content(tree)
    if content is None:
        return []
    classes = []
    for fs in walk(content, "fieldset"):
        if fs["attrs"].get("id", "") == "armorySearchResult":
            continue
        legend = None
        for c in fs.get("children", []):
            if isinstance(c, dict) and c.get("tag") == "legend":
                legend = direct_text(c)
                break
        if not legend:
            continue
        cls = {"name": legend, "sets": []}
        for ul in fs.get("children", []):
            if not isinstance(ul, dict) or ul.get("tag") != "ul":
                continue
            for li in ul.get("children", []):
                if not isinstance(li, dict) or li.get("tag") != "li":
                    continue
                parts = direct_text(li).split("::")
                section = parts[0].strip() if parts else None
                set_name = None
                builder = None
                for a in walk(li, "a"):
                    set_name = direct_text(a)
                    href = a["attrs"].get("href", "")
                    m = re.search(r"ab=([^&\s]+)", href)
                    builder = m.group(1) if m else href
                if set_name:
                    cls["sets"].append({"section": section, "set": set_name, "builder": builder})
        classes.append(cls)
    return classes


# ---------------------------------------------------------------------------

def main():
    # Preserve the original site's section-menu order (from the archived nav).
    ORDER = [40, 36, 12, 1, 2, 3, 11, 4, 5, 6, 7, 8, 9, 10, 21, 22, 28, 23, 30,
             19, 25, 32, 33, 14, 15, 13, 24, 20, 35, 38, 31, 29, 16, 17, 18,
             39, 44, 45, -1]
    sections = []
    for sid in ORDER:
        fname = f"s{sid}.html"
        path = os.path.join(SECTIONS_DIR, fname)
        if not os.path.exists(path):
            print(f"missing {fname}")
            continue
        # name lookup: read the legend from the real section fieldset,
        # skipping the hidden search-results fieldset.
        name = None
        tree = build_tree(open(path, encoding="utf-8", errors="replace").read())
        for node in tree:
            if not isinstance(node, dict):
                continue
            for fs in walk(node, "fieldset"):
                if fs["attrs"].get("id", "") == "armorySearchResult":
                    continue
                for c in fs.get("children", []):
                    if isinstance(c, dict) and c.get("tag") == "legend":
                        name = direct_text(c)
                        break
                if name:
                    break
            if name:
                break
        if not name:
            name = f"Section {sid}"
        parsed = parse_section(sid, name, path)
        if parsed:
            sections.append(parsed)

    # armorsets
    classes = []
    ap = os.path.join(PAGES_DIR, "armorsets.html")
    if os.path.exists(ap):
        classes = parse_armorsets(ap)

    n_sets = sum(len(cat["sets"]) for s in sections for l in s["locations"] for cat in l["categories"])
    n_items = sum(len(set_["items"]) for s in sections for l in s["locations"]
                  for cat in l["categories"] for set_ in cat["sets"])

    # Unique counts (what the original home page stats showed): unique item
    # ids across the DB, and distinct set names.
    item_ids = {it["id"] for s in sections for l in s["locations"]
                for cat in l["categories"] for set_ in cat["sets"] for it in set_["items"] if it["id"]}
    set_names = {set_["name"] for s in sections for l in s["locations"]
                 for cat in l["categories"] for set_ in cat["sets"] if set_["name"]}

    data = {
        "sections": sections,
        "classes": classes,
        "meta": {
            "sections": len(sections),
            "sets": n_sets,
            "uniqueSets": len(set_names),
            "items": n_items,
            "uniqueItems": len(item_ids),
            "generated": __import__("datetime").datetime.now().isoformat(timespec="seconds"),
        },
    }
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=1)
    print(f"wrote {OUT}")
    print(f"sections={len(sections)} sets={n_sets} items={n_items} classes={len(classes)}")


if __name__ == "__main__":
    main()
