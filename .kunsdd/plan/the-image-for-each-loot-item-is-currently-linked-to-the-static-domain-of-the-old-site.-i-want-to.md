# Extract item tooltip stats from old-site screenshots; replace hotlinked images with a CSS tooltip box

## Summary

The item tooltips in the armory are currently **hotlinked `<img>` tags** pointing at `https://static.is-better-than.tv/armory/<slug>.jpg` — in-game tooltip screenshots. The stats exist **only inside those images** (the archived HTML pages carry just name/rarity/slot/price).

This task:

1. Downloads the ~4,539 unique tooltip screenshots, **OCRs them with Tesseract**, and parses the text into structured stats (armor/damage/DPS, attributes, requirements, set bonuses, …).
2. Bakes the extracted text into `armory_data.json` as `tooltip` (raw OCR text) + `stats` (structured), and **removes the `image` field from the app dataset**.
3. Replaces every hotlinked `<img>` with a **CSS-drawn tooltip box that mimics the look of the screenshot** (dark panel, rarity-colored name, stat lines) — hover tooltip and armor-builder slots.

## Current state (verified)

- `research/armory_data.json` — pretty-printed canonical dataset (2.1 MB, 38–39 sections, 4,744 items, 4,539 unique ids); every item has `"image": "https://static.is-better-than.tv/armory/<slug>.jpg"`.
- `armory/src/data/armory_data.json` — minified copy the app loads (1.2 MB), produced by the copy step in `README.md`.
- `scripts/parse_armory.py` — generates `research/armory_data.json` from `research/sections/*.html`; item shape is `{id, name, rarity, slot, price, drop, image}`.
- `armory/src/types.ts` — `Item.image: string | null`.
- `armory/src/components/ItemTooltip.tsx` — hover tooltip renders `<img src={tip.item.image}>` (fallback `.missing` message).
- `armory/src/pages/BuilderPage.tsx` — equipped slots render `<img src={item.image}>` inside `.slotCell .equipped`.
- `armory/src/styles/armory.css` — `.itemTooltip` frame, `.itemTooltip img`, `.slotCell .equipped img` rules; rarity color vars (`--r-*`) and classes (`r-rare`, `r-epic`, …) already exist.
- `armory/src/lib/classView.test.ts` — fixture builds `Item` with `image: null` (must change with the type).
- No images are downloaded locally yet; no OCR deps installed.

## Decisions

- **OCR engine: Tesseract** (user choice). Needs a one-time install on Windows (winget/choco) + `pip install pillow pytesseract`.
- Store **both** `tooltip` (raw OCR text, newline-joined) and `stats` (best-effort structured parse) per item. The box renders structured fields where parsed, raw text otherwise — nothing is lost if parsing is imperfect.
- `research/armory_data.json` **keeps** `image` as provenance (lets us re-download/re-OCR); the **app dataset** (`armory/src/data/armory_data.json`) **drops** `image`.
- Items whose image 404s or OCRs to nothing get `tooltip: null` / `stats: null` and show the existing graceful fallback message.
- Search (`,lib/search.ts`) is untouched — out of scope, no new behavior requested.

## Steps

### 1. Tesseract + Python deps (requires user consent — installs software)

- Check `tesseract --version`. If missing: `winget install --id UB-Mannheim.TesseractOCR -e` (fallback `choco install tesseract`), ensure it's on `PATH` or note the exe path.
- `python -m pip install pillow pytesseract` (only new deps; download uses stdlib `urllib`).
- Verify `pytesseract.get_tesseract_version()` resolves (set `pytesseract.pytesseract.tesseract_cmd` to the install path on Windows).

### 2. New pipeline script — `scripts/extract_tooltips.py`

Purpose: download → preprocess → OCR → parse → merge. **Resumable**: never re-does finished work.

- CLI flags: `--sample N` (only first N unique images), `--force-download`, `--skip-download`, `--ocr-engine` (default `tesseract`), `--workers N` (default 8), `--verbose`.
- **Collect**: load `research/armory_data.json`, map `item_id → image url` (unique URLs only, keep first item id per url).
- **Download** (`research/images/<basename>`): stdlib `urllib` with `User-Agent`, cache-skip, 3 retries, 30 s timeout, `ThreadPoolExecutor` (8 workers), polite delay. Record failures.
- **Preprocess** (Pillow): open, convert to grayscale, **2× LANCZOS upscale**, autocontrast, optional Otsu-style threshold flag (`--binarize`) because colored text on dark panels varies — tune on the sample run.
- **OCR**: `pytesseract.image_to_string(img, lang="eng", config="--oem 3 --psm 6")`. Post-process: strip blank lines, collapse runs of whitespace, drop pure-punctuation garbage, cap line length.
- **Parse** into `ItemStats`:
  - `^Binds on pickup$` → `binds`
  - `^Level[: ]?\s*(\d+)$` → `level`
  - `^Armor[: ]?\s*(\d+)$` → `armor`
  - `^Damage[: ]?\s*([\d\s,]+)\s*-\s*([\d\s,]+)$` → `damage {min,max}`
  - `^DPS[: ]?\s*([\d.]+)$` → `dps`
  - `^\+(\d+)\s+(.+)$` → `attributes` (`"+42 Strength"`)
  - `^Requires\s+(.+)$` → `requires`
  - `^Equip:\s*(.+)$` → `effects`
  - `^Set:\s*(.+)$` → `set`; `^\((\d+)\)\s*Set Bonus:\s*(.+)$` → `setBonuses`
  - unrecognized lines (item-type line, sockets, lore paragraphs) → kept in order in `lines`; plain-paragraph accumulation → `description`
