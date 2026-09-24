import { describe, expect, it } from "vitest";
import { computeStatDiff } from "./stat-diff";
import type { Item, ItemStats } from "../types";

function makeStats(over: Partial<ItemStats> = {}): ItemStats {
  return {
    values: [],
    attributes: [],
    effects: [],
    setBonuses: [],
    lines: [],
    binds: "NO_BIND",
    ...over,
  };
}

function makeItem(id: number, stats: ItemStats | null): Item {
  return { id, name: `Item ${id}`, rarity: null, price: null, drop: null, stats };
}

describe("computeStatDiff", () => {
  it("computes signed deltas for shared stat-value and attribute keys", () => {
    const main = makeItem(1, makeStats({ values: [{ armor: 500 }], attributes: [{ strength: 10 }] }));
    const other = makeItem(2, makeStats({ values: [{ armor: 480 }], attributes: [{ strength: 15 }] }));

    expect(computeStatDiff(main, other)).toEqual([
      { key: "armor", label: "Armor", delta: -20, isPercent: false, good: false },
      { key: "strength", label: "Strength", delta: 5, isPercent: false, good: true },
    ]);
  });

  it("treats a stat missing on one side as 0 (union semantics)", () => {
    const main = makeItem(1, makeStats({ values: [{ critigation: 200 }] }));
    const other = makeItem(2, makeStats());

    expect(computeStatDiff(main, other)).toEqual([
      { key: "critigation", label: "Critigation Amount", delta: -200, isPercent: false, good: false },
    ]);
  });

  it("picks up a stat unique to the compared item too, not just the main item's keys", () => {
    const main = makeItem(1, makeStats());
    const other = makeItem(2, makeStats({ attributes: [{ constitution: 30 }] }));

    expect(computeStatDiff(main, other)).toEqual([
      { key: "constitution", label: "Constitution", delta: 30, isPercent: false, good: true },
    ]);
  });

  it("omits stats with an identical value on both items", () => {
    const main = makeItem(1, makeStats({ values: [{ armor: 500 }] }));
    const other = makeItem(2, makeStats({ values: [{ armor: 500 }] }));

    expect(computeStatDiff(main, other)).toEqual([]);
  });

  it("handles null stats on either side as an empty item", () => {
    const main = makeItem(1, makeStats({ values: [{ armor: 500 }] }));
    const other = makeItem(2, null);

    expect(computeStatDiff(main, other)).toEqual([
      { key: "armor", label: "Armor", delta: -500, isPercent: false, good: false },
    ]);
  });

  it("diffs percent-valued attributes and flags them as percent", () => {
    const main = makeItem(1, makeStats({ attributes: [{ "out of combat movement speed": { percent: 5 } }] }));
    const other = makeItem(2, makeStats({ attributes: [{ "out of combat movement speed": { percent: 8 } }] }));

    expect(computeStatDiff(main, other)).toEqual([
      { key: "out of combat movement speed", label: "Out of Combat Movement Speed", delta: 3, isPercent: true, good: true },
    ]);
  });

  it("inverts polarity for staggering chance, where a more-negative delta is the improvement", () => {
    const main = makeItem(1, makeStats({ values: [{ "staggering chance": -5 }] }));
    const other = makeItem(2, makeStats({ values: [{ "staggering chance": -10 }] }));

    expect(computeStatDiff(main, other)).toEqual([
      { key: "staggering chance", label: "Staggering Chance", delta: -5, isPercent: false, good: true },
    ]);
  });

  it("does not invert polarity for the sometimes-negative pvp-* stats", () => {
    const main = makeItem(1, makeStats({ attributes: [{ "pvp combat rating": -50 }] }));
    const other = makeItem(2, makeStats({ attributes: [{ "pvp combat rating": -20 }] }));

    expect(computeStatDiff(main, other)).toEqual([
      { key: "pvp combat rating", label: "PvP Combat Rating", delta: 30, isPercent: false, good: true },
    ]);
  });

  it("adds a separate dps row when weapon dps differs", () => {
    const main = makeItem(1, makeStats({ dps: 100 }));
    const other = makeItem(2, makeStats({ dps: 106 }));

    expect(computeStatDiff(main, other)).toEqual([
      { key: "dps", label: "DPS", delta: 6, isPercent: false, good: true },
    ]);
  });
});
