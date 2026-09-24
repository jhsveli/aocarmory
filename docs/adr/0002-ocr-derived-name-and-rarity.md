# Derive item name and rarity from OCR instead of issue-form fields

The "Submit a new item" issue form (ADR-0001) had grown too heavy — a contributor
had to hand-type the item name and pick its rarity even though both are printed
on the tooltip screenshot they're already attaching. `submit_item.py` now runs
OCR first and tries `extract_tooltips.guess_item_name`/`guess_rarity` on the
result before falling back to the (now optional) form fields; both stay in the
form as manual overrides for when OCR misses.

Backtested against the ~4,700 already-OCR'd legacy tooltips in
`research/armory_data.json`: name guessing is exact 43% of the time, correctly
defers (returns nothing, keeps the form field) 55% of the time, and is
confidently wrong only ~2%; rarity guessing is exact 39% of the time and is
never wrong (0%) — it only ever matches or defers. Good enough given the PR
description flags auto-detected values for the Admin to verify against the
screenshot before merging, and real submissions (clear, unscaled screenshots)
should OCR better than this legacy corpus of old hotlinked, often-scaled images.
