# Plan: transition to CSS Modules

Goal: replace the single global stylesheet (`armory/src/styles/armory.css`, ~672
lines, ~80 classes) with CSS Modules (`*.module.css`), keeping only genuinely
global rules in a small `global.css`.

## Current state

- All CSS lives in `armory/src/styles/armory.css`, imported once in `App.tsx`.
- Most class names are used by exactly one component; a handful are shared
  (`page-intro` ×17, `content` ×10, `contentWrap`, `rightColumn`, `itemSlot`,
  `sep`, `nodeLabel`, `children`).
- Vite supports CSS Modules out of the box (kebab-case names → camelCase JS
  keys, e.g. `styles.panelImageLabel`). No config changes needed.

## Structural realities that shape the work

1. **Globals that must stay global** — `:root` design tokens, element resets
   (`body`, `a`, `h1–h4`, `hr`), and bare-string utility classes
   (`page-intro`, `itemSlot`, rarity colors `r-*`).
2. **Dynamic class maps** — `RARITY_CLASS` (`r-rare`…), `SLOT_LABEL`,
   `BIND_LABEL`, and `Collapsible`'s `expanded`/`collapsed` plus location-type
   classes (`merchant`/`dungeon`/`raid`).
3. **Cross-component descendant selectors** — `.itemPanel .tooltipBox`,
   `.builderSearchList .itemName`, `.slotCell .equippedName`,
   `.tooltipBox .r-rare` (lightened colors). These break under hashing and
   need explicit seams.
4. **Tests query raw class names** — `app.test.tsx` uses
   `.itemPanel .tooltipName`, `.itemTooltip .tooltipName`, `.sets .nodeLabel`,
   `.itemName`, `.itemPanel .panelImage img`; `ItemTooltipBox.test.tsx` checks
   `className` and `.tooltipBox.compact`. Under Vitest's default (`css: false`)
   module class lookups are `undefined`; with `css: true` the names are hashed.
   Tests must move to role/text queries first (Phase 0).

## Target structure

```
src/styles/global.css          # tokens, resets, utilities (.page-intro, .item-slot, .r-*)
src/styles/layout.module.css   # content, contentWrap, rightColumn, rightBox
src/components/<Name>.module.css   # colocated, one per component
src/pages/<Name>.module.css        # one per page
```

| Module | Classes |
|---|---|
| `global.css` | `:root` vars, `body`/`a`/`h*`/`hr` resets, `.page-intro`, `.item-slot`, `.r-*` (+ lightened tooltip variants via `:global`) |
| `layout.module.css` | `content`, `contentWrap`, `rightColumn`, `rightBox` (+ `.header`/`.body`) |
| `Layout.module.css` | `menuBar`, `menuLinks`, `sep`, `authLinks`, `page`, `topmenu`, `mainmenu`, `searchForm`, `banner`, `bottommenu`, `sectionmenu`, `footer`, `paypal` |
| `ItemTooltipBox.module.css` | `tooltipBox`, `tooltipName`, `line`, `missing`, `compact`, `.tooltipBox :global(.r-*)` lightened |
| `ItemDetailsPanel.module.css` | `itemPanel`, `panelHeader`, `panelTitle`, `panelClose`, `panelEmpty`, `panelImage`, `panelImageLabel`, `itemPanelIn` keyframes, in-panel tooltip override |
| `ItemTooltip.module.css` | `itemTooltip` |
| `SectionTree.module.css` | `locations`, `categories`, `sets`, `items`, `nodeLabel` context, `merchant/dungeon/raid`, `builderLink`, `itemPrice`, `coin`, `setClasses` |
| `ClassTree.module.css` | `setContext` |
| `Collapsible.module.css` | `nodeLabel`, `expanded`, `collapsed`, `children` |
| `ItemName.module.css` | `itemName` (rarity stays global) |
| `ViewToggle.module.css` | `viewToggle` |
| `BuilderPage.module.css` | `builderHead`…`removeBtn` (~15 classes) |
| `SearchPage.module.css` | `searchResults`, `searchMeta`, `searchExamples` |
| `ArmorSets/Factions/About/Links/Home/SectionPage/AttributeCalculator.module.css` | their unique classes (incl. `statsTable`, `armorSetsGrid`, `factionOppositions`, `milestones`, `linksList`, `calc*`) |

## The four tricky seams (solve up front)

1. **Cross-component overrides → component seams, not descendant selectors**:
   - `ItemTooltipBox` gets an optional `className` prop; `ItemDetailsPanel`
     passes its panel override class (precedent: `ItemName` accepts
     `className`).
   - `BuilderPage` passes a module class to `ItemName` for `flex: 1`;
     `slotCell`/`equippedName` live entirely in `BuilderPage.module.css`
     (via the `className` prop or `composes:`).
   - `Collapsible` already has a `className` prop — `SectionTree` passes its
     node classes for location styling.
2. **Rarity colors**: keep `r-*` as global utilities (pure color maps used by
   two components); the tooltip lightened variants become
   `.tooltipBox :global(.r-rare)`.
3. **Shared layout**: `content`/`contentWrap`/`rightColumn`/`rightBox` used by
   Home, Section, Search pages → single `layout.module.css` imported by each.
4. **Media queries**: the 900px responsive block spans menu/layout/builder →
   each module carries its own small `@media` block.

## Migration phases (incremental, green at every step)

- **Phase 0 — Safety net (done):** baseline `vitest`, `tsc -b`, `oxlint`,
  `vite build` green. Rewrite class-name-coupled test assertions to role/text
  queries; add stable, semantic DOM hooks where a role isn't natural:
  `role="tooltip"` on the floating tooltip, `role="button"` +
  `aria-expanded` on collapsible labels (with keyboard support),
  `data-testid="item-name"` on item links.
- **Phase 1 — `global.css`:** extract tokens/resets/utilities. Zero visual
  change; `armory.css` keeps the rest.
- **Phase 2 — Leaf modules** (no shared-class consumers): `ItemName`,
  `ViewToggle`, `Collapsible`, `AttributeCalculator`, and the unique-class
  pages (`Home`, `ArmorSets`, `Factions`, `About`, `Links`, `SectionPage`).
- **Phase 3 — Cross-cutting:** `ItemTooltipBox` + `className` prop, then
  `ItemDetailsPanel`, `ItemTooltip`, `layout.module.css`, `Layout`,
  `SectionTree`/`ClassTree`, `SearchPage`, `BuilderPage` — order matters
  because of the seams (e.g. `ItemTooltipBox`'s prop must land with its
  consumers).
- **Phase 4 — Delete `armory.css`** once the last rule moves; final full
  verification + browser pass of every page.

Each phase: move rules → remove from `armory.css` → tests + `tsc` + lint +
build + eyeball the affected pages. Rollback is a per-phase revert.

## Conventions

- File-per-component, colocated (`Component.module.css` beside the `.tsx`).
- CSS: kebab-case names (`.panel-image-label`); JS: `styles.panelImageLabel`
  (Vite's default `camelCaseOnly`).
- Keep global only what's genuinely cross-cutting; everything else scoped.

## Risks

- **Tests** — the main one; handled in Phase 0 so the rest of the migration
  never carries it.
- **Accidental global leakage** — mitigated by the explicit `global.css`
  allowlist (tokens, resets, `page-intro`, `itemSlot`, `r-*`).
- **`:global()` misuse** — only two places need it (tooltip rarity overrides).
- **Churn in unrelated PRs** — phases are small and independently verifiable;
  the global CSS file shrinks monotonically.
