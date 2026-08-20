// Attribute trickle-down calculator.
//
// Based on the officially documented attribute effects (Funcom combat revamp
// patch notes, as reproduced by the AoC community wiki):
//
//   Strength      -> melee combat rating +3, armor +2, stamina +2,
//                    nat. stam regen +0.05, OOC stam regen +0.15,
//                    OOC health regen +0.15
//   Intelligence  -> mage spell damage +0.3/hit, mana +3,
//                    nat. mana regen +0.07, OOC mana regen +0.38,
//                    protection (elec/fire/cold) +0.5
//   Constitution  -> health +5..8 (class dependent), stamina +2,
//                    nat. stam regen +0.05, OOC stam regen +0.15,
//                    OOC health regen +0.15
//   Dexterity     -> evade +0.5, stamina +2,
//                    ranged/dagger combat rating +3,
//                    nat. stam regen +0.05, OOC stam regen +0.15
//   Wisdom        -> priest spell damage +0.3/hit, mana +3,
//                    nat. mana regen +0.07, OOC mana regen +0.38,
//                    protection (holy/unholy) +0.5
//   Combat Rating -> +3 combat rating for all weapon types & healing

export type AttributeKey =
  | "Combat Rating" | "Constitution" | "Dexterity"
  | "Intelligence" | "Strength" | "Wisdom";

export const ATTRIBUTE_KEYS: AttributeKey[] = [
  "Combat Rating", "Constitution", "Dexterity", "Intelligence", "Strength", "Wisdom",
];

export interface AttributeEffect {
  stat: string;
  /** value per attribute point */
  perPoint: number;
  /** human description of the scaling */
  note?: string;
}

interface AttributeDef {
  key: AttributeKey;
  name: string;
  blurb: string;
  effects: AttributeEffect[];
}

export const ATTRIBUTES: AttributeDef[] = [
  {
    key: "Strength",
    name: "Strength",
    blurb: "Raw physical power. Feeds melee combat rating, armor and stamina.",
    effects: [
      { stat: "Melee combat rating", perPoint: 3, note: "except daggers" },
      { stat: "Armor", perPoint: 2 },
      { stat: "Stamina", perPoint: 2 },
      { stat: "Natural stamina regen", perPoint: 0.05 },
      { stat: "OOC stamina regen", perPoint: 0.15 },
      { stat: "OOC health regen", perPoint: 0.15 },
    ],
  },
  {
    key: "Intelligence",
    name: "Intelligence",
    blurb: "The caster's mind. Boosts mage spell damage, mana and magical protection.",
    effects: [
      { stat: "Spell damage (mage)", perPoint: 0.3, note: "per hit, Int-based spells" },
      { stat: "Mana", perPoint: 3 },
      { stat: "Natural mana regen", perPoint: 0.07 },
      { stat: "OOC mana regen", perPoint: 0.38 },
      { stat: "Protection (fire/cold/electrical)", perPoint: 0.5 },
    ],
  },
  {
    key: "Constitution",
    name: "Constitution",
    blurb: "Bodily fortitude. The main source of health, with a stamina kicker.",
    effects: [
      { stat: "Health", perPoint: 6.5, note: "roughly 5-8 depending on class" },
      { stat: "Stamina", perPoint: 2 },
      { stat: "Natural stamina regen", perPoint: 0.05 },
      { stat: "OOC stamina regen", perPoint: 0.15 },
      { stat: "OOC health regen", perPoint: 0.15 },
    ],
  },
  {
    key: "Dexterity",
    name: "Dexterity",
    blurb: "Agility and aim. Powers ranged combat rating and evasion.",
    effects: [
      { stat: "Ranged/dagger combat rating", perPoint: 3 },
      { stat: "Evade rating", perPoint: 0.5 },
      { stat: "Stamina", perPoint: 2 },
      { stat: "Natural stamina regen", perPoint: 0.05 },
      { stat: "OOC stamina regen", perPoint: 0.15 },
    ],
  },
  {
    key: "Wisdom",
    name: "Wisdom",
    blurb: "Spiritual insight. Drives priest healing and holy/unholy protection.",
    effects: [
      { stat: "Spell damage (priest)", perPoint: 0.3, note: "per hit, Wis-based spells" },
      { stat: "Mana", perPoint: 3 },
      { stat: "Natural mana regen", perPoint: 0.07 },
      { stat: "OOC mana regen", perPoint: 0.38 },
      { stat: "Protection (holy/unholy)", perPoint: 0.5 },
    ],
  },
  {
    key: "Combat Rating",
    name: "Combat Rating",
    blurb: "The universal combat attribute. Raises combat rating across the board.",
    effects: [
      { stat: "Combat rating (all weapons & healing)", perPoint: 3 },
    ],
  },
];

export interface AttributeResult {
  attr: AttributeKey;
  amount: number;
  rows: Array<{ stat: string; value: number; note?: string }>;
}

/** Compute the derived stats for `amount` points of the given attribute. */
export function calculateAttribute(attr: AttributeKey, amount: number): AttributeResult {
  const def = ATTRIBUTES.find((a) => a.key === attr) ?? ATTRIBUTES[0];
  const rows = def.effects.map((e) => ({
    stat: e.stat,
    value: round(e.perPoint * amount, 2),
    note: e.note,
  }));
  return { attr: def.key, amount, rows };
}

function round(n: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

/** Format a value, dropping trailing zeros for whole numbers. */
export function fmtValue(n: number): string {
  return Number.isInteger(n) ? String(n) : String(n);
}