- **Cache**: write `research/tooltips.json` as `{ "<itemId>": { "tooltip": "...", "stats": {...} } }` (plus `images_ok`/`images_failed` arrays). Reruns skip ids already present unless `--force`.
- **Merge** (`--merge`): add `tooltip` + `stats` to each item in `research/armory_data.json` (keep `image`); then write the **app dataset** `armory/src/data/armory_data.json` minified (`json.dumps(..., ensure_ascii=False, separators=(",", ":"))`) with `image` **removed**. Print per-stage counts (downloaded/ok/failed/ocr-empty/merged) and write `research/tooltips_report.json`.

### 3. Run the pipeline in stages

1. `python scripts/extract_tooltips.py --sample 25` → inspect `research/images/*` + OCR text side by side; **tune preprocessing** (binarize on/off, upscale factor, psm) until quality is good.
2. Full run: `python scripts/extract_tooltips.py` (long — ~4.5k downloads + OCR; run as a detached background job and inspect the terminal result before declaring completion; resumable on interruption).
3. Review `research/tooltips_report.json`: % downloads ok, % OCR empty. Spot-check a random sample (~30) of `research/tooltips.json` entries against the images.
4. `python scripts/extract_tooltips.py --merge` → regenerates both JSONs.

### 4. Types — `armory/src/types.ts`

- Replace `image: string | null; // tooltip screenshot url` with:

```ts
export interface ItemStats {
  level?: number;
  type?: string;             // e.g. "Legs", "Two-handed Sword"
  armor?: number;
  damage?: { min: number; max: number };
  dps?: number;
  attributes: string[];      // e.g. ["+42 Strength"]
  effects: string[];         // "Equip: ..." lines
  requires?: string;
  binds?: string;            // "Binds on pickup"
  set?: string;
  setBonuses: string[];      // "(2) Set Bonus: ..."
  description?: string;
  lines: string[];           // remaining lines, in order
}

// in Item:
  tooltip: string | null;    // raw OCR text of the tooltip screenshot
  stats: ItemStats | null;   // best-effort structured parse
```

### 5. New component — `armory/src/components/ItemTooltipBox.tsx`

Renders the **CSS mock of the tooltip screenshot**:

- Props: `{ item: Item; compact?: boolean }`.
- Header: item name in `RARITY_CLASS[item.rarity]` (bold, rarity color) — same visual language as the screenshot's colored name.
- Body: if `item.stats` — `type`/`level` line, `armor`/`damage … dps` lines, then `attributes`, `effects`, `requires`, `set` + `setBonuses`, `description`, then leftover `lines`; if only `item.tooltip` — render the raw lines; if neither — the existing "No tooltip data available" fallback text.
- `compact` (builder slots): smaller font, name + first ~4 lines, `max-height` + ellipsis overflow.
- One `<div className="tooltipBox …">` root, no `<img>` anywhere.

### 6. Wire it in

- `armory/src/components/ItemTooltip.tsx` — replace the `<img>` branch with `<ItemTooltipBox item={tip.item} />` inside the existing `.itemTooltip` float frame; drop the `tip.item.image` condition.
- `armory/src/pages/BuilderPage.tsx` — replace `{item.image ? <img …/> : <span>…</span>}` with `<ItemTooltipBox item={item} compact />`.

### 7. CSS — `armory/src/styles/armory.css`

- Replace `.itemTooltip img` rule; add `.tooltipBox` (dark `#1a1512` panel, 1px `var(--gold)` border, 6px radius, padding, cream stat text, `max-width: 340px`) with `.tooltipBox .tooltipName` (rarity color via existing `r-*` classes), `.tooltipBox .line`, `.tooltipBox.compact` sizing, `.tooltipBox .missing` (reuse existing message styling). Keep the `.itemTooltip` float frame + box-shadow as-is. Remove/adjust `.slotCell .equipped img`.

### 8. Tests

- `armory/src/lib/classView.test.ts` — fixture: `image: null` → `tooltip: null, stats: null`.
- New `armory/src/components/ItemTooltipBox.test.tsx` (vitest + testing-library, already in the stack): renders rarity-colored name; renders a parsed stat line; renders fallback message when `tooltip`/`stats` are null.

### 9. Docs

- Root `README.md`: update **Data pipeline** (add `extract_tooltips.py` step + regenerate commands), **Notes & limitations** (tooltips are now OCR-extracted text in a CSS box, no more hotlinking `static.is-better-than.tv`; image URLs kept in `research/` for provenance; OCR quality caveat + where the report lives). Update the feature bullet mentioning hotlinked screenshots.
- `armory/README.md` — only if it mentions tooltips/images (checked: it doesn't).

### 10. Verification

- Pipeline: sample spot-check of OCR vs image; full-run report numbers sane (≥ ~95% downloads ok; low OCR-empty rate).
- `cd armory && npm run build && npm test && npm run lint`.
- Manual: hover item names (tooltip box shows stats, no network requests to `static.is-better-than.tv`), open `/builder`, equip items (compact box renders), check an item that failed OCR shows the fallback.
- Grep to confirm no `static.is-better-than.tv` references remain in `armory/src`.

## Risks

- **OCR accuracy on stylized colored game text** — mitigated by preprocessing tuning in the sample stage; worst case the box shows whatever text was extracted (raw `tooltip` is preserved so it can be re-parsed later without re-OCR).
- **Dead image URLs** — some downloads may 404; those items get `tooltip: null` and the graceful fallback. Failures are listed in the report so they can be revisited (e.g., Wayback fallback later, out of scope).
- **Install consent** — Tesseract + pip installs happen on the user's machine; step 1 requires explicit go-ahead during execution.
- **Long runtime** (~4.5k downloads + OCR) — mitigated by resumability, parallelism, and running as a detached background job whose terminal result is inspected before completion is claimed.
- **Windows Tesseract PATH** — `pytesseract.tesseract_cmd` may need the full exe path.
