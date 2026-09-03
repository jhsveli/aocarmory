import { describe, expect, it } from "vitest";
import type { Item, Section, Set } from "../types";
import { groupSectionByClass, NO_CLASS_TAG } from "./classView";

function makeSet(name: string, classes: string[], itemId = 1): Set {
  const item: Item = {
    id: itemId,
    name: `${name} Item`,
    rarity: "Rare",
    price: null,
    drop: null,
    stats: null,
  };
  return { name, classes, builder: null, items: [item] };
}

function makeSection(setsByCategory: Array<{ category: string; sets: Set[] }>): Section {
  return {
    id: 1,
    name: "Test Section",
    locations: [
      {
        name: "Test Location",
        coords: null,
        type: null,
        categories: setsByCategory.map((c) => ({ name: c.category, sets: c.sets })),
      },
    ],
  };
}

describe("groupSectionByClass", () => {
  it("puts untagged sets into the No class tag group", () => {
    const section = makeSection([
      { category: "Raid Weapons", sets: [makeSet("Blade of Doom", [])] },
    ]);
    const groups = groupSectionByClass(section);
    expect(groups).toHaveLength(1);
    expect(groups[0].tag).toBe(NO_CLASS_TAG);
    expect(groups[0].sets[0].set.name).toBe("Blade of Doom");
  });

  it("keeps an [All] set in the All group only", () => {
    const section = makeSection([
      { category: "Social Armor", sets: [makeSet("Royal Dragon Elite", ["All"])] },
    ]);
    const groups = groupSectionByClass(section);
    expect(groups).toHaveLength(1);
    expect(groups[0].tag).toBe("All");
    expect(groups[0].sets).toHaveLength(1);
  });

  it("keeps combined tags combined with both full names", () => {
    const section = makeSection([
      { category: "Dungeon Cloth Armor", sets: [makeSet("The Black Arts", ["Demo/Necro"])] },
    ]);
    const groups = groupSectionByClass(section);
    expect(groups).toHaveLength(1);
    expect(groups[0].tag).toBe("Demo/Necro");
    expect(groups[0].fullNames).toEqual(["Demonologist", "Necromancer"]);
  });

  it("carries category and location context on each entry", () => {
    const section = makeSection([
      { category: "Raid Cloth Armor", sets: [makeSet("Ardent Fire", ["HoX"])] },
    ]);
    const groups = groupSectionByClass(section);
    expect(groups[0].sets[0]).toMatchObject({
      location: "Test Location",
      category: "Raid Cloth Armor",
    });
  });

  it("sorts groups alphabetically with No class tag last", () => {
    const section = makeSection([
      { category: "C", sets: [makeSet("Untagged", [])] },
      { category: "B", sets: [makeSet("Zebra", ["HoX"])] },
      { category: "A", sets: [makeSet("Alpha", ["Sin"])] },
    ]);
    const groups = groupSectionByClass(section);
    expect(groups.map((g) => g.tag)).toEqual(["HoX", "Sin", NO_CLASS_TAG]);
  });

  it("sorts sets within a group by name", () => {
    const section = makeSection([
      { category: "Raid", sets: [makeSet("Zulu", ["HoX"]), makeSet("Alpha", ["HoX"])] },
    ]);
    const groups = groupSectionByClass(section);
    expect(groups[0].sets.map((e) => e.set.name)).toEqual(["Alpha", "Zulu"]);
  });

  it("handles a set tagged with multiple tags appearing in each group", () => {
    const section = makeSection([
      { category: "Raid", sets: [makeSet("Shared", ["HoX", "Sin"])] },
    ]);
    const groups = groupSectionByClass(section);
    expect(groups.map((g) => g.tag)).toEqual(["HoX", "Sin"]);
    expect(groups[0].sets[0].set.name).toBe("Shared");
    expect(groups[1].sets[0].set.name).toBe("Shared");
  });
});
