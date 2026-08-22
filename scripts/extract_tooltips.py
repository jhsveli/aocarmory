#!/usr/bin/env python3
"""Extract item tooltip stats from the old-site tooltip screenshots.

The archived armory HTML only carries name/rarity/slot/price per item; the
actual stats live in per-item tooltip screenshots that the original site
hotlinked from https://static.is-better-than.tv/armory/<slug>.jpg.

This script:

  1. collects the unique tooltip image URLs from research/armory_data.json,
  2. downloads them into research/images/ (cached + resumable),
  3. OCRs each image with Tesseract (via pytesseract) and parses the text
     into structured stats,
  4. caches the result in research/tooltips.json,
  5. --merge bakes tooltip/stats into research/armory_data.json (which keeps
     the image url as provenance) and regenerates the minified app dataset
     armory/src/data/armory_data.json (image kept for the panel's
     original-screenshot comparison view).

Stats schema: scalar stats use explicit properties (itemLevel, requiresLevel);
armor/critigation are { "<name>": <number> } entries in stats["values"];
attribute bonuses are { "<name>": <number> } entries in stats["attributes"].
Property names are normalized OCR keys; the client resolves their display
labels from armory/src/lib/stat-labels.ts.

Run stages:
    python scripts/extract_tooltips.py --sample 25        # tune preprocessing
    python scripts/extract_tooltips.py                    # full run (resumable)
    python scripts/extract_tooltips.py --merge            # regenerate datasets
"""
import argparse
import concurrent.futures
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RESEARCH = os.path.join(BASE, "research")
IMAGES_DIR = os.path.join(RESEARCH, "images")
SRC_DATA = os.path.join(RESEARCH, "armory_data.json")
CACHE = os.path.join(RESEARCH, "tooltips.json")
REPORT = os.path.join(RESEARCH, "tooltips_report.json")
APP_DATA = os.path.join(BASE, "armory", "src", "data", "armory_data.json")

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AoC-Armory-tooltip-extractor/1.0"
TIMEOUT = 30
RETRIES = 3
RETRY_BACKOFF = 2.0
MAX_LINE_LEN = 200

# Common Tesseract install locations on Windows (used if not on PATH).
TESSERACT_CANDIDATES = [
    r"C:\Program Files\Tesseract-OCR\tesseract.exe",
    r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
]

# ---------------------------------------------------------------------------
# download
# ---------------------------------------------------------------------------

def fetch(url: str, dest: str, retries: int = RETRIES):
    """Download url to dest. Returns True on success, False on hard failure."""
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
                data = resp.read()
            tmp = dest + ".part"
            with open(tmp, "wb") as fh:
                fh.write(data)
            os.replace(tmp, dest)
            return True
        except urllib.error.HTTPError as exc:
            # 4xx are permanent: no point retrying.
            if 400 <= exc.code < 500:
                return False
            if attempt == retries - 1:
                return False
        except (urllib.error.URLError, TimeoutError, OSError):
            if attempt == retries - 1:
                return False
        time.sleep(RETRY_BACKOFF * (attempt + 1))
    return False


def download_all(jobs, force=False, workers=8, verbose=False):
    """jobs: list of (item_id, url). Returns (ok: list[str], failed: list[str])."""
    os.makedirs(IMAGES_DIR, exist_ok=True)
    todo = []
    done = []
    for item_id, url in jobs:
        fname = os.path.basename(url.split("?")[0])
        dest = os.path.join(IMAGES_DIR, fname)
        if not force and os.path.exists(dest):
            done.append(fname)
            continue
        todo.append((item_id, fname, dest, url))

    ok, failed = [], []

    def work(job):
        item_id, fname, dest, url = job
        if verbose:
            print(f"  dl [{item_id}] {fname}")
        return (fname, fetch(url, dest))

    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
        futures = [pool.submit(work, j) for j in todo]
        for fut in concurrent.futures.as_completed(futures):
            fname, success = fut.result()
            if success:
                ok.append(fname)
            else:
                failed.append(fname)
            time.sleep(0.05)  # polite pacing

    return done + ok, failed


