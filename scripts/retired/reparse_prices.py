#!/usr/bin/env python3
"""Re-derive every item's price/drop from the archived section HTML using the
full coin set and patch the two armory_data.json copies in place.

parse_price used to recognize only mark_of_acclaim / rare_trophy / gold /
silver, silently dropping the rest of the coins the site listed items in
(Simple Trophies I-III, Simple Relics I-VI, Rare/Mythical Relics, campaign
badges, conquest trophies, copper, tin, ...). This rewrites the price and drop
fields by item id (the HTML anchor ids match the JSON ids) so no purchase
price is lost.
"""
import json
import os
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(BASE, "scripts"))
import parse_armory as pa  # noqa: E402

# Same order the site's own section menu used (see parse_armory.main).
ORDER = [40, 36, 12, 1, 2, 3, 11, 4, 5, 6, 7, 8, 9, 10, 21, 22, 28, 23, 30,
         19, 25, 32, 33, 14, 15, 13, 24, 20, 35, 38, 31, 29, 16, 17, 18,
         39, 44, 45, -1]

TARGETS = [
    os.path.join(BASE, "research", "armory_data.json"),
    os.path.join(BASE, "armory", "src", "data", "armory_data.json"),
]


def scrape_prices():
    """item id -> {price, drop} from every archived section page."""
    by_id = {}
    for sid in ORDER:
        path = os.path.join(BASE, "research", "sections", f"s{sid}.html")
        if not os.path.exists(path):
            continue
        section = pa.parse_section(sid, f"s{sid}", path)
        if not section:
            continue
        for loc in section["locations"]:
            for cat in loc["categories"]:
                for set_ in cat["sets"]:
                    for item in set_["items"]:
                        if item["id"] is None:
                            continue
                        # an empty price dict means drop-only (silver marker):
                        # keep the drop but don't store an empty price object
                        price = item["price"]
                        by_id[item["id"]] = {
                            "price": price if price else None,
                            "drop": item["drop"] or None,
                        }
    return by_id


def dump(data: dict, path: str):
    with open(path, "w", encoding="utf-8") as fh:
        if path.endswith("src/data/armory_data.json"):
            json.dump(data, fh, ensure_ascii=False, separators=(",", ":"))
        else:
            json.dump(data, fh, ensure_ascii=False, indent=1)


def main():
    prices = scrape_prices()
    print(f"scraped prices/drops for {len(prices)} items")
    for path in TARGETS:
        data = json.load(open(path, encoding="utf-8"))
        n_price = n_drop = 0
        for s in data["sections"]:
            for loc in s["locations"]:
                for cat in loc["categories"]:
                    for set_ in cat["sets"]:
                        for item in set_["items"]:
                            upd = prices.get(item.get("id"))
                            if not upd:
                                continue
                            if item.get("price") != upd["price"]:
                                n_price += 1
                            if item.get("drop") != upd["drop"]:
                                n_drop += 1
                            item["price"] = upd["price"]
                            item["drop"] = upd["drop"]
        dump(data, path)
        print(f"{path}: price changes={n_price} drop changes={n_drop}")


if __name__ == "__main__":
    main()
