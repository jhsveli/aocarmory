#!/usr/bin/env python3
"""Unit tests for submit_item.py's pure logic (no network/OCR/R2 involved).

Run: python3 scripts/test_submit_item.py
"""
import unittest

import submit_item as si

SAMPLE_BODY = """### Section

New section (name it below)

### New section name

Bloodfire Peaks

### Location

Bloodfire Keep :: Grondel

### Location kind

merchant

### Category

Raid Cloth Armor

### Set name

_No response_

### Set class tag

_No response_

### Item name

Cowl of the Bloodfire

### Rarity

Epic

### Drop source

_No response_

### Currency 1

Gold

### Amount 1

12

### Currency 2

Rare Trophy

### Amount 2

3

### Currency 3

_No response_

### Amount 3

_No response_

### Tooltip screenshot

![tooltip.png](https://github.com/user-attachments/assets/1234-abcd)

### Anything else the reviewer should know?

Found this on the test server, might be unreleased.
"""


class ParseIssueFormTests(unittest.TestCase):
    def test_parses_labeled_blocks(self):
        fields = si.parse_issue_form(SAMPLE_BODY)
        self.assertEqual(fields["Item name"], "Cowl of the Bloodfire")
        self.assertEqual(fields["Rarity"], "Epic")
        self.assertEqual(fields["Location"], "Bloodfire Keep :: Grondel")

    def test_no_response_becomes_empty_string(self):
        fields = si.parse_issue_form(SAMPLE_BODY)
        self.assertEqual(fields["Set name"], "")
        self.assertEqual(fields["Drop source"], "")


class ExtractScreenshotUrlTests(unittest.TestCase):
    def test_markdown_image(self):
        url = si.extract_screenshot_url("![tooltip.png](https://github.com/user-attachments/assets/1234-abcd)")
        self.assertEqual(url, "https://github.com/user-attachments/assets/1234-abcd")

    def test_bare_link(self):
        url = si.extract_screenshot_url("here you go https://example.com/shot.png thanks")
        self.assertEqual(url, "https://example.com/shot.png")

    def test_no_image_returns_none(self):
        self.assertIsNone(si.extract_screenshot_url("I forgot to attach it, sorry!"))


class BuildPriceTests(unittest.TestCase):
    def test_two_currencies(self):
        fields = si.parse_issue_form(SAMPLE_BODY)
        self.assertEqual(si.build_price(fields), {"gold": 12, "trophy": 3})

    def test_no_currencies_returns_none(self):
        fields = {"Currency 1": "", "Amount 1": "", "Currency 2": "", "Amount 2": "",
                   "Currency 3": "", "Amount 3": ""}
        self.assertIsNone(si.build_price(fields))

    def test_unknown_currency_is_skipped(self):
        fields = {"Currency 1": "Made Up Coin", "Amount 1": "5"}
        self.assertIsNone(si.build_price(fields))


class ResolveSectionNameTests(unittest.TestCase):
    def test_new_section(self):
        fields = si.parse_issue_form(SAMPLE_BODY)
        self.assertEqual(si.resolve_section_name(fields), "Bloodfire Peaks")

    def test_existing_section(self):
        fields = {"Section": "Stygia", "New section name": ""}
        self.assertEqual(si.resolve_section_name(fields), "Stygia")


class GuessItemNameTests(unittest.TestCase):
    def test_single_clean_line_before_binds(self):
        lines = ["Shroud of Zath", "Binds when Picked Up", "Social - Cloak"]
        self.assertEqual(si.et.guess_item_name(lines), "Shroud of Zath")

    def test_icon_noise_before_name_is_skipped(self):
        lines = ["tg-*!", "{ S A", "Companion: Corrupted Self", "Binds when Picked Up"]
        self.assertEqual(si.et.guess_item_name(lines), "Companion: Corrupted Self")

    def test_no_binds_line_returns_none(self):
        self.assertIsNone(si.et.guess_item_name(["Shroud of Zath", "Social - Cloak"]))