# ---------------------------------------------------------------------------
# OCR + cleanup
# ---------------------------------------------------------------------------

def _ensure_tesseract():
    import pytesseract
    try:
        pytesseract.get_tesseract_version()
        return pytesseract
    except Exception:
        env = os.environ.get("TESSERACT_CMD")
        candidates = [env] if env else []
        candidates += TESSERACT_CANDIDATES
        for cand in candidates:
            if cand and os.path.exists(cand):
                pytesseract.pytesseract.tesseract_cmd = cand
                return pytesseract
        raise


def preprocess(img, binarize=False, scale=2):
    """Grayscale + upscale + autocontrast; optionally Otsu-binarize."""
    from PIL import Image, ImageOps
    img = ImageOps.grayscale(img)
    if scale != 1:
        w, h = img.size
        img = img.resize((w * scale, h * scale), Image.LANCZOS)
    img = ImageOps.autocontrast(img)
    if binarize:
        img = img.point(lambda p: 255 if p > 128 else 0)
    return img


def clean_lines(text: str):
    """Split OCR text into clean, non-empty, printable lines."""
    out = []
    for raw in text.splitlines():
        line = " ".join(raw.split()).replace("\ufffd", "'")
        if not line:
            continue
        if len(line) < 3:  # icon/frame noise fragments
            continue
        if re.fullmatch(r"[\W_]+", line):  # pure punctuation/garbage
            continue
        if len(line) > MAX_LINE_LEN:
            line = line[:MAX_LINE_LEN]
        out.append(line)
    return out


def ocr_image(path, pytesseract, binarize=False, psm=6):
    from PIL import Image
    with Image.open(path) as img:
        proc = preprocess(img, binarize=binarize)
        text = pytesseract.image_to_string(
            proc, lang="eng", config=f"--oem 3 --psm {psm}")
    return clean_lines(text)


# ---------------------------------------------------------------------------
# structured parse
# ---------------------------------------------------------------------------

RE_BINDS = re.compile(r"^Binds (when Picked Up|on Pickup|on Equip|on Acquire)\b", re.I)
RE_LEVEL = re.compile(r"^Level[: ]?\s*(\d+)$", re.I)
RE_ITEM_LEVEL = re.compile(r"^Item Level[: ]?\s*(\d+)", re.I)
RE_REQUIRES_LEVEL = re.compile(r"^Requires Level[: ]?\s*(\d+)", re.I)
RE_ARMOR_A = re.compile(r"^Armor[: ]?\s*(\d+)$", re.I)
RE_ARMOR_B = re.compile(r"^(\d+)\s*Armor$", re.I)
RE_CRITIGATION = re.compile(r"^(\d+)\s*Critigation Amount$", re.I)
RE_DAMAGE = re.compile(r"^Damage[: ]?\s*([\d\s,]+)\s*-\s*([\d\s,]+)$", re.I)
RE_DPS = re.compile(r"^DPS[: ]?\s*([\d.]+)$", re.I)
RE_DPS_WITH_DMG = re.compile(r"^([\d.]+)\s*DPS\s*\((\d+)\s*-\s*(\d+)\)$", re.I)
RE_ATTR = re.compile(r"^\+(\d+)\s+(.+)$")
RE_REQUIRES = re.compile(r"^Requires\s+(.+)$", re.I)
RE_EQUIP = re.compile(r"^Equip:\s*(.+)$", re.I)
RE_SET = re.compile(r"^Set:\s*(.+)$", re.I)
RE_SET_BONUS = re.compile(r"^\(\s*(\d+)\s*\)\s*Set Bonus:\s*(.+)$", re.I)

# The tooltip screenshots draw a frame around the text; OCR picks up the
# decoration chars (| _ ' / - : .) on the left/right of lines.
DECOR_LEAD = re.compile(r"^[\s|_'`/.:*\-\u2013\u2014]+")
DECOR_TAIL = re.compile(r"[\s|_'`/\-\u2013\u2014]+$")


