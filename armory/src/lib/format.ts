// Small formatting helpers shared across the app.

import type { BindType, Price } from "../types";

export const IMG_BASE = "https://static.is-better-than.tv";

export function coinSrc(kind: "mark" | "trophy" | "gold" | "silver"): string {
  const map = {
    mark: "mark_of_acclaim.png",
    trophy: "rare_trophy.png",
    gold: "gold.png",
    silver: "silver.png",
  };
  return `/img/${map[kind]}`;
}

export const COIN_TITLES: Record<keyof Price, string> = {
  mark: "Mark of Acclaim",
  trophy: "Rare Trophy",
  gold: "Gold",
  silver: "Silver",
};

/** Bind enum -> the line as it appears in the in-game tooltip. */
export const BIND_LABEL: Record<BindType, string> = {
  BIND_ON_PICKUP: "Binds when Picked Up",
  BIND_ON_EQUIP: "Binds when Equipped",
  NO_BIND: "No Bind",
};

export function hasPrice(p: Price | null): boolean {
  if (!p) return false;
  return p.mark > 0 || p.trophy > 0 || p.gold > 0 || p.silver > 0;
}

/** Rarity -> CSS class used for item names. */
export const RARITY_CLASS: Record<string, string> = {
  Mundane: "r-mundane",
  Superior: "r-superior",
  Enchanted: "r-enchanted",
  Rare: "r-rare",
  Epic: "r-epic",
  Legendary: "r-legendary",
};

export const SLOT_LABEL: Record<string, string> = {
  head: "Head", shoulder: "Shoulder", chest: "Chest", hands: "Hands",
  belt: "Belt", legs: "Legs", feet: "Feet", wrist: "Wrist",
  back: "Back", necklace: "Necklace", ring: "Ring",
  "1hb": "One-Handed Blunt", "1he": "One-Handed Edged", "1heranger": "Ranger 1H",
  "2hb": "Two-Handed Blunt", "2he": "Two-Handed Edged", bow: "Bow",
  crossbow: "Crossbow", dagger: "Dagger", talisman: "Talisman",
  polearm: "Polearm", staff: "Staff", ammunition: "Ammunition", shield: "Shield",
};

export function fmtNumber(n: number): string {
  return n.toLocaleString("en-US");
}
