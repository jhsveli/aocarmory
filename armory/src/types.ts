// Data model matching research/armory_data.json (parsed from the archived site).

import type { StatProperty } from "./lib/stat-labels";

export type Rarity = "Mundane" | "Superior" | "Enchanted" | "Rare" | "Epic" | "Legendary";

export type Slot =
  | "head" | "shoulder" | "chest" | "hands" | "belt" | "legs" | "feet" | "wrist"
  | "back" | "necklace" | "ring"
  | "1hb" | "1he" | "1heranger" | "2hb" | "2he" | "bow" | "crossbow"
  | "dagger" | "talisman" | "polearm" | "staff" | "ammunition" | "shield"
  | "thrown";

export type LocationType = "merchant" | "dungeon" | "raid";

export interface Price {
  mark: number;   // Mark of Acclaim
  trophy: number; // Rare Trophy
  gold: number;
  silver: number;
}

/** How an item binds, normalized from the tooltip's "Binds …" line. */
export type BindType = "BIND_ON_PICKUP" | "BIND_ON_EQUIP" | "NO_BIND";

/** Denominated vendor price parsed from the tooltip's "Vendor Price …" line. */
export interface VendorPrice {
  gold?: number;
  silver?: number;
  copper?: number;
  tin?: number;
}

/**
 * Rune engraving names found in the dataset (the values listed under the
 * tooltip's "Rune Engravings" block).
 */
export type RuneEngraving =
  | "Ashur" | "Black Pharaoh" | "Crawling Mist" | "Dark Sun" | "Emandua"
  | "Eternal Winter" | "Frozen North" | "Manic Haze" | "Northern Wastes"
  | "Raging Earth" | "Silence Falls" | "Silver Twilight" | "Sleeping Stars"
  | "Steel Behemoth" | "Winter Sun";

/**
 * Gem slot values found in the dataset: socket colors and the named slots
 * (the four Kuthcheman-raid slots plus the "Eldritch / Occult / Chaos"
 * chaos-gem slots). Colors and named slots can be mixed in the same item's
 * array.
 */
export type GemSlot =
  | "Black" | "Blue" | "Green" | "Red" | "White" | "Yellow"
  | "Kuthcheman" | "Onslaught" | "White Hand" | "Hyperborean"
  | "Eldritch" | "Occult" | "Chaos";

/**
 * A percentage stat value, e.g. { percent: 5 } for "+5% Out of Combat
 * Movement Speed". The sign is carried inside the number (negative = penalty).
 */
export interface PercentValue {
  percent: number;
  /** potion targets the effect applies to, e.g. ["Mana Potions", "Stamina Potions"] */
  appliesTo?: string[];
}

/**
 * A stat value keyed by a known property name, e.g. { armor: 512 } or
 * { "out of combat movement speed": { percent: 5 } }.
 * Keys are the StatProperty union derived from the stat-labels language file,
 * so unknown/typo'd names fail type-checking.
 */
export type StatValue = Partial<Record<StatProperty, number | PercentValue>>;

/**
 * A chance-on-hit / chance-on-receiving-damage effect, e.g.
 * "Chance on damage, Defiling Strike on target, 3 Procs per Minute".
 */
export interface Proc {
  /** tooltip trigger phrase: "on damage" / "of getting damage" / "on receiving spell damage" */
  trigger: string;
  /** the spell/effect applied, e.g. "Defiling Strike" */
  spell: string;
  /** where the effect lands: "self" or "target" */
  target: "self" | "target";
  /** the proc rate value */
  rate: number;
  /** the rate unit: "Procs per Minute" or "percent chance" */
  rateUnit: "ppm" | "percent";
}

/**
 * Bonus stats granted by a gem at a given tier, e.g. "Tier 10: +150 Heal
 * Rating". Reuses the scalar/percent attribute and proc shapes.
 */
export interface TierBonus {
  values?: StatValue[];      // e.g. [{ critigation: 30 }]
  attributes?: StatValue[];  // e.g. [{ "heal rating": 150 }, { "fatality rating": 60 }]
  procs?: Proc[];            // e.g. [{ trigger: "on damage", spell: "Holy Storm", ... }]
}

