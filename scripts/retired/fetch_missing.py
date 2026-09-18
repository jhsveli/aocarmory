#!/usr/bin/env python3
"""Fetch the three missing section captures:
s4  (Last Legion)      - newest available (legacy, 2011/2012 era)
s12 (Consumable Books) - newest available (legacy, 2017 era)
s45 (Skull Gate Pass)  - retry with older timestamps (2024 capture 404s)
"""
import gzip
import json
import os
import time
import urllib.parse
import urllib.request

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SECTIONS_DIR = os.path.join(BASE, "research", "sections")
UA = {"User-Agent": "Mozilla/5.0 (research scraper; respectful)"}

TARGETS = {
    "s4": "https://aoc.is-better-than.tv/armory.php?s=4",
    "s12": "https://aoc.is-better-than.tv/armory.php?s=12",
    "s45": "https://aoc.is-better-than.tv/armory.php?s=45",
}


def http_get(url: str, timeout: int = 180) -> bytes:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def captures(url: str) -> list[tuple[str, str]]:
    cdx = ("https://web.archive.org/cdx/search/cdx?" + urllib.parse.urlencode({
        "url": url, "output": "json", "filter": "statuscode:200",
        "fl": "timestamp,original,statuscode", "limit": "200",
    }))
    rows = json.loads(http_get(cdx))
    return [(r[0], r[1]) for r in rows[1:]]


def fetch(ts: str, url: str) -> bytes | None:
    raw_url = f"https://web.archive.org/web/{ts}id_/{url}"
    for attempt in range(3):
        try:
            data = http_get(raw_url)
            if data[:2] == b"\x1f\x8b":
                data = gzip.decompress(data)
            return data
        except Exception as exc:  # noqa: BLE001
            print(f"  err {ts}: {exc}")
            time.sleep(3)
    return None


def main() -> None:
    for key, url in TARGETS.items():
        out = os.path.join(SECTIONS_DIR, f"{key}.html")
        if os.path.exists(out) and os.path.getsize(out) > 4000:
            print(f"{key}: cached")
            continue
        caps = captures(url)
        print(f"{key}: {len(caps)} captures")
        # newest first, but s45's newest is broken; try up to 8 newest
        for ts, orig in reversed(caps[-8:]):
            print(f"  trying {ts}")
            data = fetch(ts, url)
            if data and len(data) > 3000 and b"<title>" in data[:2000]:
                with open(out, "wb") as fh:
                    fh.write(data)
                print(f"  {key}: saved {ts} {len(data)} bytes")
                break
            print(f"  {ts}: bad response ({len(data) if data else 0} bytes)")
        time.sleep(1)


if __name__ == "__main__":
    main()