def _norm_name(name):
    """Normalize an item name for fuzzy line matching (drop the OCR'd name)."""
    return re.sub(r"[^a-z0-9]+", "", (name or "").lower())


def _strip_decor(line):
    """Remove tooltip-frame decoration characters from a line."""
    return DECOR_TAIL.sub("", DECOR_LEAD.sub("", line)).strip()


# OCR reads the small "v" in "PvP" as 'y' or a yen sign (U+00A5 / U+FFFD),
# and commonly mangles a few other words. Normalize so attribute property
# names are stable keys for the display language file (stat-labels.ts).
ATTR_OCR_FIXES = (
    ("PyP", "PvP"),
    ("Py\u00a5P", "PvP"), ("P\u00a5P", "PvP"),
    ("Py\ufffdP", "PvP"), ("P\ufffdP", "PvP"),
    ("Darnage", "Damage"), ("Darmage", "Damage"), ("Darnmage", "Damage"),
    ("Darmnage", "Damage"), ("Darnnage", "Damage"),
    ("Strenath", "Strength"), ("Wisdorn", "Wisdom"),
    ("Combst", "Combat"), ("Cambat", "Combat"),
    ("Mansa", "Mana"), ("Mans", "Mana"),
    ("Starnina", "Stamina"), ("Starmina", "Stamina"),
)


def _norm_attr_name(name):
    """Normalize an OCR'd attribute label into a stable lowercase property key."""
    name = name.strip().strip(" .|'\"!")
    name = name.replace("{", "(").replace("}", ")")
    for bad, good in ATTR_OCR_FIXES:
        name = name.replace(bad, good)
    if name.count("(") < name.count(")"):
        name = name.rstrip(")")
    return name.lower()
# Weapon-ish / slot type lines that OCR commonly mangles slightly.
TYPE_HINTS = ("sword", "axe", "mace", "staff", "bow", "shield", "dagger",
              "talisman", "polearm", "hammer", "blade", "claw", "whip",
              "robe", "tunic", "armor", "legs", "boots", "gloves", "belt",
              "helmet", "helm", "mask", "cloak", "cape", "amulet", "necklace",
              "ring", "bracers", "vambraces", "wrist", "shoulders", "epaulets",
              "cuirass", "breastplate", "leggings", "greaves", "sabatons",
              "girdle", "head", "chest", "hands", "feet", "back", "weapon",
              "one-handed", "two-handed", "ranged", "thrown", "polearm")


def _prose_like(line: str) -> bool:
    """Heuristic: a free-form description sentence vs a short label."""
    words = line.split()
    if len(words) < 3:
        return False
    if line.startswith(("+", "(", "Set", "Equip", "Requires", "Binds", "Item")):
        return False
    if ":" in line:
        return False
    if re.search(r"\d", line):
        return False
    return True


