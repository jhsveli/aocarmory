import { describe, expect, it, beforeAll } from "vitest";
import { searchArmory } from "./search";
import { calculateAttribute, ATTRIBUTES } from "./attributes";
import { loadArmoryData } from "../data";
import type { FlatItem } from "../data";

describe("search", () => {
  let items: FlatItem[] = [];
  beforeAll(async () => {
    items = (await loadArmoryData()).flatItems;
  });

  it("finds items by item name", () => {
    const r = searchArmory("Blade's Leggings of Charred Earth", items);
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].item.item.name).toContain("Charred Earth");
  });

  it("finds items by class tag (hox)", () => {
    const r = searchArmory("hox epic", items);
    expect(r.length).toBeGreaterThan(0);
  });

  it("finds items by slot word (hands)", () => {
    const r = searchArmory("hands rare", items);
    expect(r.length).toBeGreaterThan(0);
  });

  it("finds items by rarity (legendary)", () => {
    const r = searchArmory("legendary", items);
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((m) => m.item.item.rarity === "Legendary")).toBe(true);
  });

  it("matches the original's example query 'tos scarlet circle epic'", () => {
    const r = searchArmory("tos scarlet circle epic", items);
    expect(r.length).toBeGreaterThan(0);
  });

  it("returns nothing for gibberish", () => {
    expect(searchArmory("zzzzqqqqxxxyyy", items)).toEqual([]);
  });
});

describe("attribute calculator", () => {
  it("computes Constitution health with the documented 6.5/pt", () => {
    const res = calculateAttribute("Constitution", 100);
    const health = res.rows.find((r) => r.stat === "Health");
    expect(health?.value).toBe(650);
  });

  it("computes Strength melee rating 3/pt", () => {
    const res = calculateAttribute("Strength", 50);
    const cr = res.rows.find((r) => r.stat.startsWith("Melee"));
    expect(cr?.value).toBe(150);
  });

  it("has an entry for every attribute key", () => {
    expect(ATTRIBUTES).toHaveLength(6);
    expect(ATTRIBUTES.map((a) => a.key)).toEqual([
      "Strength", "Intelligence", "Constitution", "Dexterity", "Wisdom", "Combat Rating",
    ]);
  });
});