class GuessRarityTests(unittest.TestCase):
    def test_reads_rarity_off_item_level_line(self):
        lines = ["Shroud of Zath", "Binds when Picked Up", "Item Level 1 - Legendary"]
        self.assertEqual(si.et.guess_rarity(lines), "Legendary")

    def test_no_rarity_suffix_returns_none(self):
        lines = ["Path of Ahriman", "Binds when Picked Up", "Item Level 1 -"]
        self.assertIsNone(si.et.guess_rarity(lines))

    def test_no_item_level_line_returns_none(self):
        self.assertIsNone(si.et.guess_rarity(["Requires Level 80"]))


class StatsIsEmptyTests(unittest.TestCase):
    def test_empty(self):
        self.assertTrue(si.stats_is_empty({"values": [], "attributes": [], "lines": [], "effects": []}))

    def test_has_lines(self):
        self.assertFalse(si.stats_is_empty({"values": [], "attributes": [], "lines": ["Armor 512"], "effects": []}))


def sample_data():
    return {"sections": [{"id": 5, "name": "Stygia", "locations": []}]}


class TreeInsertionTests(unittest.TestCase):
    def test_finds_existing_section_case_insensitively(self):
        data = sample_data()
        section = si.find_or_create_section(data, "stygia", issue_number=42)
        self.assertEqual(section["id"], 5)
        self.assertEqual(len(data["sections"]), 1)

    def test_creates_new_section_with_offset_id(self):
        data = sample_data()
        section = si.find_or_create_section(data, "Bloodfire Peaks", issue_number=42)
        self.assertEqual(section["id"], 1042)
        self.assertEqual(len(data["sections"]), 2)

    def test_creates_new_location_category_set(self):
        section = {"id": 5, "name": "Stygia", "locations": []}
        loc = si.find_or_create_location(section, "Khemi :: Bazaar", "merchant")
        cat = si.find_or_create_category(loc, "Robes")
        item_set = si.find_or_create_set(cat, "Sandstorm", ["HoX"])
        self.assertEqual(loc["type"], "merchant")
        self.assertEqual(cat["name"], "Robes")
        self.assertEqual(item_set["classes"], ["HoX"])

    def test_reuses_existing_location_by_name(self):
        section = {"id": 5, "name": "Stygia", "locations": []}
        si.find_or_create_location(section, "Khemi :: Bazaar", "merchant")
        loc2 = si.find_or_create_location(section, "khemi :: bazaar", None)
        self.assertEqual(len(section["locations"]), 1)
        self.assertEqual(loc2["type"], "merchant")  # kept from first creation

    def test_unnamed_sets_never_merge(self):
        cat = {"name": "Robes", "sets": []}
        si.find_or_create_set(cat, None, [])
        si.find_or_create_set(cat, None, [])
        self.assertEqual(len(cat["sets"]), 2)

    def test_insert_item_builds_full_path_and_appends_item(self):
        data = sample_data()
        fields = {
            "Section": "Stygia", "Location": "Khemi :: Bazaar", "Location kind": "merchant",
            "Category": "Robes", "Set name": "Sandstorm", "Set class tag": "HoX",
        }
        item = {"id": 100042, "name": "Sandstorm Cowl"}
        section = si.insert_item(data, fields, item, issue_number=42)
        self.assertEqual(section["name"], "Stygia")
        inserted = section["locations"][0]["categories"][0]["sets"][0]["items"][0]
        self.assertEqual(inserted["name"], "Sandstorm Cowl")

    def test_insert_item_twice_reuses_the_path(self):
        data = sample_data()
        fields = {
            "Section": "Stygia", "Location": "Khemi :: Bazaar", "Location kind": "merchant",
            "Category": "Robes", "Set name": "Sandstorm", "Set class tag": "HoX",
        }
        si.insert_item(data, fields, {"id": 100042, "name": "Sandstorm Cowl"}, issue_number=42)
        si.insert_item(data, fields, {"id": 100043, "name": "Sandstorm Boots"}, issue_number=43)
        section = data["sections"][0]
        self.assertEqual(len(section["locations"]), 1)
        self.assertEqual(len(section["locations"][0]["categories"]), 1)
        self.assertEqual(len(section["locations"][0]["categories"][0]["sets"]), 1)
        self.assertEqual(len(section["locations"][0]["categories"][0]["sets"][0]["items"]), 2)


if __name__ == "__main__":
    unittest.main()