/**
 * Duration of a consumable or spell effect, e.g. { hours: 1 } for
 * "Duration: 1 hour", or { seconds: 10 } for "Recast 10 seconds".
 */
export interface Duration {
  hours?: number;
  minutes?: number;
  seconds?: number;
}

/** Structured stats extracted (via OCR) from the item's tooltip screenshot. */
export interface ItemStats {
  itemLevel?: number;
  type?: string;             // equipment kind, e.g. "Cloth Armor", "Dagger", "Necklace"
  gemKind?: string;          // gem subtype line, e.g. "Hyperborean Gem" -> "Hyperborean"
  duration?: Duration;       // "Duration: 1 hour" / "Duration: 45 minutes" (potions)
  mustBeUsedOutOfCombat?: boolean; // "Must be used out of combat"
  targetingMode?: string;    // linked-spell "Targeting Mode: Friendly Personal Spell"
  castingTime?: Duration;    // linked-spell "Casting Time: 2 seconds" / "Instant"
  recast?: Duration;         // linked-spell "Recast: 10 seconds" / "120 seconds"
  slots?: string[];          // tooltip equip positions, e.g. ["Main Hand", "Off Hand"] (omitted when slotless)
  requiresLevel?: number;    // "Requires Level 80"
  requiresPvpLevel?: number; // "Requires PvP Level 9"
  requiresRenownLevel?: number; // "Requires Renown Level 19"
  requiresItemLevel?: number;   // "Requires a Level 80 Item" (socket requirement)
  requiresFactionRank?: Record<string, number>; // faction key -> rank, e.g. { "last legion": 1 } (display via lib/faction-ranks)
  canOnlyHaveOne?: boolean; // unique-item restriction ("Can Only Have One")
  classes?: string[];        // class restrictions, e.g. ["Barbarian"] (omitted when unclassed)
  values: StatValue[];       // e.g. [{ armor: 512 }, { critigation: 277 }]
  damage?: { min: number; max: number };
  dps?: number;
  attributes: StatValue[];   // e.g. [{ strength: 42 }, { "critical rating": 50 }]
  procs?: Proc[];            // "Chance on damage, X on target, N Procs per Minute"
  learnSpell?: string;       // "Learn Spell: <name>" (pet/mount/consumable items)
  tierBonuses?: Record<number, TierBonus>; // "Tier N: ..." bonuses keyed by tier (gems)
  effects: string[];         // "Equip: ..." lines
  binds: BindType;           // normalized bind state (NO_BIND = unbound)
  vendorPrice?: VendorPrice; // "Vendor Price 2 Gold 50 Silver" from the tooltip
  set?: string;
  setBonuses: string[];      // "(2) Set Bonus: ..."
  description?: string[];    // "Description:" block, one tooltip line per element
  engravings?: RuneEngraving[]; // values under the "Rune Engravings" block
  gemSlots?: GemSlot[];      // values under the "Gem Slots" block (colors or named gems)
  lines: string[];           // remaining lines, in order
}

export interface Item {
  id: number;
  name: string;
  rarity: Rarity | null;
  price: Price | null;
  drop: string | null; // dungeon drop location (for dungeon items)
  image?: string | null; // original tooltip screenshot URL (provenance / comparison)
  stats: ItemStats | null; // best-effort structured parse of the tooltip
}

export interface Set {
  name: string | null;
  classes: string[]; // class tags, e.g. ["HoX"], ["Demo/Necro"]
  builder: string | null; // original ab= param (zlib+base64)
  items: Item[];
}

export interface Category {
  name: string | null;
  sets: Set[];
}

export interface Location {
  name: string | null;
  coords: string | null; // "550,130"
  type: LocationType | null;
  categories: Category[];
}

export interface Section {
  id: number;
  name: string;
  locations: Location[];
}

export interface ClassSetRef {
  section: string | null;
  set: string | null;
  builder: string | null;
}

export interface CharacterClass {
  name: string;
  sets: ClassSetRef[];
}

export interface ArmoryMeta {
  sections: number;
  sets: number;
  uniqueSets: number;
  items: number;
  uniqueItems: number;
  generated: string;
}

export interface ArmoryData {
  sections: Section[];
  classes: CharacterClass[];
  meta: ArmoryMeta;
}
