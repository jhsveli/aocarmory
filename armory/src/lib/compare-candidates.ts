import type { FlatItem } from "../data";
import { equipSlotKey } from "./equip";
import { RARITIES, searchArmory } from "./search";
import type { Item } from "../types";

export interface CompareFilters {
  slot: boolean;
  armorType: boolean;
  class: boolean;
  rarity: boolean;
}

export const DEFAULT_COMPARE_FILTERS: CompareFilters = {
  slot: true, armorType: true, class: true, rarity: true,
};

function rarityRank(rarity: Item["rarity"]): number {
  return rarity ? RARITIES.indexOf(rarity) : -1;
}

/** A candidate passes the class filter unless it's restricted to classes that exclude every one of main's. */
function classCompatible(main: Item, candidate: Item): boolean {
  const mainClasses = main.stats?.classes;
  if (!mainClasses?.length) return true; // main isn't class-restricted, nothing to match
  const candidateClasses = candidate.stats?.classes;
  if (!candidateClasses?.length) return true; // candidate is usable by every class
  return candidateClasses.some((c) => mainClasses.includes(c));
}

/**
 * Candidates for the compare page's "Add item to compare" picker: every
 * item, deduped by id, minus those already in the comparison, filtered by
 * whichever "Same: ..." toggles are on (measured against `mainItem`). Without
 * a mainItem there's nothing to match against, so every filter is a no-op.
 * The text query then reuses the global search (slot names like "feet",
 * class tags, rarities, ... — see search.ts), ranked by its relevance score;
 * with no query, results are sorted by rarity descending and then name.
 */
export function findCompareCandidates(
  flatItems: FlatItem[],
  excludeIds: Set<number>,
  mainItem: Item | undefined,
  filters: CompareFilters,
  query: string,
): Item[] {
  const mainSlot = mainItem ? equipSlotKey(mainItem.stats) : null;
  const mainType = mainItem?.stats?.type ?? null;
  const seen = new Set<number>(excludeIds);
  const candidates: FlatItem[] = [];

  for (const f of flatItems) {
    const candidate = f.item;
    if (seen.has(candidate.id)) continue;
    seen.add(candidate.id);
    if (mainItem && filters.slot && mainSlot && equipSlotKey(candidate.stats) !== mainSlot) continue;
    if (mainItem && filters.armorType && mainType && candidate.stats?.type !== mainType) continue;
    if (mainItem && filters.class && !classCompatible(mainItem, candidate)) continue;
    if (mainItem && filters.rarity && candidate.rarity !== mainItem.rarity) continue;
    candidates.push(f);
  }

  const q = query.trim();
  if (q) return searchArmory(q, candidates).map((m) => m.item.item);

  return candidates.map((f) => f.item).sort((a, b) => {
    const rankDiff = rarityRank(b.rarity) - rarityRank(a.rarity);
    return rankDiff !== 0 ? rankDiff : a.name.localeCompare(b.name);
  });
}
