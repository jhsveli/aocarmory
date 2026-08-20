// Data model matching research/armory_data.json (parsed from the archived site).

export type Rarity = "Mundane" | "Superior" | "Enchanted" | "Rare" | "Epic" | "Legendary";

export type Slot =
  | "head" | "shoulder" | "chest" | "hands" | "belt" | "legs" | "feet" | "wrist"
  | "back" | "necklace" | "ring"
  | "1hb" | "1he" | "1heranger" | "2hb" | "2he" | "bow" | "crossbow"
  | "dagger" | "talisman" | "polearm" | "staff" | "ammunition" | "shield";

export type LocationType = "merchant" | "dungeon" | "raid";

export interface Price {
  mark: number;   // Mark of Acclaim
  trophy: number; // Rare Trophy
  gold: number;
  silver: number;
}

/** How an item binds, normalized from the tooltip's "Binds …" line. */
export type BindType = "BIND_ON_PICKUP" | "BIND_ON_EQUIP" | "NO_BIND";

/** Structured stats extracted (via OCR) from the item's tooltip screenshot. */
export interface ItemStats {
  level?: number;
  type?: string;             // e.g. "Legs", "Two-handed Sword"
  armor?: number;
  damage?: { min: number; max: number };
  dps?: number;
  attributes: string[];      // e.g. ["+42 Strength"]
  effects: string[];         // "Equip: ..." lines
  requires?: string;
  binds: BindType;           // normalized bind state (NO_BIND = unbound)
  set?: string;
  setBonuses: string[];      // "(2) Set Bonus: ..."
  description?: string;
  lines: string[];           // remaining lines, in order
}

export interface Item {
  id: number;
  name: string;
  rarity: Rarity | null;
  slot: Slot | null;
  price: Price | null;
  drop: string | null; // dungeon drop location (for dungeon items)
  tooltip: string | null; // raw OCR text of the tooltip screenshot
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
