import { useSyncExternalStore } from "react";
import type {
  ArmoryData, ArmoryMeta, CharacterClass, Item, Section,
} from "../types";

/**
 * The armory dataset is large (~6 MB), so it is NOT statically imported into
 * the app bundle. It is loaded once at runtime via a dynamic import (Vite
 * emits it as its own async chunk), then cached here. Components read it
 * through useArmoryData(), which re-renders once the data has arrived.
 */

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

export interface SectionGroup {
  label: string;
  sections: Section[];
}

export interface ArmoryBundle {
  sections: Section[];
  classes: CharacterClass[];
  meta: ArmoryMeta;
  sectionGroups: SectionGroup[];
  flatItems: FlatItem[];
  itemById: Map<number, Item>;
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

const EMPTY_META: ArmoryMeta = {
  sections: 0, sets: 0, uniqueSets: 0, items: 0, uniqueItems: 0, generated: "",
};

const EMPTY_BUNDLE: ArmoryBundle = {
  sections: [],
  classes: [],
  meta: EMPTY_META,
  sectionGroups: [],
  flatItems: [],
  itemById: new Map(),
};

function sectionById(sections: Section[], id: number): Section | undefined {
  return sections.find((s) => s.id === id);
}

/** Derive the flattened search index + menu groups from the raw dataset. */
function buildBundle(raw: ArmoryData): ArmoryBundle {
  const sections = raw.sections;
  const itemById = new Map<number, Item>();
  const flatItems: FlatItem[] = [];

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

  // Sections grouped for the menu. Ids listed above keep their declared
  // order; anything not listed falls through to the "Unsorted" group (in the
  // data file's own order) so nothing is ever missing from the menu.
  const groups = SECTION_GROUP_DEFS.map((def) => ({
    label: def.label,
    sections: def.ids
      .map((id) => sectionById(sections, id))
      .filter((s): s is Section => s !== undefined),
  }));
  const used = new Set(groups.flatMap((g) => g.sections.map((s) => s.id)));
  const unsorted = sections.filter((s) => !used.has(s.id));
  const sectionGroups: SectionGroup[] = [
    ...groups,
    ...(unsorted.length ? [{ label: "Unsorted", sections: unsorted }] : []),
  ];

  return {
    sections,
    classes: raw.classes,
    meta: raw.meta,
    sectionGroups,
    flatItems,
    itemById,
  };
}

let bundle: ArmoryBundle | null = null;
let loading: Promise<ArmoryBundle> | null = null;
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

function snapshot(): ArmoryBundle {
  return bundle ?? EMPTY_BUNDLE;
}

/**
 * Load (once) and cache the armory dataset. The dataset is a dynamic import so
 * it becomes its own network chunk rather than part of the initial bundle.
 */
export async function loadArmoryData(): Promise<ArmoryBundle> {
  if (!bundle) {
    if (!loading) {
      loading = (async () => {
        const mod = await import("./armory_data.json");
        const built = buildBundle(mod.default as unknown as ArmoryData);
        bundle = built;
        notify();
        return built;
      })();
    }
    await loading;
  }
  return bundle!;
}

/** Subscribe to dataset load completion (for useSyncExternalStore). */
export function subscribeArmoryData(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

/** Reactive handle to the dataset: empty until loadArmoryData() resolves. */
export function useArmoryData(): ArmoryBundle {
  return useSyncExternalStore(subscribeArmoryData, snapshot);
}