def parse_stats(lines, name=None):
    """Classify cleaned OCR lines into the ItemStats shape."""
    stats = {
        "attributes": [],
        "effects": [],
        "setBonuses": [],
        "values": [],
        "lines": [],
    }
    pending = []  # unrecognized lines, awaiting description/type classification
    name_norm = _norm_name(name)

    def flush_pending():
        nonlocal pending
        if not pending:
            return
        # A run of prose-like lines is a description paragraph; pull it out.
        prose = [ln for ln in pending if _prose_like(ln)]
        if len(prose) >= 2 and len(prose) == len(pending):
            stats["description"] = "\n".join(prose)
        else:
            for ln in pending:
                n_words = len([w for w in ln.split() if w != "-"])
                if stats.get("type") is None and n_words <= 3 \
                        and not re.search(r"\d", ln) \
                        and any(h in ln.lower() for h in TYPE_HINTS):
                    stats["type"] = ln
                else:
                    stats["lines"].append(ln)
        pending = []

    # Clean each line: strip frame decoration, drop the redundant item name
    # (we already have it from the HTML) and everything above the tooltip's
    # first "Binds ..." line — that region is the item icon + name, which OCR
    # reads unreliably and which we already know.
    first_binds = next((i for i, ln in enumerate(lines) if RE_BINDS.match(ln)), None)
    kept = []
    for i, ln in enumerate(lines):
        ln = _strip_decor(ln)
        if not ln or len(ln) < 3 or re.fullmatch(r"[\W_]+", ln):
            continue
        if first_binds is not None and i < first_binds:
            continue
        if name_norm and _norm_name(ln) == name_norm:
            continue  # redundant: we already have the name from the HTML
        kept.append(ln)

    for line in kept:
        m = RE_BINDS.match(line)
        if m:
            flush_pending()
            head = m.group(1).lower()
            stats["binds"] = ("BIND_ON_PICKUP"
                               if ("picked up" in head or "pickup" in head
                                   or "acquire" in head)
                               else "BIND_ON_EQUIP")
            # OCR sometimes merges the next line onto the binds line
            # ("Binds when Picked Up Summons a sapling…"); keep the remainder
            rest = _strip_decor(line[m.end():])
            if rest:
                pending.append(rest)
            continue
        m = RE_LEVEL.match(line) or RE_ITEM_LEVEL.match(line)
        if m:
            flush_pending(); stats["itemLevel"] = int(m.group(1)); continue
        m = RE_REQUIRES_LEVEL.match(line)
        if m:
            flush_pending()
            if "requiresLevel" not in stats:
                stats["requiresLevel"] = int(m.group(1))
            else:
                pending.append(line)
            continue
        m = RE_ARMOR_A.match(line) or RE_ARMOR_B.match(line)
        if m:
            flush_pending(); stats["values"].append({"armor": int(m.group(1))}); continue
        m = RE_CRITIGATION.match(line)
        if m:
            flush_pending(); stats["values"].append({"critigation": int(m.group(1))}); continue
        m = RE_DAMAGE.match(line)
        if m:
            flush_pending()
            stats["damage"] = {"min": int(m.group(1).replace(",", "").replace(" ", "")),
                               "max": int(m.group(2).replace(",", "").replace(" ", ""))}
            continue
        m = RE_DPS_WITH_DMG.match(line)
        if m:
            flush_pending()
            stats["dps"] = float(m.group(1))
            stats["damage"] = {"min": int(m.group(2)), "max": int(m.group(3))}
            continue
        m = RE_DPS.match(line)
        if m:
            flush_pending(); stats["dps"] = float(m.group(1)); continue
        m = RE_ATTR.match(line)
        if m:
            flush_pending()
            stats["attributes"].append({_norm_attr_name(m.group(2)): int(m.group(1))})
            continue
        m = RE_REQUIRES.match(line)
        if m:
            flush_pending()
            if "requires" not in stats:
                stats["requires"] = line
            else:
                pending.append(line)  # e.g. "Requires PvP Level 3"
            continue
        m = RE_EQUIP.match(line)
        if m:
            flush_pending(); stats["effects"].append(line); continue
        m = RE_SET_BONUS.match(line)
        if m:
            flush_pending(); stats["setBonuses"].append(line); continue
        m = RE_SET.match(line)
        if m:
            flush_pending(); stats["set"] = line; continue
        pending.append(line)
    flush_pending()
    if "binds" not in stats:
        # No dedicated binds line: fall back to scanning the leftover lines for
        # one that OCR merged onto another label ("Character Bound : Binds …"),
        # otherwise the item is unbound.
        joined = "\n".join(stats["lines"])
        if re.search(r"Binds (?:when Picked Up|on Pickup|when Equipped|on Equip|on Acquire)",
                     joined, re.I):
            stats["binds"] = ("BIND_ON_PICKUP"
                               if re.search(r"Picked Up|Pickup|Acquire", joined, re.I)
                               else "BIND_ON_EQUIP")
        else:
            stats["binds"] = "NO_BIND"
    return stats


