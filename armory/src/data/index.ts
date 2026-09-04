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

export interface SectionGroup {
  label: string;
  sections: Section[];
}

/** Grouping for the site-wide section menu (the bottom nav bar). */
const SECTION_GROUP_DEFS: ReadonlyArray<{ label: string; ids: number[] }> = [
  // PvE Tier 1..6
  { label: "PvE Raids", ids: [14, 15, 13, 24, 20, 35, 38] },
  // PvP Tier 1..3
  { label: "PvP", ids: [16, 17, 18] },
  // Khitai factions + Clan Vigdis, in display order
  {
    label: "Factions",
    ids: [1, 2, 3, 11, 4, 5, 6, 7, 8, 9, 10, 36],
  },
  // Onslaught raid vendors
  { label: "Onslaught", ids: [44, 45] },
];

/**
 * Sections grouped for the menu. Ids listed above keep their declared order;
 * any section not listed there falls through to the "Unsorted" group (in the
 * data file's own order) so nothing is ever missing from the menu.
 */
export const sectionGroups: SectionGroup[] = (() => {
  const groups = SECTION_GROUP_DEFS.map((def) => ({
    label: def.label,
    sections: def.ids
      .map((id) => sectionById(id))
      .filter((s): s is Section => s !== undefined),
  }));
  const used = new Set(groups.flatMap((g) => g.sections.map((s) => s.id)));
  const unsorted = sections.filter((s) => !used.has(s.id));
  return [
    ...groups,
    ...(unsorted.length ? [{ label: "Unsorted", sections: unsorted }] : []),
  ];
})();
