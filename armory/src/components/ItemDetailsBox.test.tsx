import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import ItemDetailsBox from "./ItemDetailsBox.tsx";
import type { Item } from "../types";

function makeItem(over: Partial<Item> = {}): Item {
  return {
    id: 1,
    name: "Blade's Leggings of Charred Earth",
    rarity: "Epic",
    price: null,
    drop: null,
    stats: null,
    ...over,
  };
}

describe("ItemTooltipBox", () => {
  it("renders the item name", () => {
    render(<ItemDetailsBox item={makeItem({ rarity: "Rare" })} />);
    expect(screen.getByText("Blade's Leggings of Charred Earth")).toBeInTheDocument();
  });

  it("renders structured stat lines", () => {
    const item = makeItem({
      stats: {
        itemLevel: 80,
        type: "Legs",
        requiresLevel: 80,
        requiresPvpLevel: 9,
        classes: ["Priest of Mitra", "Tempest of Set"],
        binds: "BIND_ON_PICKUP",
        values: [{ armor: 512 }, { critigation: 277 }],
        attributes: [{ strength: 42 }, { constitution: 25 }],
        effects: [],
        setBonuses: [],
        lines: ["Vendor Price 2 Gold"],
      },
    });
    render(<ItemDetailsBox item={item} />);
    expect(screen.getByText("Item Level 80")).toBeInTheDocument();
    expect(screen.getByText("Legs")).toBeInTheDocument();
    expect(screen.getByText("Classes: Priest of Mitra, Tempest of Set")).toBeInTheDocument();
    expect(screen.getByText("Requires Level 80")).toBeInTheDocument();
    expect(screen.getByText("Requires PvP Level 9")).toBeInTheDocument();
    expect(screen.getByText("Armor: 512")).toBeInTheDocument();
    expect(screen.getByText("Critigation Amount: 277")).toBeInTheDocument();
    expect(screen.getByText("+42 Strength")).toBeInTheDocument();
    expect(screen.getByText("+25 Constitution")).toBeInTheDocument();
    expect(screen.getByText("Vendor Price 2 Gold")).toBeInTheDocument();
  });

  it("renders type and slots from the split tooltip line", () => {
    const item = makeItem({
      stats: {
        binds: "NO_BIND",
        type: "Dagger",
        slots: ["Main Hand", "Off Hand"],
        values: [],
        attributes: [],
        effects: [],
        setBonuses: [],
        lines: [],
      },
    });
    render(<ItemDetailsBox item={item} />);
    expect(screen.getByText("Dagger - Main Hand, Off Hand")).toBeInTheDocument();
  });

  it("renders faction rank requirements through the language file", () => {
    const item = makeItem({
      stats: {
        binds: "NO_BIND",
        requiresFactionRank: { "last legion": 1 },
        values: [],
        attributes: [],
        effects: [],
        setBonuses: [],
        lines: [],
      },
    });
    render(<ItemDetailsBox item={item} />);
    expect(screen.getByText("Soldier (Rank 1) in Last Legion")).toBeInTheDocument();
  });

  it("uses the original 'with the faction' phrasing for arena factions", () => {
    const item = makeItem({
      stats: {
        binds: "NO_BIND",
        requiresFactionRank: { "pit master's arena (gladiators)": 4 },
        values: [],
        attributes: [],
        effects: [],
        setBonuses: [],
        lines: [],
      },
    });
    render(<ItemDetailsBox item={item} />);
    expect(screen.getByText(
      "Arena Champion (Rank 4) with the faction Pit Master's Arena (Gladiators)",
    )).toBeInTheDocument();
  });

  it("falls back to a plain rank line for unknown faction keys", () => {
    const item = makeItem({
      stats: {
        binds: "NO_BIND",
        requiresFactionRank: { "mystery faction": 2 },
        values: [],
        attributes: [],
        effects: [],
        setBonuses: [],
        lines: [],
      },
    });
    render(<ItemDetailsBox item={item} />);
    expect(screen.getByText("Requires Rank 2 in Mystery Faction")).toBeInTheDocument();
  });

  it("renders the vendor price from the structured field", () => {
    const item = makeItem({
      stats: {
        binds: "NO_BIND",
        vendorPrice: { gold: 2, silver: 50 },
        values: [],
        attributes: [],
        effects: [],
        setBonuses: [],
        lines: [],
      },
    });
    render(<ItemDetailsBox item={item} />);
    expect(screen.getByText("Vendor Price 2 Gold 50 Silver")).toBeInTheDocument();
  });

  it("renders the description as one line per array element", () => {
    const item = makeItem({
      stats: {
        binds: "NO_BIND",
        description: ["A social cloak thought to", "be worn by followers of", "the spider-god Zath."],
        values: [],
        attributes: [],
        effects: [],
        setBonuses: [],
        lines: [],
      },
    });
    render(<ItemDetailsBox item={item} />);
    expect(screen.getByText("A social cloak thought to")).toBeInTheDocument();
    expect(screen.getByText("the spider-god Zath.")).toBeInTheDocument();
  });

  it("renders engravings and gem slots from the structured fields", () => {
    const item = makeItem({
      stats: {
        binds: "NO_BIND",
        engravings: ["Eternal Winter", "Winter Sun"],
        gemSlots: ["Blue", "Red", "Yellow"],
        values: [],
        attributes: [],
        effects: [],
        setBonuses: [],
        lines: [],
      },
    });
    render(<ItemDetailsBox item={item} />);
    expect(screen.getByText("Rune Engravings: Eternal Winter, Winter Sun")).toBeInTheDocument();
    expect(screen.getByText("Gem Slots: Blue, Red, Yellow")).toBeInTheDocument();
  });

  it("renders the unique-item restriction from the boolean field", () => {
    const item = makeItem({
      stats: {
        binds: "NO_BIND",
        canOnlyHaveOne: true,
        values: [],
        attributes: [],
        effects: [],
        setBonuses: [],
        lines: [],
      },
    });
    render(<ItemDetailsBox item={item} />);
    expect(screen.getByText("Can Only Have One")).toBeInTheDocument();
  });

  it("resolves attribute labels through the language file", () => {
    const item = makeItem({
      stats: {
        binds: "NO_BIND",
        values: [],
        attributes: [{ "critical rating": 50 }, { "pvp protection": 16 }],
        effects: [],
        setBonuses: [],
        lines: [],
      },
    });
    render(<ItemDetailsBox item={item} />);
    expect(screen.getByText("+50 Critical Rating")).toBeInTheDocument();
    expect(screen.getByText("+16 PvP Protection")).toBeInTheDocument();
  });

  it("renders percentage attributes with a % sign", () => {
    const item = makeItem({
      stats: {
        binds: "NO_BIND",
        values: [],
        attributes: [
          { "out of combat movement speed": { percent: 5 } },
          { "hate modifier": { percent: -1 } },
        ],
        effects: [],
        setBonuses: [],
        lines: [],
      },
    });
    render(<ItemDetailsBox item={item} />);
    expect(screen.getByText("+5% Out of Combat Movement Speed")).toBeInTheDocument();
    expect(screen.getByText("-1% Hate Modifier")).toBeInTheDocument();
  });

  it("renders proc effects reconstructed from the structured fields", () => {
    const item = makeItem({
      stats: {
        binds: "NO_BIND",
        values: [],
        attributes: [],
        procs: [
          { trigger: "on damage", spell: "Defiling Strike", target: "target", rate: 3, rateUnit: "ppm" },
          { trigger: "of getting damage", spell: "Scalding Revenge", target: "self", rate: 1, rateUnit: "percent" },
        ],
        effects: [],
        setBonuses: [],
        lines: [],
      },
    });
    render(<ItemDetailsBox item={item} />);
    expect(screen.getByText("Chance on damage, Defiling Strike on target, 3 Procs per Minute")).toBeInTheDocument();
    expect(screen.getByText("Chance of getting damage, Scalding Revenge on self, 1 percent chance")).toBeInTheDocument();
  });

  it("renders the learn-spell line from the structured field", () => {
    const item = makeItem({
      stats: {
        binds: "NO_BIND",
        values: [],
        attributes: [],
        learnSpell: "Pet: Golden Lotus",
        effects: [],
        setBonuses: [],
        lines: [],
      },
    });
    render(<ItemDetailsBox item={item} />);
    expect(screen.getByText("Learn Spell: Pet: Golden Lotus")).toBeInTheDocument();
  });

  it("renders duration and gem kind from the structured fields", () => {
    const item = makeItem({
      stats: {
        binds: "NO_BIND",
        type: "Potion",
        gemKind: "Hyperborean",
        duration: { hours: 1, minutes: 45 },
        values: [],
        attributes: [],
        effects: [],
        setBonuses: [],
        lines: [],
      },
    });
    render(<ItemDetailsBox item={item} />);
    expect(screen.getByText("Hyperborean Gem")).toBeInTheDocument();
    expect(screen.getByText("Duration: 1 hour 45 minutes")).toBeInTheDocument();
  });

  it("renders linked-spell metadata, out-of-combat flag, and potion targets", () => {
    const item = makeItem({
      stats: {
        binds: "NO_BIND",
        type: "Companion",
        mustBeUsedOutOfCombat: true,
        targetingMode: "Friendly Personal Spell",
        castingTime: { seconds: 2 },
        recast: { seconds: 10 },
        duration: { seconds: 60 },
        values: [],
        attributes: [
          { "increase to damage or healing": { percent: 10, appliesTo: ["Mana Potions", "Stamina Potions"] } },
        ],
        effects: [],
        setBonuses: [],
        lines: [],
      },
    });
    render(<ItemDetailsBox item={item} />);
    expect(screen.getByText("Must be used out of combat")).toBeInTheDocument();
    expect(screen.getByText("Targeting Mode: Friendly Personal Spell")).toBeInTheDocument();
    expect(screen.getByText("Casting Time: 2 seconds")).toBeInTheDocument();
    expect(screen.getByText("Recast: 10 seconds")).toBeInTheDocument();
    expect(screen.getByText("Duration: 60 seconds")).toBeInTheDocument();
    expect(screen.getByText("+10% Increase to Damage or Healing")).toBeInTheDocument();
    expect(screen.getByText("Mana Potions")).toBeInTheDocument();
    expect(screen.getByText("Stamina Potions")).toBeInTheDocument();
  });

  it("renders mount / companion / generic type labels", () => {
    const item = makeItem({
      stats: {
        binds: "NO_BIND",
        type: "Mount",
        values: [],
        attributes: [],
        effects: [],
        setBonuses: [],
        lines: [],
      },
    });
    render(<ItemDetailsBox item={item} />);
    expect(screen.getByText("Mount")).toBeInTheDocument();
  });

  it("renders gem tier bonuses from the structured field", () => {
    const item = makeItem({
      stats: {
        binds: "NO_BIND",
        values: [],
        attributes: [],
        tierBonuses: {
          10: {
            values: [{ critigation: 30 }],
            attributes: [{ "heal rating": 150 }, { "fatality rating": 60 }],
            procs: [
              { trigger: "on damage", spell: "Holy Storm", target: "target", rate: 10, rateUnit: "ppm" },
            ],
          },
        },
        effects: [],
        setBonuses: [],
        lines: [],
      },
    });
    render(<ItemDetailsBox item={item} />);
    expect(screen.getByText("Tier 10: Critigation Amount: 30")).toBeInTheDocument();
    expect(screen.getByText("Tier 10: +150 Heal Rating")).toBeInTheDocument();
    expect(screen.getByText("Tier 10: +60 Fatality Rating")).toBeInTheDocument();
    expect(screen.getByText("Tier 10: Chance on damage, Holy Storm on target, 10 Procs per Minute")).toBeInTheDocument();
  });

  it("derives the binds line from the enum", () => {
    const item = makeItem({
      stats: {
        binds: "BIND_ON_EQUIP",
        values: [],
        attributes: [],
        effects: [],
        setBonuses: [],
        lines: [],
      },
    });
    render(<ItemDetailsBox item={item} />);
    expect(screen.getByText("Binds when Equipped")).toBeInTheDocument();
    expect(screen.queryByText("BIND_ON_EQUIP")).not.toBeInTheDocument();
  });

  it("does not render a line for NO_BIND items", () => {
    const item = makeItem({
      stats: {
        binds: "NO_BIND",
        values: [],
        attributes: [],
        effects: [],
        setBonuses: [],
        lines: [],
      },
    });
    render(<ItemDetailsBox item={item} />);
    expect(screen.queryByText("No Bind")).not.toBeInTheDocument();
  });

  it("combines weapon dps and damage on one line", () => {
    const item = makeItem({
      stats: {
        itemLevel: 80,
        binds: "NO_BIND",
        values: [],
        damage: { min: 132, max: 173 },
        dps: 110.8,
        attributes: [],
        effects: [],
        setBonuses: [],
        lines: [],
      },
    });
    render(<ItemDetailsBox item={item} />);
    expect(screen.getByText("110.8 DPS (132 - 173)")).toBeInTheDocument();
  });

  it("shows the missing-data fallback when there is no tooltip", () => {
    render(<ItemDetailsBox item={makeItem()} />);
    expect(screen.getByText(/No tooltip data available/)).toBeInTheDocument();
  });

  it("renders the compact variant without error", () => {
    const item = makeItem({
      stats: {
        binds: "NO_BIND",
        values: [],
        attributes: [],
        effects: [],
        setBonuses: [],
        lines: [],
      },
    });
    render(<ItemDetailsBox item={item} compact />);
    expect(screen.getByText("Blade's Leggings of Charred Earth")).toBeInTheDocument();
  });
});