# ---------------------------------------------------------------------------
# cache + merge
# ---------------------------------------------------------------------------

def load_cache():
    if os.path.exists(CACHE):
        with open(CACHE, encoding="utf-8") as fh:
            return json.load(fh)
    return {"items": {}, "images_ok": [], "images_failed": []}


def save_cache(cache):
    with open(CACHE, "w", encoding="utf-8") as fh:
        json.dump(cache, fh, ensure_ascii=False, indent=1)


def build_names(data):
    """item id -> item name (for dropping the OCR'd name line)."""
    names = {}
    for section in data["sections"]:
        for loc in section.get("locations", []):
            for cat in loc.get("categories", []):
                for set_ in cat.get("sets", []):
                    for item in set_.get("items", []):
                        names.setdefault(item["id"], item.get("name"))
    return names


def unique_image_jobs(data):
    """item_id -> url for the first item per unique url (skip nulls)."""
    jobs = []
    seen = set()
    for section in data["sections"]:
        for loc in section.get("locations", []):
            for cat in loc.get("categories", []):
                for set_ in cat.get("sets", []):
                    for item in set_.get("items", []):
                        url = item.get("image")
                        if not url or url in seen:
                            continue
                        seen.add(url)
                        jobs.append((item["id"], url))
    jobs.sort(key=lambda j: j[0])
    return jobs


def merge(cache):
    """Bake tooltip/stats into research + app datasets (app keeps image)."""
    with open(SRC_DATA, encoding="utf-8") as fh:
        data = json.load(fh)

    # url -> cached entry (items that share an image url with a cached item
    # get the same tooltip; e.g. Grips of the Ubah Kan appears under two ids)
    url_entry = {}
    merged = 0
    missing = 0
    for section in data["sections"]:
        for loc in section.get("locations", []):
            for cat in loc.get("categories", []):
                for set_ in cat.get("sets", []):
                    for item in set_.get("items", []):
                        entry = cache["items"].get(str(item["id"]))
                        if entry:
                            url_entry[item.get("image")] = entry
                        item["tooltip"] = entry["tooltip"] if entry else None
                        item["stats"] = entry["stats"] if entry else None
                        if entry:
                            merged += 1
                        else:
                            missing += 1
    # second pass: fill items whose image url matched a cached sibling
    for section in data["sections"]:
        for loc in section.get("locations", []):
            for cat in loc.get("categories", []):
                for set_ in cat.get("sets", []):
                    for item in set_.get("items", []):
                        if item["tooltip"] is None and item.get("image") in url_entry:
                            item["tooltip"] = url_entry[item["image"]]["tooltip"]
                            item["stats"] = url_entry[item["image"]]["stats"]
                            merged += 1
                            missing -= 1

    # research dataset keeps image (provenance); refresh generated timestamp
    data["meta"]["generated"] = time.strftime("%Y-%m-%dT%H:%M:%S")
    with open(SRC_DATA, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=1)

    # app dataset: minified; the image url is kept so the item-detail panel
    # can show the original tooltip screenshot next to the scraped stats
    os.makedirs(os.path.dirname(APP_DATA), exist_ok=True)
    with open(APP_DATA, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, separators=(",", ":"))

    return merged, missing


