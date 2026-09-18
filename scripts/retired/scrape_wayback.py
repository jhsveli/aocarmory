#!/usr/bin/env python3
"""Scrape the AoC Armory from the Wayback Machine using a bulk CDX index.

Strategy: one bulk CDX query returns every archived armory.php URL since 2023.
We pick the capture timestamp per URL and download the raw (id_) HTML.
"""
import gzip
import json
import os
import time
import urllib.parse
import urllib.request

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SECTIONS_DIR = os.path.join(BASE, "research", "sections")
PAGES_DIR = os.path.join(BASE, "research", "pages")
CDX_FILE = os.path.join(BASE, "research", "cdx_armory.json")
os.makedirs(SECTIONS_DIR, exist_ok=True)
os.makedirs(PAGES_DIR, exist_ok=True)

UA = {"User-Agent": "Mozilla/5.0 (research scraper; respectful)"}

SECTIONS = {
    40: "Item Store", 36: "Clan Vigdis", 12: "Consumable Books",
    1: "Brittle Blade", 2: "Children of Yag-kosha", 3: "Hyrkanians",
    11: "Jiang Shi", 4: "Last Legion", 5: "Scarlet Circle",
    6: "Scholars of Cheng-Ho", 7: "Shadows of Jade", 8: "Tamarin's Tigers",
    9: "Wolves of the Steppes", 10: "Yellow Priests of Yun", 21: "Aquilonia",
    22: "Cimmeria", 28: "House of Crom", 23: "Stygia", 30: "Dragon's Spine",
    19: "Khitai", 25: "Turan", 32: "Unchained", 33: "World Boss",
    14: "PvE Tier 1", 15: "PvE Tier 2", 13: "PvE Tier 3", 24: "PvE Tier 3.5",
    20: "PvE Tier 4", 35: "PvE Tier 5", 38: "PvE Tier 6", 31: "Bags",
    29: "Recipes", 16: "PvP Tier 1", 17: "PvP Tier 2", 18: "PvP Tier 3",
    39: "Raidfinder", 44: "Kutchemes Temple", 45: "Skull Gate Pass",
    -1: "Unsorted Items",
}

PAGES = {
    "armorsets": "armory.php?p=armorsets",
    "factions": "armory.php?p=factions",
    "about": "armory.php?p=about",
    "links": "armory.php?p=links",
}


def http_get(url: str, timeout: int = 120) -> bytes:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def load_cdx() -> dict[str, str]:
    """Return {original_url: newest_timestamp} from the bulk CDX dump."""
    if not os.path.exists(CDX_FILE):
        q = ("https://web.archive.org/cdx/search/cdx?"
             + urllib.parse.urlencode({
                 "url": "aoc.is-better-than.tv/armory.php*",
                 "output": "json",
                 "filter": "statuscode:200",
                 "fl": "timestamp,original,statuscode",
                 "collapse": "urlkey",
                 "from": "2023",
             }))
        data = http_get(q, timeout=300)
        with open(CDX_FILE, "wb") as fh:
            fh.write(data)
    rows = json.load(open(CDX_FILE, encoding="utf-8"))
    index: dict[str, str] = {}
    for r in rows[1:]:
        ts, original = r[0], r[1]
        # keep the newest timestamp per URL
        if original not in index or ts > index[original]:
            index[original] = ts
    return index


def fetch_raw(ts: str, original_url: str) -> bytes | None:
    raw_url = f"https://web.archive.org/web/{ts}id_/{original_url}"
    for attempt in range(4):
        try:
            data = http_get(raw_url, timeout=180)
            if data[:2] == b"\x1f\x8b":
                data = gzip.decompress(data)
            return data
        except Exception as exc:  # noqa: BLE001
            print(f"  fetch error ({attempt + 1}/4) {original_url}: {exc}")
            time.sleep(3 + attempt * 4)
    return None


def main() -> None:
    index = load_cdx()
    print(f"CDX index: {len(index)} urls")

    wanted = {f"https://aoc.is-better-than.tv/armory.php?s={sid}": (SECTIONS_DIR, f"s{sid}.html")
              for sid in SECTIONS}
    for key, query in PAGES.items():
        wanted[f"https://aoc.is-better-than.tv/{query}"] = (PAGES_DIR, f"{key}.html")

    for url, (outdir, fname) in wanted.items():
        out = os.path.join(outdir, fname)
        if os.path.exists(out) and os.path.getsize(out) > 4000:
            print(f"  {fname}: cached")
            continue
        ts = index.get(url)
        if not ts:
            print(f"  {fname}: NO CAPTURE ({url})")
            continue
        data = fetch_raw(ts, url)
        if not data:
            print(f"  {fname}: FETCH FAILED")
            continue
        with open(out, "wb") as fh:
            fh.write(data)
        print(f"  {fname}: {ts} {len(data)} bytes")
        time.sleep(2.0)

    print("done")


if __name__ == "__main__":
    main()
