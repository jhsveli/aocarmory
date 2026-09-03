// Derive machine-usable slot info from the tooltip stats.
//
// Item.slot (the HTML classification) was removed in favor of the tooltip's
// stats.type + stats.slots. These helpers reconstruct what the UI needs:
// the builder's slot key (head, 1he, ...) and the bracket label shown next
// to item names in the browse/search lists.

import type { ItemStats, Slot } from "../types";

/** Armor kinds whose stats.slots entries are worn positions (Hands, Head, ...). */
const ARMOR_KINDS = new Set([
  "Cloth Armor",
  "Light Armor",
  "Medium Armor",
  "Heavy Armor",
  "Full Plate Armor",
  "Social",
]);

/** Worn position (tooltip slot token) -> builder slot key. */
const POSITION_SLOT: Record<string, Slot> = {
  Hands: "hands",
  Head: "head",
  Chest: "chest",
  Legs: "legs",
  Feet: "feet",
  Belt: "belt",
  Shoulder: "shoulder",
  Wrist: "wrist",
  Back: "back",
  Cloak: "back",
};

/** Equipment kind (tooltip type) -> builder slot key for non-armor items. */
const KIND_SLOT: Record<string, Slot> = {
  Cloak: "back",
  Ring: "ring",
  Necklace: "necklace",
  "One-Handed Blunt": "1hb",
  "One-Handed Edged": "1he",
  "Two-Handed Blunt": "2hb",
  "Two-Handed Edged": "2he",
  Dagger: "dagger",
  Talisman: "talisman",
  Shield: "shield",
  Staff: "staff",
  Polearm: "polearm",
  Bow: "bow",
  Crossbow: "crossbow",
  Ammunition: "ammunition",
  Thrown: "thrown",
};

/** The builder/equip slot key for an item, derived from its tooltip stats. */
export function equipSlotKey(stats: ItemStats | null): Slot | null {
  if (!stats?.type) return null;
  if (ARMOR_KINDS.has(stats.type)) {
    const position = stats.slots?.[0];
    return (position && POSITION_SLOT[position]) || null;
  }
  return KIND_SLOT[stats.type] ?? null;
}

/**
 * Bracket label shown next to item names, e.g. "[Hands]" or
 * "[Two-Handed Edged]". Armor shows its worn position; everything else its
 * equipment kind.
 */
export function slotDisplay(stats: ItemStats | null): string | null {
  if (!stats?.type) return null;
  if (ARMOR_KINDS.has(stats.type)) {
    return stats.slots?.length ? stats.slots.join(", ") : stats.type;
  }
  return stats.type;
}
