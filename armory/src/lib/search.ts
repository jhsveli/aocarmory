// Client-side search over the armory dataset.
// Mirrors the original site's search: you can type any of
// section / location / category / set / item, plus class tags
// (sin, hox, ...), slot names (hands, chest, ...) and rarities.

import { flatItems, CLASS_NAMES, expandClassTags } from "../data";
import type { FlatItem } from "../data";
import type { Rarity } from "../types";

export const RARITIES: Rarity[] = ["Mundane", "Superior", "Enchanted", "Rare", "Epic", "Legendary"];

export const SLOT_ALIASES: Record<string, string> = {
  head: "head", helmet: "head", mask: "head", hood: "head", helm: "head",
  shoulder: "shoulder", shoulders: "shoulder", pauldron: "shoulder", pauldrons: "shoulder",
  chest: "chest", tunic: "chest", torso: "chest", body: "chest", armor: "chest",
  hands: "hands", glove: "hands", gloves: "hands", gauntlet: "hands", gauntlets: "hands",
  belt: "belt", belts: "belt", girdle: "belt", cord: "belt",
  legs: "legs", leg: "legs", pants: "legs", leggings: "legs", fauld: "legs",
  feet: "feet", foot: "feet", boots: "feet", boot: "feet", shoes: "feet",
  wrist: "wrist", wrists: "wrist", bracer: "wrist", bracers: "wrist", armbands: "wrist", armband: "wrist",
  back: "back", cloak: "back", cape: "back",
  necklace: "necklace", neck: "necklace", amulet: "necklace", talisman: "talisman",
  ring: "ring", rings: "ring",
  "1hb": "1hb", "1he": "1he", "2hb": "2hb", "2he": "2he",
  bow: "bow", crossbow: "crossbow", dagger: "dagger", polearm: "polearm",
  staff: "staff", shield: "shield", ammunition: "ammunition", quiver: "ammunition",
  weapon: "weapon",
};

export interface SearchMatch {
  item: FlatItem;
  /** which fields hit, for display */
  reasons: string[];
  score: number;
}

function tokenize(q: string): string[] {
  return q.toLowerCase().split(/[\s+]+/).filter(Boolean);
}

export function searchArmory(query: string): SearchMatch[] {
  const q = query.trim();
  if (!q) return [];
  const tokens = tokenize(q);
  const results: SearchMatch[] = [];

  for (const fi of flatItems) {
    const it = fi.item;
    const hay = {
      name: it.name?.toLowerCase() ?? "",
      section: fi.section.toLowerCase(),
      location: fi.location.toLowerCase(),
      category: fi.category.toLowerCase(),
      set: fi.set.toLowerCase(),
      rarity: it.rarity?.toLowerCase() ?? "",
      slot: it.slot?.toLowerCase() ?? "",
      slotAlias: it.slot ? (SLOT_ALIASES[it.slot] ?? "") : "",
      classes: expandClassTags(fi.setClasses).map((c) => c.toLowerCase()),
      drop: it.drop?.toLowerCase() ?? "",
    };
    const reasons: string[] = [];
    let score = 0;
    for (const tok of tokens) {
      let hit = false;
      if (hay.name.includes(tok)) { hit = true; score += 5; }
      if (hay.set.includes(tok)) { hit = true; score += 4; }
      if (hay.location.includes(tok)) { hit = true; score += 3; }
      if (hay.category.includes(tok)) { hit = true; score += 2; }
      if (hay.section.includes(tok)) { hit = true; score += 2; }
      if (hay.rarity === tok) { hit = true; score += 3; reasons.push("rarity"); }
      if (hay.slot === tok || hay.slotAlias === tok || SLOT_ALIASES[tok] === hay.slot) {
        hit = true; score += 3; reasons.push("slot");
      }
      if (CLASS_NAMES[tok] && hay.classes.includes(CLASS_NAMES[tok].toLowerCase())) {
        hit = true; score += 3; reasons.push("class");
      }
      if (hay.drop.includes(tok)) { hit = true; score += 2; }
      if (!hit) { score = 0; break; }
    }
    if (score > 0) {
      const reasonsSet = new Set(reasons);
      if (reasonsSet.size === 0) {
        if (hay.name.includes(tokens[0])) reasonsSet.add("item");
        else if (hay.set.includes(tokens[0])) reasonsSet.add("set");
        else if (hay.location.includes(tokens[0])) reasonsSet.add("location");
        else if (hay.category.includes(tokens[0])) reasonsSet.add("category");
        else if (hay.section.includes(tokens[0])) reasonsSet.add("section");
      }
      results.push({ item: fi, reasons: [...reasonsSet], score });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, 300);
}
