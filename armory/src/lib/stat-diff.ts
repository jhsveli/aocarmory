import type { Item, ItemStats, StatValue } from "../types";
import { statLabel } from "./stat-labels";

export interface DiffRow {
  key: string;
  label: string;
  delta: number;
  isPercent: boolean;
  /** true when this delta is the beneficial direction for this particular stat */
  good: boolean;
}

/**
 * Stats where a more-negative number is the better outcome (mitigation-style),
 * confirmed against research/armory_data.json: staggering chance is always
 * negative in the real dataset, unlike the pvp-* family (sometimes-negative
 * but still "higher is better") or strength/hit rating's rare OCR-noise
 * negatives.
 */
const INVERTED_POLARITY_KEYS = new Set(["staggering chance"]);

interface StatEntry {
  value: number;
  isPercent: boolean;
}

function collectStatMap(stats: ItemStats | null | undefined): Map<string, StatEntry> {
  const map = new Map<string, StatEntry>();
  const addAll = (list: StatValue[] | undefined) => {
    for (const entry of list ?? []) {
      for (const [key, raw] of Object.entries(entry)) {
        if (raw == null) continue;
        if (typeof raw === "object") map.set(key, { value: raw.percent, isPercent: true });
        else map.set(key, { value: raw, isPercent: false });
      }
    }
  };
  addAll(stats?.values);
  addAll(stats?.attributes);
  return map;
}

/**
 * Stat deltas for `item` relative to `main` (item's value minus main's).
 * Covers Stat values, Attributes and dps; a stat missing on one side counts
 * as 0 (union semantics), and stats identical on both sides are omitted.
 */
export function computeStatDiff(main: Item, item: Item): DiffRow[] {
  const mainMap = collectStatMap(main.stats);
  const itemMap = collectStatMap(item.stats);
  const rows: DiffRow[] = [];
  const seen = new Set<string>();

  const addRow = (key: string) => {
    if (seen.has(key)) return;
    seen.add(key);
    const mainEntry = mainMap.get(key);
    const itemEntry = itemMap.get(key);
    const delta = (itemEntry?.value ?? 0) - (mainEntry?.value ?? 0);
    if (delta === 0) return;
    const inverted = INVERTED_POLARITY_KEYS.has(key);
    rows.push({
      key,
      label: statLabel(key),
      delta,
      isPercent: (itemEntry ?? mainEntry)!.isPercent,
      good: inverted ? delta < 0 : delta > 0,
    });
  };

  for (const key of mainMap.keys()) addRow(key);
  for (const key of itemMap.keys()) addRow(key);

  const mainDps = main.stats?.dps ?? 0;
  const itemDps = item.stats?.dps ?? 0;
  const dpsDelta = itemDps - mainDps;
  if (dpsDelta !== 0) {
    rows.push({ key: "dps", label: "DPS", delta: dpsDelta, isPercent: false, good: dpsDelta > 0 });
  }

  return rows;
}
