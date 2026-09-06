// Small formatting helpers shared across the app.

import type { BindType, Price } from "../types";

export const IMG_BASE = "https://static.is-better-than.tv";

/**
 * Display metadata for every coin currency in the dataset. The key is the
 * currency code stored in item.price; legacy codes map to their original icon
 * names, everything else uses the icon's own filename stem.
 */
const COINS: Record<string, { file: string; title: string }> = {
  mark: { file: "mark_of_acclaim.png", title: "Mark of Acclaim" },
  trophy: { file: "rare_trophy.png", title: "Rare Trophy" },
  gold: { file: "gold.png", title: "Gold" },
  simple_trophy_i: { file: "simple_trophy_i.png", title: "Simple Trophy I" },
  simple_trophy_ii: { file: "simple_trophy_ii.png", title: "Simple Trophy II" },
  simple_trophy_iii: { file: "simple_trophy_iii.png", title: "Simple Trophy III" },
  simple_relic_i: { file: "simple_relic_i.png", title: "Simple Relic I" },
  simple_relic_ii: { file: "simple_relic_ii.png", title: "Simple Relic II" },
  simple_relic_iii: { file: "simple_relic_iii.png", title: "Simple Relic III" },
  simple_relic_iv: { file: "simple_relic_iv.png", title: "Simple Relic IV" },
  simple_relic_v: { file: "simple_relic_v.png", title: "Simple Relic V" },
  simple_relic_vi: { file: "simple_relic_vi.png", title: "Simple Relic VI" },
  rare_relic: { file: "rare_relic.png", title: "Rare Relic" },
  mythical_relic: { file: "mythical_relic.png", title: "Mythical Relic" },
  campaign_badges: { file: "campaign_badges.png", title: "Campaign Badges" },
  conquest_trophies: { file: "conquest_trophies.png", title: "Conquest Trophies" },
  atlantean_shards: { file: "atlantean_shards.png", title: "Atlantean Shards" },
  dragon_tear: { file: "dragon_tear.png", title: "Dragon Tear" },
  emerald_essence: { file: "emerald_essence.png", title: "Emerald Essence" },
  shard_of_pure_ice: { file: "shard_of_pure_ice.png", title: "Shard of Pure Ice" },
  copper: { file: "copper.png", title: "Copper" },
  tin: { file: "tin.png", title: "Tin" },
};

export function coinSrc(currency: string): string {
  const coin = COINS[currency];
  return `/img/${coin?.file ?? `${currency}.png`}`;
}

export const COIN_TITLES: Record<string, string> = Object.fromEntries(
  Object.entries(COINS).map(([code, meta]) => [code, meta.title]),
);

/** Bind enum -> the line as it appears in the in-game tooltip. */
export const BIND_LABEL: Record<BindType, string> = {
  BIND_ON_PICKUP: "Binds when Picked Up",
  BIND_ON_EQUIP: "Binds when Equipped",
  NO_BIND: "No Bind",
};

export function hasPrice(p: Price | null): boolean {
  if (!p) return false;
  return Object.values(p).some((amount) => amount > 0);
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
