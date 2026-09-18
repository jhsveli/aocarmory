// Item filtering for Section pages: rarity threshold + Requires Level range.

import type { Category, Item, Location, Rarity, Section, Set as ItemSet } from "../types";
import { RARITIES } from "./search";

export interface ItemFilters {
  /** lowest rarity to show; RARITIES[0] ("Mundane") means unfiltered */
  minRarity?: Rarity;
  minLevel?: number;
  maxLevel?: number;
}

export function isFilterActive(filters: ItemFilters): boolean {
  return (
    (!!filters.minRarity && filters.minRarity !== RARITIES[0]) ||
    filters.minLevel != null ||
    filters.maxLevel != null
  );
}

function itemPasses(item: Item, filters: ItemFilters): boolean {
  if (filters.minRarity && filters.minRarity !== RARITIES[0]) {
    const idx = item.rarity ? RARITIES.indexOf(item.rarity) : -1;
    if (idx < RARITIES.indexOf(filters.minRarity)) return false;
  }
  const level = item.stats?.requiresLevel;
  if (level != null) {
    if (filters.minLevel != null && level < filters.minLevel) return false;
    if (filters.maxLevel != null && level > filters.maxLevel) return false;
  }
  return true;
}

export interface FilterResult {
  section: Section;
  hiddenCount: number;
}

/** Filters a section's items, pruning Sets/Categories/Locations left with none. */
export function filterSection(section: Section, filters: ItemFilters): FilterResult {
  if (!isFilterActive(filters)) return { section, hiddenCount: 0 };

  let hiddenCount = 0;
  const locations: Location[] = [];
  for (const loc of section.locations) {
    const categories: Category[] = [];
    for (const cat of loc.categories) {
      const sets: ItemSet[] = [];
      for (const set of cat.sets) {
        const items = set.items.filter((item) => {
          const ok = itemPasses(item, filters);
          if (!ok) hiddenCount++;
          return ok;
        });
        if (items.length > 0) sets.push({ ...set, items });
      }
      if (sets.length > 0) categories.push({ ...cat, sets });
    }
    if (categories.length > 0) locations.push({ ...loc, categories });
  }
  return { section: { ...section, locations }, hiddenCount };
}
