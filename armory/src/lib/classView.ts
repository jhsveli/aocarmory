// Class-usability view of a section.
//
// Regroups a section's sets by their original class tags (which live on the
// set, e.g. ["HoX"], ["Demo/Necro"], ["All"]). Combined tags are kept combined
// exactly as on the site. Sets without a tag land in a "No class tag" group so
// no content disappears from the class view.

import type { Section, Set } from "../types";
import { expandClassTags } from "./class-names";

export interface ClassViewSetEntry {
  set: Set;
  /** drop-location context label (the location the set was listed under) */
  location: string | null;
  /** category context label */
  category: string | null;
}

export interface ClassGroup {
  /** original tag, e.g. "HoX", "Demo/Necro", "All" */
  tag: string;
  /** expanded full class names, for the subtitle (e.g. Demonologist, Necromancer) */
  fullNames: string[];
  sets: ClassViewSetEntry[];
}

export const NO_CLASS_TAG = "No class tag";

/** Group every set of a section by its class tag, sorted for display. */
export function groupSectionByClass(section: Section): ClassGroup[] {
  const byTag = new Map<string, ClassGroup>();

  const groupFor = (tag: string): ClassGroup => {
    let g = byTag.get(tag);
    if (!g) {
      g = { tag, fullNames: expandClassTags([tag]), sets: [] };
      byTag.set(tag, g);
    }
    return g;
  };

  for (const location of section.locations) {
    for (const category of location.categories) {
      for (const set of category.sets) {
        const entry: ClassViewSetEntry = {
          set,
          location: location.name,
          category: category.name,
        };
        if (set.classes.length === 0) {
          groupFor(NO_CLASS_TAG).sets.push(entry);
        } else {
          for (const tag of set.classes) {
            groupFor(tag).sets.push(entry);
          }
        }
      }
    }
  }

  const groups = [...byTag.values()];
  groups.sort((a, b) => {
    // "No class tag" always last; otherwise alphabetical by tag.
    if (a.tag === NO_CLASS_TAG) return 1;
    if (b.tag === NO_CLASS_TAG) return -1;
    return a.tag.localeCompare(b.tag);
  });

  for (const g of groups) {
    g.sets.sort((a, b) => (a.set.name ?? "").localeCompare(b.set.name ?? ""));
  }

  return groups;
}
