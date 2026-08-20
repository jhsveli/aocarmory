import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import ItemTooltipBox from "./ItemTooltipBox";
import type { Item } from "../types";

function makeItem(over: Partial<Item> = {}): Item {
  return {
    id: 1,
    name: "Blade's Leggings of Charred Earth",
    rarity: "Epic",
    slot: "legs",
    price: null,
    drop: null,
    tooltip: null,
    stats: null,
    ...over,
  };
}

describe("ItemTooltipBox", () => {
  it("renders the item name with its rarity class", () => {
    render(<ItemTooltipBox item={makeItem({ rarity: "Rare" })} />);
    const name = screen.getByText("Blade's Leggings of Charred Earth");
    expect(name.className).toContain("tooltipName");
    expect(name.className).toContain("r-rare");
  });

  it("renders structured stat lines", () => {
    const item = makeItem({
      stats: {
        level: 80,
        type: "Legs",
        armor: 512,
        binds: "BIND_ON_PICKUP",
        attributes: ["+42 Strength", "+25 Constitution"],
        effects: [],
        setBonuses: [],
        lines: ["Vendor Price 2 Gold"],
      },
    });
    render(<ItemTooltipBox item={item} />);
    expect(screen.getByText("Item Level 80")).toBeInTheDocument();
    expect(screen.getByText("Legs")).toBeInTheDocument();
    expect(screen.getByText("Armor: 512")).toBeInTheDocument();
    expect(screen.getByText("+42 Strength")).toBeInTheDocument();
    expect(screen.getByText("Vendor Price 2 Gold")).toBeInTheDocument();
  });

  it("derives the binds line from the enum", () => {
    const item = makeItem({
      stats: {
        binds: "BIND_ON_EQUIP",
        attributes: [],
        effects: [],
        setBonuses: [],
        lines: [],
      },
    });
    render(<ItemTooltipBox item={item} />);
    expect(screen.getByText("Binds when Equipped")).toBeInTheDocument();
    expect(screen.queryByText("BIND_ON_EQUIP")).not.toBeInTheDocument();
  });

  it("does not render a line for NO_BIND items", () => {
    const item = makeItem({
      stats: {
        binds: "NO_BIND",
        attributes: [],
        effects: [],
        setBonuses: [],
        lines: [],
      },
    });
    render(<ItemTooltipBox item={item} />);
    expect(screen.queryByText("No Bind")).not.toBeInTheDocument();
  });

  it("combines weapon dps and damage on one line", () => {
    const item = makeItem({
      stats: {
        level: 80,
        binds: "NO_BIND",
        damage: { min: 132, max: 173 },
        dps: 110.8,
        attributes: [],
        effects: [],
        setBonuses: [],
        lines: [],
      },
    });
    render(<ItemTooltipBox item={item} />);
    expect(screen.getByText("110.8 DPS (132 - 173)")).toBeInTheDocument();
  });

  it("falls back to raw tooltip text when stats are missing", () => {
    const item = makeItem({
      stats: null,
      tooltip: "Binds when Picked Up\n+42 Strength",
    });
    render(<ItemTooltipBox item={item} />);
    expect(screen.getByText("Binds when Picked Up")).toBeInTheDocument();
    expect(screen.getByText("+42 Strength")).toBeInTheDocument();
  });

  it("shows the missing-data fallback when there is no tooltip", () => {
    render(<ItemTooltipBox item={makeItem()} />);
    expect(screen.getByText(/No tooltip data available/)).toBeInTheDocument();
  });

  it("renders the compact variant class", () => {
    const item = makeItem({
      stats: {
        binds: "NO_BIND",
        attributes: [],
        effects: [],
        setBonuses: [],
        lines: [],
      },
    });
    const { container } = render(<ItemTooltipBox item={item} compact />);
    expect(container.querySelector(".tooltipBox.compact")).not.toBeNull();
  });
});
