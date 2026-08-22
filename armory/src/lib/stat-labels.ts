/**
 * Display language for item stat properties.
 *
 * Keys are the normalized property names produced by
 * scripts/extract_tooltips.py (lowercase OCR keys); values are the
 * human-readable labels shown in the item detail panel. Anything missing
 * here falls back to statLabel()'s title-casing.
 */

export const STAT_LABELS: Record<string, string> = {
  // scalar stat properties
  itemLevel: "Item Level",
  requiresLevel: "Requires Level",
  armor: "Armor",
  critigation: "Critigation Amount",

  // attribute names
  constitution: "Constitution",
  strength: "Strength",
  dexterity: "Dexterity",
  intelligence: "Intelligence",
  wisdom: "Wisdom",
  stamina: "Stamina",
  health: "Health",
  mana: "Mana",
  tenacity: "Tenacity",
  ferocity: "Ferocity",
  "hit rating": "Hit Rating",
  "critical rating": "Critical Rating",
  "critical damage rating": "Critical Damage Rating",
  "combat rating": "Combat Rating",
  "hate decrease rating": "Hate Decrease Rating",
  "hate increase rating": "Hate Increase Rating",
  "heal rating": "Heal Rating",
  "immunity rating": "Immunity Rating",
  "evade rating": "Evade Rating",
  "fatality rating": "Fatality Rating",
  "offhand rating": "Offhand Rating",
  "mana tap rating": "Mana Tap Rating",
  "health tap rating": "Health Tap Rating",
  "stamina tap rating": "Stamina Tap Rating",
  "magic mana tap rating": "Magic Mana Tap Rating",
  "magic life tap rating": "Magic Life Tap Rating",
  "magic stamina tap rating": "Magic Stamina Tap Rating",
  "natural mana regen": "Natural Mana Regen",
  "natural stamina regen": "Natural Stamina Regen",
  "natural health regen": "Natural Health Regen",
  "pvp protection": "PvP Protection",
  "pvp hit rating": "PvP Hit Rating",
  "pvp combat rating": "PvP Combat Rating",
  "pvp armor": "PvP Armor",
  "pvp magic damage": "PvP Magic Damage",
  "casting concentration skill": "Casting Concentration Skill",
  "hiding skill": "Hiding Skill",
  "taunt skill": "Taunt Skill",
  "perception skill": "Perception Skill",
  "bow range modifier": "Bow Range Modifier",
  "crossbow range modifier": "Crossbow Range Modifier",
  "magic damage": "Magic Damage",
  "magic damage (fire)": "Magic Damage (Fire)",
  "magic damage (electrical)": "Magic Damage (Electrical)",
  "magic damage (holy)": "Magic Damage (Holy)",
  "magic damage (unholy)": "Magic Damage (Unholy)",
  "magic damage (cold)": "Magic Damage (Cold)",
  "protection": "Protection",
  "protection (fire)": "Protection (Fire)",
  "protection (cold)": "Protection (Cold)",
  "protection (unholy)": "Protection (Unholy)",
  "protection (holy)": "Protection (Holy)",
  "protection (electrical)": "Protection (Electrical)",
  "combat rating (2hb)": "Combat Rating (2HB)",
  "combat rating (2he)": "Combat Rating (2HE)",
  "combat rating (1hb)": "Combat Rating (1HB)",
  "combat rating (1he)": "Combat Rating (1HE)",
  "combat rating (dagger)": "Combat Rating (Dagger)",
  "combat rating (bow)": "Combat Rating (Bow)",
  "combat rating (crossbow)": "Combat Rating (Crossbow)",
  "combat rating (polearm)": "Combat Rating (Polearm)",
  "combat rating (fire)": "Combat Rating (Fire)",
  "combat rating (cold)": "Combat Rating (Cold)",
  "combat rating (holy)": "Combat Rating (Holy)",
  "combat rating (electrical)": "Combat Rating (Electrical)",
  "combat rating (unholy)": "Combat Rating (Unholy)",
};

/** Resolve a normalized property name to its display label. */
export function statLabel(key: string): string {
  const known = STAT_LABELS[key];
  if (known) return known;
  return key
    .split(/\s+/)
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}