# ---------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--sample", type=int, default=0,
                    help="only process the first N unique images (tuning runs)")
    ap.add_argument("--force-download", action="store_true",
                    help="re-download images even if already cached")
    ap.add_argument("--skip-download", action="store_true",
                    help="use already-downloaded images only")
    ap.add_argument("--force", action="store_true",
                    help="re-OCR items already present in the cache")
    ap.add_argument("--reparse", action="store_true",
                    help="re-run the structured parse on cached tooltips (no re-OCR)")
    ap.add_argument("--ocr-engine", default="tesseract",
                    help="OCR engine (only 'tesseract' is implemented)")
    ap.add_argument("--binarize", action="store_true",
                    help="apply an Otsu-style threshold before OCR")
    ap.add_argument("--psm", type=int, default=6,
                    help="tesseract page segmentation mode")
    ap.add_argument("--workers", type=int, default=8)
    ap.add_argument("--merge", action="store_true",
                    help="bake cache into the JSON datasets and exit")
    ap.add_argument("--verbose", action="store_true")
    args = ap.parse_args()

    if args.ocr_engine != "tesseract":
        print(f"unsupported --ocr-engine {args.ocr_engine!r} (only 'tesseract')")
        sys.exit(1)

    if args.merge:
        cache = load_cache()
        merged, missing = merge(cache)
        report = {
            "merged": merged,
            "missingTooltip": missing,
            "imagesOk": len(cache["images_ok"]),
            "imagesFailed": len(cache["images_failed"]),
            "generated": time.strftime("%Y-%m-%dT%H:%M:%S"),
        }
        with open(REPORT, "w", encoding="utf-8") as fh:
            json.dump(report, fh, ensure_ascii=False, indent=1)
        print(f"merged={merged} missing={missing} -> {APP_DATA}")
        print(f"report -> {REPORT}")
        return

    pytesseract = _ensure_tesseract()
    print(f"tesseract {pytesseract.get_tesseract_version()}")

    with open(SRC_DATA, encoding="utf-8") as fh:
        data = json.load(fh)
    names = build_names(data)

    cache = load_cache()
    if args.reparse:
        for key, entry in cache["items"].items():
            if entry.get("tooltip"):
                entry["stats"] = parse_stats(entry["tooltip"].split("\n"),
                                              names.get(int(key)))
        save_cache(cache)
        print(f"reparsed {len(cache['items'])} cached tooltips")
        return

    jobs = unique_image_jobs(data)
    if args.sample:
        jobs = jobs[: args.sample]
    print(f"unique images: {len(jobs)}")

    # --- download -------------------------------------------------------
    if args.skip_download:
        ok, failed = [], []
    else:
        ok, failed = download_all(jobs, force=args.force_download,
                                  workers=args.workers, verbose=args.verbose)
        print(f"download ok={len(ok)} failed={len(failed)}")

    cache = load_cache()
    cache["images_ok"] = sorted(set(cache["images_ok"]) | set(ok))
    cache["images_failed"] = sorted(set(cache["images_failed"]) | set(failed))
    save_cache(cache)

    # --- OCR -------------------------------------------------------------
    todo = []
    for item_id, url in jobs:
        fname = os.path.basename(url.split("?")[0])
        dest = os.path.join(IMAGES_DIR, fname)
        key = str(item_id)
        if key in cache["items"] and not args.force:
            continue
        if not os.path.exists(dest):
            continue  # download failed; leave item missing (merge fills null)
        todo.append((item_id, dest))

    def ocr_job(job):
        item_id, dest = job
        if args.verbose:
            print(f"  ocr [{item_id}] {os.path.basename(dest)}")
        try:
            lines = ocr_image(dest, pytesseract, binarize=args.binarize, psm=args.psm)
        except Exception as exc:  # noqa: BLE001 - keep the batch alive
            print(f"  ocr FAILED [{item_id}] {os.path.basename(dest)}: {exc}")
            return item_id, None
        stats = parse_stats(lines, names.get(item_id)) if lines else None
        return item_id, {"tooltip": "\n".join(lines) if lines else None, "stats": stats}

    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = [pool.submit(ocr_job, j) for j in todo]
        for fut in concurrent.futures.as_completed(futures):
            item_id, entry = fut.result()
            if entry is not None:
                cache["items"][str(item_id)] = entry

    save_cache(cache)

    n_items = len(cache["items"])
    n_empty = sum(1 for e in cache["items"].values() if not e.get("tooltip"))
    print(f"ocr done: cached={n_items} empty={n_empty} "
          f"images ok={len(cache['images_ok'])} failed={len(cache['images_failed'])}")
    print("next: run with --merge to bake results into the datasets")


if __name__ == "__main__":
    main()
