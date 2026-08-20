# Add a "By class" view toggle to section browsing

## Summary

Add a view toggle to the section pages (`/s/:id` and `/s/all`): the existing
**By drop location** tree (Section → Location → Category → Set → Item) stays the
default, and a new **By class** view regroups each section's sets by their class
tags: **Section → Class → Set → Item**, with the category and drop-location shown
as small labels under each set (user choice: "flat by class").

Combined class tags stay combined exactly as on the site (user choice: keep
[Demo/Necro] as one group, not split). Sets with no class tag go into a
"No class tag" group so no content disappears. The chosen view is stored in the
URL (`?view=class`) so it is shareable and survives refresh.

## Current state (verified)

- `armory/src/data/index.ts` exports `sections` (from `armory_data.json`), `flatItems`,
  `CLASS_NAMES`, `expandClassTags`.
- `armory/src/components/SectionTree.tsx` renders the location view with
  `LocationNode → CategoryNode → SetNode` using `Collapsible`, `ItemName`, `Price`.
- `armory/src/pages/SectionPage.tsx` looks up the section via `sections.find(...)` and
  renders `<SectionTree section={section} />`; it also renders the stacked "All sections"
  variant for `/s/all`.
- Set class tags live on each set: `set.classes` (e.g. `["HoX"]`, `["Demo/Necro"]`,
  `["All"]`, or `[]`). `CLASS_NAMES` maps short tags to full class names.

## Steps

### 1. Grouping logic — new file `armory/src/lib/classView.ts`

```ts
import type { Section, Set } from "../types";

export interface ClassViewSetEntry {
  set: Set;
  location: string | null; // drop-location context label
  category: string | null; // category context label
}

export interface ClassGroup {
  tag: string;        // original tag, e.g. "HoX", "Demo/Necro", "All"
  fullNames: string[]; // expanded names via expandClassTags (for subtitle)
  sets: ClassViewSetEntry[];
}

export const NO_CLASS_TAG = "No class tag";

export function groupSectionByClass(section: Section): ClassGroup[];
```

Behavior:
- Walk every `location → category → set` in the section.
- If `set.classes` is empty → append to the `NO_CLASS_TAG` group.
- Otherwise, for **each** tag in `set.classes` (kept combined, e.g. "Demo/Necro"
  stays one group): append the set entry to that tag's group. A set tagged
  `["All"]` goes under the "All" group only.
- `fullNames` = `expandClassTags([tag])`.
- Sort groups alphabetically by tag, with `NO_CLASS_TAG` pinned last.
- Sort sets within a group by name.
- Preserve the section's item order inside each set (unchanged).
- Each entry carries `location` (the location name) and `category` (category name)
  for the context labels.

### 2. Extract shared set rendering — edit `armory/src/components/SectionTree.tsx`

- Export `SetLabel` and a new exported `SetItems` component (the `<ul className="items">`
  block: `Price`, `ItemName`, slot/drop labels) so both views render items identically.
- No visual change to the location view.

### 3. Class view — new file `armory/src/components/ClassTree.tsx`

`<ClassTree section={section} />` renders:
- A note line: "Grouped by the original set class tags; [Demo/Necro] is usable by both."
- `<ul className="locations">`-styled list: one `Collapsible` per `ClassGroup`
  (default open), label = tag (bold) + full names as a small subtitle.
- Inside each group: `<ul className="sets">` of sets, each row = `SetLabel`
  (name + `[tag]` + builder link) followed by two small context labels
  (category · drop location), then `SetItems`.
- Reuses `Collapsible`, `ItemName`, `Price`, `SetLabel`, `SetItems`.

### 4. Toggle — edit `armory/src/pages/SectionPage.tsx` (+ shared toggle)

- New small component `ViewToggle` (inline in SectionPage or `src/components/ViewToggle.tsx`):
  segmented control with two buttons — "By drop location" / "By class".
- Read `view` from `useSearchParams()`; `view === "class"` → `<ClassTree>`, else
  `<SectionTree>`. Toggling updates the URL param (`setSearchParams`, replace).
- Apply the same toggle to the `/s/all` stacked page (one toggle governs all sections).
- CSS: add `.viewToggle` styles (segmented buttons, active state) in
  `armory/src/styles/armory.css`.

### 5. Tests

- `armory/src/lib/classView.test.ts`:
  - untagged sets land in `NO_CLASS_TAG`;
  - `["All"]` set lands in the "All" group only;
  - `["Demo/Necro"]` stays one combined group with `fullNames` = both classes;
  - entries carry location/category context; groups and sets sorted.
- `armory/src/test/app.test.tsx`:
  - `/s/14?view=class` shows an "HoX" group containing "Ardent Fire" and the
    location label "Cimmeria :: Kyllikki/Yakhmar/Vistrix";
  - clicking "By class" on `/s/14` switches the tree and updates the URL.

### 6. Docs

- Update the Features section of `README.md` (browse: view toggle by drop location
  or by class).

## Verification

- `npm run build` (tsc + vite) clean.
- `npm run lint` clean.
- `npx vitest run` — all existing 21 tests plus the new grouping/render tests pass.
- Manual: dev server on :5173, open `/s/14`, toggle "By class", confirm HoX group
  shows Ardent Fire with its 8 items and the Cimmeria label; toggle back.

## Risks / notes

- Sets with no tag (weapons, accessories, consumables) appear only in "No class tag";
  they remain fully visible in the default location view.
- No changes to search, the armor builder, or the JSON data — purely a view layer.
