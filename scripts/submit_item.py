#!/usr/bin/env python3
"""Turn a "Submit a new item" issue into a targeted armory_data.json insertion.

Reuses extract_tooltips.py's OCR (_ensure_tesseract/ocr_image) and tooltip-text
parser (parse_stats) — this script never touches an *existing* item, it only
inserts one brand-new Item at a contributor-chosen Section/Location/Category/Set
path (creating any of those that don't already exist by name), with
id = 100000 + issue_number (collision-free without scanning existing ids — see
docs/adr/0001-contribution-pipeline.md).

Run by .github/workflows/new-item-submission.yml, once per opened issue that
carries the new-item-submission label. Exits 0 with GITHUB_OUTPUT `ok=true`
plus a PR title/body when the insertion succeeded (both JSON files already
rewritten on disk, ready to commit); exits 1 with `ok=false` plus a `reason`
when the submission should get a comment instead of a PR (bad/missing
screenshot, OCR found nothing usable, ...).
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import tempfile
import urllib.request

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(BASE, "scripts"))
import extract_tooltips as et  # noqa: E402 — reuse OCR + tooltip-text parser

RESEARCH_DATA = os.path.join(BASE, "research", "armory_data.json")
APP_DATA = os.path.join(BASE, "armory", "src", "data", "armory_data.json")

ID_OFFSET = 100_000
SECTION_ID_OFFSET = 1_000
NO_RESPONSE = "_No response_"

# Currency display title -> internal Price code (mirrors armory/src/lib/format.ts COINS).
CURRENCY_CODES = {
    "Mark of Acclaim": "mark",
    "Rare Trophy": "trophy",
    "Gold": "gold",
    "Simple Trophy I": "simple_trophy_i",
    "Simple Trophy II": "simple_trophy_ii",
    "Simple Trophy III": "simple_trophy_iii",
    "Simple Relic I": "simple_relic_i",
    "Simple Relic II": "simple_relic_ii",
    "Simple Relic III": "simple_relic_iii",
    "Simple Relic IV": "simple_relic_iv",
    "Simple Relic V": "simple_relic_v",
    "Simple Relic VI": "simple_relic_vi",
    "Rare Relic": "rare_relic",
    "Mythical Relic": "mythical_relic",
    "Campaign Badges": "campaign_badges",
    "Conquest Trophies": "conquest_trophies",
    "Atlantean Shards": "atlantean_shards",
    "Dragon Tear": "dragon_tear",
    "Emerald Essence": "emerald_essence",
    "Shard of Pure Ice": "shard_of_pure_ice",
    "Copper": "copper",
    "Tin": "tin",
}


# ---------------------------------------------------------------------------
# pure parsing (no network/OCR/filesystem — unit-tested in test_submit_item.py)
# ---------------------------------------------------------------------------

def parse_issue_form(body: str) -> dict:
    """GitHub issue-form bodies render as repeated '### Label\\n\\nvalue' blocks."""
    fields = {}
    blocks = re.split(r"(?m)^### ", body)
    for block in blocks[1:]:
        label, _, rest = block.partition("\n")
        value = rest.strip()
        if value == NO_RESPONSE:
            value = ""
        fields[label.strip()] = value
    return fields


def extract_screenshot_url(screenshot_field_value: str) -> str | None:
    """Pulls the image URL out of a drag-and-dropped/pasted image."""
    m = re.search(r"!\[[^\]]*\]\((https://[^\s)]+)\)", screenshot_field_value)
    if m:
        return m.group(1)
    m = re.search(r"(https://\S+\.(?:png|jpe?g|gif|webp))", screenshot_field_value, re.I)
    return m.group(1) if m else None


def build_price(fields: dict) -> dict | None:
    price: dict = {}
    for n in (1, 2, 3):
        currency = fields.get(f"Currency {n}", "").strip()
        amount = fields.get(f"Amount {n}", "").strip()
        if not currency or not amount:
            continue
        code = CURRENCY_CODES.get(currency)
        if not code:
            continue
        try:
            price[code] = float(amount) if "." in amount else int(amount)
        except ValueError:
            continue
    return price or None


def resolve_section_name(fields: dict) -> str:
    chosen = fields.get("Section", "").strip()
    if chosen == "New section (name it below)":
        return fields.get("New section name", "").strip()
    return chosen


def stats_is_empty(stats: dict) -> bool:
    return not (
        stats.get("values") or stats.get("attributes") or stats.get("lines")
        or stats.get("type") or stats.get("effects")
    )


# ---------------------------------------------------------------------------
# tree find-or-create (mutates the loaded JSON dict in place)
# ---------------------------------------------------------------------------

def find_or_create_section(data: dict, name: str, issue_number: int) -> dict:
    for s in data["sections"]:
        if s["name"].strip().lower() == name.lower():
            return s
    new_section = {"id": SECTION_ID_OFFSET + issue_number, "name": name, "locations": []}
    data["sections"].append(new_section)
    return new_section


def find_or_create_location(section: dict, name: str, loc_type: str | None) -> dict:
    for loc in section["locations"]:
        if (loc.get("name") or "").strip().lower() == name.lower():
            return loc
    new_loc = {"name": name, "coords": None, "type": loc_type or None, "categories": []}
    section["locations"].append(new_loc)
    return new_loc


def find_or_create_category(location: dict, name: str) -> dict:
    for cat in location["categories"]:
        if (cat.get("name") or "").strip().lower() == name.lower():
            return cat
    new_cat = {"name": name, "sets": []}
    location["categories"].append(new_cat)
    return new_cat


def find_or_create_set(category: dict, name: str | None, classes: list) -> dict:
    if name:
        for s in category["sets"]:
            if (s.get("name") or "").strip().lower() == name.lower():
                return s
    # Unnamed sets are per-item wrappers in the existing data (nothing to
    # group unnamed items under), so always start a fresh one for those.
    new_set = {"name": name, "classes": classes, "builder": None, "items": []}
    category["sets"].append(new_set)
    return new_set


def insert_item(data: dict, fields: dict, item: dict, issue_number: int) -> dict:
    """Inserts `item` at the fields-described path inside `data`, in place."""
    section = find_or_create_section(data, resolve_section_name(fields), issue_number)
    location = find_or_create_location(
        section, fields.get("Location", "").strip(), fields.get("Location kind", "").strip() or None,
    )
    category = find_or_create_category(location, fields.get("Category", "").strip())
    set_classes = [fields["Set class tag"].strip()] if fields.get("Set class tag", "").strip() else []
    item_set = find_or_create_set(category, fields.get("Set name", "").strip() or None, set_classes)
    item_set["items"].append(item)
    return section


# ---------------------------------------------------------------------------
# side-effecting steps (network/OCR/R2) — deliberately kept out of the above
# ---------------------------------------------------------------------------

def download_image(url: str, dest_dir: str) -> str:
    dest = os.path.join(dest_dir, "screenshot.jpg")
    req = urllib.request.Request(url, headers={"User-Agent": et.USER_AGENT})
    with urllib.request.urlopen(req, timeout=30) as resp, open(dest, "wb") as out:
        out.write(resp.read())
    return dest


def upload_to_r2(image_path: str, key: str) -> str:
    import boto3

    client = boto3.client(
        "s3",
        endpoint_url=os.environ["R2_S3_ENDPOINT"],
        aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
        region_name="auto",
    )
    with open(image_path, "rb") as fh:
        client.put_object(Bucket=os.environ["R2_BUCKET"], Key=key, Body=fh, ContentType="image/jpeg")
    return f"{os.environ['R2_PUBLIC_BASE_URL'].rstrip('/')}/{key}"


def build_pr_body(fields: dict, item: dict, section: dict, ocr_lines: list) -> str:
    notes = fields.get("Anything else the reviewer should know?", "").strip()
    preview = "\n".join(ocr_lines) if ocr_lines else "(no OCR text)"
    name_tag = "" if fields.get("Item name", "").strip() else " (auto-detected — verify)"
    rarity_tag = "" if fields.get("Rarity", "").strip() else " (auto-detected — verify)"
    return f"""Auto-generated from a "Submit a new item" issue — new item **{item['name']}**{name_tag}.

