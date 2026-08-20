import raw from "./armory_data.json";
import type {
  ArmoryData, CharacterClass, Item, Section,
} from "../types";

const data = raw as unknown as ArmoryData;

/** Section id -> section (from the site's own section menu order). */
export const sections: Section[] = data.sections;

/** Classes with their armor sets (from the Armor Sets page). */
export const classes: CharacterClass[] = data.classes;

export const meta = data.meta;

/** item id -> Item (first occurrence wins; ids are the DB primary keys). */
export const itemById = new Map<number, Item>();

/** Every item with its owning section/location/category/set for search. */
export interface FlatItem {
  item: Item;
  section: string;
  sectionId: number;
  location: string;
  category: string;
  set: string;
  setClasses: string[];
  builder: string | null;
}

export const flatItems: FlatItem[] = [];

for (const section of sections) {
  for (const location of section.locations) {
    for (const category of location.categories) {
      for (const set of category.sets) {
        for (const item of set.items) {
          if (!itemById.has(item.id)) itemById.set(item.id, item);
          flatItems.push({
            item,
            section: section.name,
            sectionId: section.id,
            location: location.name ?? "",
            category: category.name ?? "",
            set: set.name ?? "",
            setClasses: set.classes,
            builder: set.builder,
          });
        }
      }
    }
  }
}

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

export function sectionById(id: number): Section | undefined {
  return sections.find((s) => s.id === id);
}
