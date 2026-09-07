# AoC Armory — engineering session (2026-09-07)

Plan / handoff of the changes made in the recent session on `C:\Users\jts\code\aocarmory`. See `docs/Context.md` for the domain glossary.

## Repo layout

- `armory/` — the React + Vite app (Cloudflare Pages, build output `dist`).
- `research/` — archived source HTML (`sections/*.html`, `pages/*.html`) and `armory_data.json` (canonical, pretty-printed).
- `scripts/` — the scraper/massaging pipeline (Python).
- `armory/src/data/armory_data.json` — the app's compact copy of the dataset.

## What changed

### 1. Purchase prices: lost currencies recovered (data + model)

Problem: the original site lists items in many coin types, but `parse_price` in `scripts/parse_armory.py` only recognized Mark of Acclaim / Rare Trophy / Gold / Silver and silently dropped everything else (Simple Trophies I–III, Simple Relics I–VI, Rare/Mythical Relics, Campaign Badges, Conquest Trophies, Atlantean Shards, Dragon Tear, Emerald Essence, Shard of Pure Ice, Copper, Tin).

- `scripts/parse_armory.py` — `parse_price` now accepts any coin icon (key = legacy short code, otherwise the icon stem). Silver followed by text still means **Drop**, not a price.
- `scripts/reparse_prices.py` (new) — re-derived price/drop for 4539 items from the archived section HTML and patched both `research/armory_data.json` and `armory/src/data/armory_data.json` by item id (2763 price fields corrected; drop fields unchanged).
- `armory/src/types.ts` — `Price` is now a coin-code → amount map (`{ [coin]: number }`, only positive amounts stored).
- `armory/src/lib/format.ts` — central `COINS` registry (icon file + display title per currency); `coinSrc(code)` and `COIN_TITLES` are generic; `hasPrice` checks any amount > 0.
- `armory/public/img/` — downloaded the 19 missing coin PNGs from `static.is-better-than.tv/img/` so new currencies display (23 total incl. the original four + `silver.png`).
- `armory/src/components/Price.tsx` — iterates `Object.keys(price)` and renders an icon + amount per stored currency.

Example: "Thug's Belt of Malice" now has price `{ simple_trophy_i: 72, gold: 1 }` (was only `{ gold: 1 }`).

### 2. Tooltip rendering (ItemDetailsBox)

- `statLines` flattening removed → `statBlocks()` builds ordered blocks: `head → values → combat → attributes → tail → vendor → gems → leftover`. Values/damage&dps/attributes render as their own `.statSection`s.
- `StatLine` component (new, `src/components/StatLine.tsx` + module css) renders a numeric value in its own `.num` span; `signed` prop controls the `+` prefix. Value rows render number-first.
- Vendor price renders structurally: each `amount Currency` pair in its own colored span (`.vendorGold/.vendorSilver/.vendorCopper/.vendorTin`), ordered **before** the gem-slot chips.
- `GemSlot` component (new) renders each socket as a label chip over a colored rectangle drawn by `::after`; per-type classes (`gemBlue`, `gemHyperborean`, …) are colorable in `GemSlot.module.css`. Gem slots are their own bottom section in `.gemRow`.

### 3. Cloudflare Pages deploy

- Removed `armory/public/_redirects` (`/* /index.html 200`) — Cloudflare's assets engine rejects it as an infinite loop (code 100324). SPA fallback is handled automatically / via `not_found_handling`.
- Coin currency icons are served locally from `/img/*` instead of hotlinking the archive host.

### 4. Layout / styling

- Bottom section menu grouped via `SECTION_GROUP_DEFS` in `armory/src/data/index.ts` → exported `sectionGroups`: **PvE Raids** (PvE Tier 1–6), **PvP**, **Factions** (11 Khitai factions + Clan Vigdis, explicit order), **Onslaught** (Kutchemes Temple, Skull Gate Pass), plus an automatic **Unsorted** remainder.
- Nested list indentation made fluid via `--list-indent` / `--list-indent-lg` clamp() tokens in `global.css` (less horizontal waste on narrow screens).

### 5. Bundle size: dataset out of the main JS chunk

The ~6 MB `armory_data.json` was statically imported (via `data/index`) into the single 2.87 MB bundle.

- `armory/src/data/index.ts` — no longer imports the JSON statically. `loadArmoryData()` dynamic-imports it once and caches a derived `ArmoryBundle`; `useArmoryData()` (via `useSyncExternalStore`) exposes it reactively (empty until loaded).
- `armory/src/lib/class-names.ts` (new) — pure `CLASS_NAMES`/`expandClassTags`, moved out of the data module so `lib/search` and `lib/classView` don't pull the dataset.
- `armory/src/lib/search.ts` — `searchArmory(query, items)` now takes the item list explicitly.
- Pages/components (`Layout`, `HomePage`, `SectionPage`, `ArmorSetsPage`, `BuilderPage`, `SearchPage`) read from `useArmoryData()`.
- `armory/src/App.tsx` — `AppShell` triggers `loadArmoryData()` and gates routes behind it; `AppRoutes` stays pure for tests.
- Tests: `app.test.tsx` and `lib/logic.test.ts` preload the dataset in `beforeAll`.

Result: initial `index.js` 2.87 MB → **322 KB (gzip ~103 KB)**; dataset is its own async chunk `armory_data-*.js` (gzip ~282 KB), cached by its content hash under `/assets/*`.

## Verification

- `npm run build` (tsc + vite) and `npm run lint` (oxlint) clean.
- Vitest: 55/56 pass. The single failure — `app.test.tsx` "pins an item in the right-side panel…" (expects an `<img>` screenshot inside the panel) — is **pre-existing** and fails identically at clean `HEAD`; unrelated to these changes.

## Open items / next steps

- Route-level lazy loading (#2 from the bundle analysis) — wrap pages in `React.lazy`/`Suspense` so builder/search (pako) load on demand; consider a stable vendor chunk for `react`/`react-router`.
- Optionally serve the dataset as a plain `/data/*` JSON asset with long cache headers instead of an async JS chunk.
- Fix (or update) the pre-existing item-panel screenshot `<img>` test/rendering.
- Remove the tracked `scripts/__pycache__/parse_armory.cpython-313.pyc` change noise from the working tree if not intended.
