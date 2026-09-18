import { describe, expect, it } from "vitest";
import type { Item, Section } from "../types";
import { filterSection, isFilterActive } from "./filters";

function makeItem(id: number, rarity: Item["rarity"], requiresLevel?: number): Item {
  return {
    id,
    name: `Item ${id}`,
    rarity,
    price: null,
    drop: null,
    stats: requiresLevel === undefined ? null : ({ requiresLevel } as Item["stats"]),
  };
}

function makeSection(items: Item[]): Section {
  return {
    id: 1,
    name: "Test Section",
    locations: [
      {
        name: "Test Location",
        coords: null,
        type: null,
        categories: [
          { name: "Test Category", sets: [{ name: "Test Set", classes: [], builder: null, items }] },
        ],
      },
    ],
  };
}

describe("isFilterActive", () => {
  it("is false when no filters are set", () => {
    expect(isFilterActive({})).toBe(false);
  });

  it("is false when minRarity is the lowest tier (Mundane)", () => {
    expect(isFilterActive({ minRarity: "Mundane" })).toBe(false);
  });

  it("is true when a level bound is set", () => {
    expect(isFilterActive({ minLevel: 10 })).toBe(true);
  });
});

describe("filterSection", () => {
  it("returns the section unchanged and hiddenCount 0 when no filters are active", () => {
    const section = makeSection([makeItem(1, "Rare", 50)]);
    const result = filterSection(section, {});
    expect(result.hiddenCount).toBe(0);
    expect(result.section).toBe(section);
  });

  it("hides items below the min rarity threshold", () => {
    const section = makeSection([
      makeItem(1, "Mundane", 10),
      makeItem(2, "Epic", 10),
      makeItem(3, "Legendary", 10),
    ]);
    const result = filterSection(section, { minRarity: "Epic" });
    expect(result.hiddenCount).toBe(1);
    expect(result.section.locations[0].categories[0].sets[0].items.map((i) => i.id)).toEqual([2, 3]);
  });

  it("hides items outside the min/max level range", () => {
    const section = makeSection([
      makeItem(1, "Rare", 10),
      makeItem(2, "Rare", 50),
      makeItem(3, "Rare", 80),
    ]);
    const result = filterSection(section, { minLevel: 20, maxLevel: 60 });
    expect(result.hiddenCount).toBe(2);
    expect(result.section.locations[0].categories[0].sets[0].items.map((i) => i.id)).toEqual([2]);
  });

  it("always shows items with no Requires Level when a level filter is active", () => {
    const section = makeSection([makeItem(1, "Rare", undefined)]);
    const result = filterSection(section, { minLevel: 50 });
    expect(result.hiddenCount).toBe(0);
  });

  it("prunes sets, categories and locations left with no items", () => {
    const section = makeSection([makeItem(1, "Mundane", 10)]);
    const result = filterSection(section, { minRarity: "Epic" });
    expect(result.hiddenCount).toBe(1);
    expect(result.section.locations).toHaveLength(0);
  });
});