**Placement:** {section['name']} → {fields.get('Location', '').strip()} → {fields.get('Category', '').strip()} → {fields.get('Set name', '').strip() or '(no set)'}
**Rarity:** {item['rarity'] or '(none — check screenshot)'}{rarity_tag}
**Price:** {item['price'] or '(none — pure drop)'}
**Drop:** {item['drop'] or '(none — vendor purchase)'}

![screenshot]({item['image']})

<details><summary>Raw OCR text</summary>

```
{preview}
```

</details>

{f"**Contributor notes:** {notes}" if notes else ""}

Please compare the screenshot above against the generated stats in this diff before approving.
"""


def emit_output(path: str | None, **kv) -> None:
    if not path:
        return
    with open(path, "a", encoding="utf-8") as fh:
        for k, v in kv.items():
            if v is None:
                v = ""
            elif isinstance(v, bool):
                v = "true" if v else "false"
            fh.write(f"{k}<<GHA_SUBMIT_ITEM_EOF\n{v}\nGHA_SUBMIT_ITEM_EOF\n")


# ---------------------------------------------------------------------------

def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--issue-number", type=int, required=True)
    ap.add_argument("--issue-body-file", required=True, help="path to a file containing the raw issue body")
    ap.add_argument("--github-output", default=os.environ.get("GITHUB_OUTPUT"))
    args = ap.parse_args()

    with open(args.issue_body_file, encoding="utf-8") as fh:
        fields = parse_issue_form(fh.read())

    screenshot_url = extract_screenshot_url(fields.get("Tooltip screenshot", ""))
    if not screenshot_url:
        emit_output(args.github_output, ok=False,
                    reason="Couldn't find an image in the 'Tooltip screenshot' field — "
                           "make sure you dragged/pasted the screenshot into that box.")
        return 1

    with tempfile.TemporaryDirectory() as tmp:
        image_path = download_image(screenshot_url, tmp)
        pytesseract = et._ensure_tesseract()
        lines = et.ocr_image(image_path, pytesseract)

        item_name = fields.get("Item name", "").strip() or et.guess_item_name(lines)
        if not item_name:
            emit_output(args.github_output, ok=False,
                        reason="Couldn't read the item name off that screenshot — retake it "
                               "unscaled with the full tooltip visible, or fill in 'Item name' "
                               "yourself, and resubmit.")
            return 1

        stats = et.parse_stats(lines, name=item_name)
        if stats_is_empty(stats):
            emit_output(args.github_output, ok=False,
                        reason="Couldn't read any stats off that screenshot — please retake it "
                               "unscaled, with the full tooltip visible, and resubmit.")
            return 1

        rarity = fields.get("Rarity", "").strip() or et.guess_rarity(lines)
        new_id = ID_OFFSET + args.issue_number
        image_url = upload_to_r2(image_path, f"screenshots/{new_id}.jpg")

    price = build_price(fields)
    item = {
        "id": new_id,
        "name": item_name,
        "rarity": rarity or None,
        "price": price,
        "drop": fields.get("Drop source", "").strip() or None,
        "image": image_url,
        "stats": stats,
    }

    with open(RESEARCH_DATA, encoding="utf-8") as fh:
        research_data = json.load(fh)
    research_item = dict(item)
    research_item["tooltip"] = "\n".join(lines) if lines else None
    section = insert_item(research_data, fields, research_item, args.issue_number)
    research_data["meta"]["items"] = research_data.get("meta", {}).get("items", 0) + 1
    with open(RESEARCH_DATA, "w", encoding="utf-8") as fh:
        json.dump(research_data, fh, ensure_ascii=False, indent=1)

    with open(APP_DATA, encoding="utf-8") as fh:
        app_data = json.load(fh)
    insert_item(app_data, fields, dict(item), args.issue_number)
    app_data["meta"]["items"] = app_data.get("meta", {}).get("items", 0) + 1
    with open(APP_DATA, "w", encoding="utf-8") as fh:
        json.dump(app_data, fh, ensure_ascii=False, indent=1)

    emit_output(
        args.github_output, ok=True,
        pr_title=f"Add item: {item_name}",
        pr_body=build_pr_body(fields, item, section, lines),
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
