import { describe, expect, it } from "vitest";
import { DEFAULT_COMPARE_FILTERS, findCompareCandidates } from "./compare-candidates";
import type { CompareFilters } from "./compare-candidates";
import type { FlatItem } from "../data";
import type { Item, ItemStats } from "../types";

function makeStats(over: Partial<ItemStats> = {}): ItemStats {
  return {
    values: [], attributes: [], effects: [], setBonuses: [], lines: [], binds: "NO_BIND",
    ...over,
  };
}

function makeItem(id: number, name: string, rarity: Item["rarity"], stats: ItemStats | null): Item {
  return { id, name, rarity, price: null, drop: null, stats };
}

function flat(item: Item): FlatItem {
  return {
    item, section: "Section", sectionId: 1, location: "", category: "", set: "", setClasses: [], builder: null,
  };
}

const main = makeItem(1, "Main", "Epic", makeStats({
  type: "Cloth Armor", slots: ["Hands"], classes: ["Barbarian"],
}));

const sameEverything = makeItem(2, "Same Everything", "Epic", makeStats({
  type: "Cloth Armor", slots: ["Hands"], classes: ["Barbarian"],
}));
const differentSlot = makeItem(3, "Different Slot", "Epic", makeStats({
  type: "Cloth Armor", slots: ["Head"], classes: ["Barbarian"],
}));
const differentArmorType = makeItem(4, "Different Armor Type", "Epic", makeStats({
  type: "Heavy Armor", slots: ["Hands"], classes: ["Barbarian"],
}));
const differentClass = makeItem(5, "Different Class", "Epic", makeStats({
  type: "Cloth Armor", slots: ["Hands"], classes: ["Necromancer"],
}));
const differentRarity = makeItem(6, "Different Rarity", "Rare", makeStats({
  type: "Cloth Armor", slots: ["Hands"], classes: ["Barbarian"],
}));
const unrestrictedClass = makeItem(7, "Unrestricted Class", "Epic", makeStats({
  type: "Cloth Armor", slots: ["Hands"],
}));

const flatItems: FlatItem[] = [
  main, sameEverything, differentSlot, differentArmorType, differentClass, differentRarity, unrestrictedClass,
].map(flat);

function names(items: Item[]): string[] {
  return items.map((i) => i.name);
}

describe("findCompareCandidates", () => {
  it("defaults to matching slot, armor type, class and exact rarity, excluding main", () => {
    const result = names(findCompareCandidates(flatItems, new Set([main.id]), main, DEFAULT_COMPARE_FILTERS, ""));
    expect(result).toEqual(["Same Everything", "Unrestricted Class"]);
  });

  it("widens to include other slots once the slot filter is off", () => {
    const filters: CompareFilters = { ...DEFAULT_COMPARE_FILTERS, slot: false };
    const result = names(findCompareCandidates(flatItems, new Set([main.id]), main, filters, ""));
    expect(result).toContain("Different Slot");
  });

  it("widens to include other armor types once the armor-type filter is off", () => {
    const filters: CompareFilters = { ...DEFAULT_COMPARE_FILTERS, armorType: false };
    const result = names(findCompareCandidates(flatItems, new Set([main.id]), main, filters, ""));
    expect(result).toContain("Different Armor Type");
  });

  it("widens to include class-incompatible items once the class filter is off", () => {
    const filters: CompareFilters = { ...DEFAULT_COMPARE_FILTERS, class: false };
    const result = names(findCompareCandidates(flatItems, new Set([main.id]), main, filters, ""));
    expect(result).toContain("Different Class");
  });

  it("widens to include other rarities once the rarity filter is off", () => {
    const filters: CompareFilters = { ...DEFAULT_COMPARE_FILTERS, rarity: false };
    const result = names(findCompareCandidates(flatItems, new Set([main.id]), main, filters, ""));
    expect(result).toContain("Different Rarity");
  });

  it("always includes class-unrestricted items regardless of the main item's class", () => {
    const result = names(findCompareCandidates(flatItems, new Set([main.id]), main, DEFAULT_COMPARE_FILTERS, ""));
    expect(result).toContain("Unrestricted Class");
  });

  it("ignores every filter and returns all items when there is no main item", () => {
    const result = findCompareCandidates(flatItems, new Set(), undefined, DEFAULT_COMPARE_FILTERS, "");
    expect(result).toHaveLength(flatItems.length);
  });

  it("excludes ids already in the comparison", () => {
    const result = findCompareCandidates(
      flatItems,
      new Set([main.id, sameEverything.id]),
      main,
      DEFAULT_COMPARE_FILTERS,
      "",
    );
    expect(names(result)).not.toContain("Same Everything");
  });

  it("applies the text query on top of the active filters", () => {
    const filters: CompareFilters = { ...DEFAULT_COMPARE_FILTERS, class: false, armorType: false, rarity: false, slot: false };
    const result = names(findCompareCandidates(flatItems, new Set([main.id]), main, filters, "different rarity"));
    expect(result).toEqual(["Different Rarity"]);
  });
});
