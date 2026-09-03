import { statLabel } from "./stat-labels";

/**
 * Display language for faction rank requirements.
 *
 * The dataset stores faction requirements compactly as
 * `stats.requiresFactionRank = { "<faction key>": <rank level> }`, where the
 * faction key is lowercase ("last legion"). Human-readable faction names and
 * the per-rank titles (which differ per faction, e.g. Last Legion ranks are
 * Soldier/Captain/Commander/General) live here, so display text can be
 * corrected or extended without touching the data.
 *
 * `prep` mirrors the original tooltip phrasing: most factions read
 * "Soldier (Rank 1) in Last Legion", while Clan Vigdis and the Pit Master's
 * Arena factions genuinely read "... with the faction <name>".
 */

export interface FactionRankInfo {
  /** display name of the faction, e.g. "Last Legion" */
  name: string;
  /** preposition used in the original tooltip */
  prep: "in" | "with the faction";
  /** rank title by rank level (1 = lowest). Missing ranks are unknown. */
  ranks: Partial<Record<number, string>>;
}

export const FACTIONS: Record<string, FactionRankInfo> = {
  "brittle blade": {
    name: "Brittle Blade", prep: "in",
    ranks: { 1: "Thug", 2: "Strangler", 3: "Stalker", 4: "Blade" },
  },
  "children of yag-kosha": {
    name: "Children of Yag-kosha", prep: "in",
    ranks: { 1: "Pilgrim", 2: "Believer", 3: "Mystic", 4: "Sage" },
  },
  "clan vigdis": {
    name: "Clan Vigdis", prep: "with the faction",
    ranks: { 4: "Jarl" },
  },
  "hyrkanians": {
    name: "Hyrkanians", prep: "in",
    ranks: { 1: "Walker", 2: "Blooded", 3: "Clan Bound", 4: "Honored" },
  },
  "jiang shi": {
    name: "Jiang Shi", prep: "in",
    ranks: { 4: "Enlightened" },
  },
  "last legion": {
    name: "Last Legion", prep: "in",
    ranks: { 1: "Soldier", 2: "Captain", 3: "Commander", 4: "General" },
  },
  "pit master's arena (gladiators)": {
    name: "Pit Master's Arena (Gladiators)", prep: "with the faction",
    ranks: { 4: "Arena Champion" },
  },
  "pit master's arena (pit fighters)": {
    name: "Pit Master's Arena (Pit Fighters)", prep: "with the faction",
    ranks: { 4: "Pit Champion" },
  },
  "scarlet circle": {
    name: "Scarlet Circle", prep: "in",
    ranks: { 1: "Neophyte", 2: "Thaumaturge", 3: "Sorcerer", 4: "Summoner" },
  },
  "scholars of cheng-ho": {
    name: "Scholars of Cheng-ho", prep: "in",
    ranks: { 1: "Initiate", 2: "Reader", 3: "Savant", 4: "Scholar" },
  },
  "shadows of jade": {
    name: "Shadows of Jade", prep: "in",
    ranks: { 1: "Pickpocket", 2: "Footpad", 3: "Thief", 4: "Jade Shadow" },
  },
  "tamarin's tigers": {
    name: "Tamarin's Tigers", prep: "in",
    ranks: { 1: "Venturer", 2: "Freebooter", 3: "Mercenary", 4: "Tiger" },
  },
  "wolves of the steppes": {
    name: "Wolves of the Steppes", prep: "in",
    ranks: { 1: "Brigand", 2: "Raider", 3: "Bandit", 4: "Wolf of the Steppes" },
  },
  "yellow priests of yun": {
    name: "Yellow Priests of Yun", prep: "in",
    ranks: { 1: "Acolyte", 2: "Monk", 3: "Priest", 4: "Archpriest" },
  },
};

/** Render the tooltip-style requirement line for a faction/rank pair. */
export function factionRankText(faction: string, rank: number): string {
  const info = FACTIONS[faction];
  const name = info?.name ?? statLabel(faction);
  const title = info?.ranks[rank];
  const prep = info?.prep ?? "in";
  return title
    ? `${title} (Rank ${rank}) ${prep} ${name}`
    : `Requires Rank ${rank} ${prep} ${name}`;
}
