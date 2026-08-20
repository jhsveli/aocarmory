import { describe, expect, it } from "vitest";
import { searchArmory } from "./search";
import { calculateAttribute, ATTRIBUTES } from "./attributes";

describe("search", () => {
  it("finds items by item name", () => {
    const r = searchArmory("Blade's Leggings of Charred Earth");
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].item.item.name).toContain("Charred Earth");
  });

  it("finds items by class tag (hox)", () => {
    const r = searchArmory("hox epic");
    expect(r.length).toBeGreaterThan(0);
  });

  it("finds items by slot word (hands)", () => {
    const r = searchArmory("hands rare");
    expect(r.length).toBeGreaterThan(0);
  });

  it("finds items by rarity (legendary)", () => {
    const r = searchArmory("legendary");
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((m) => m.item.item.rarity === "Legendary")).toBe(true);
  });

  it("matches the original's example query 'tos scarlet circle epic'", () => {
    const r = searchArmory("tos scarlet circle epic");
    expect(r.length).toBeGreaterThan(0);
  });

  it("returns nothing for gibberish", () => {
    expect(searchArmory("zzzzqqqqxxxyyy")).toEqual([]);
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
