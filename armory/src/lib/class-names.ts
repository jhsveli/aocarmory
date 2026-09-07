/**
 * Class-tag helpers for the Armor Sets page (class -> set usability).
 *
 * These are pure lookup tables (no dataset), so they live outside data/index
 * and can be imported without pulling the armory dataset into a bundle.
 */

/** Known AoC class names (from the Armor Sets page) plus short tags. */
export const CLASS_NAMES: Record<string, string> = {
  assassin: "Assassin",
  barbarian: "Barbarian",
  "bear shaman": "Bear Shaman",
  "herald of xotli": "Herald of Xotli",
  necromancer: "Necromancer",
  "priest of mitra": "Priest of Mitra",
  ranger: "Ranger",
  "dark templar": "Dark Templar",
  guardian: "Guardian",
  "conqueror (2h)": "Conqueror",
  conqueror: "Conqueror",
  "tempest of set": "Tempest of Set",
  "demonologist": "Demonologist",
  demo: "Demonologist",
  hox: "Herald of Xotli",
  sin: "Assassin",
  barb: "Barbarian",
  bs: "Bear Shaman",
  necro: "Necromancer",
  pom: "Priest of Mitra",
  dt: "Dark Templar",
  guard: "Guardian",
  conq: "Conqueror",
  tos: "Tempest of Set",
};

/** Expand a set class tag like "Demo/Necro" into full class names. */
export function expandClassTags(tags: string[]): string[] {
  const out = new Set<string>();
  for (const tag of tags) {
    for (const part of tag.split("/")) {
      const key = part.trim().toLowerCase();
      if (CLASS_NAMES[key]) out.add(CLASS_NAMES[key]);
      else out.add(part.trim());
    }
  }
  return [...out];
}
