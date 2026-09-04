import type { ReactNode } from "react";
import type { Duration, Item, ItemStats, PercentValue, Proc, StatValue } from "../types";
import { BIND_LABEL, RARITY_CLASS } from "../lib/format";
import { statLabel } from "../lib/stat-labels";
import { factionRankText } from "../lib/faction-ranks";
import styles from "./ItemDetailsBox.module.css";

interface Props {
  item: Item;
  /** extra class names (e.g. the panel's in-box override) */
  className?: string;
  /** compact variant for small slots (armor builder) */
  compact?: boolean;
}

/** The single key/value pair of a StatValue (e.g. { armor: 512 }). */
type StatValueEntry = [string, number | PercentValue];

function statEntry(v: StatValue): StatValueEntry {
  const [name, value] = Object.entries(v)[0];
  // StatValue is Partial to allow single-key entries, but a present key
  // always carries a value in the generated data.
  return [name, value as number | PercentValue];
}

/** "1 hour 45 minutes" / "10 seconds" from a Duration value. */
function durationText(d: Duration): string {
  const parts = [
    d.hours ? `${d.hours} ${d.hours === 1 ? "hour" : "hours"}` : "",
    d.minutes ? `${d.minutes} ${d.minutes === 1 ? "minute" : "minutes"}` : "",
    d.seconds ? `${d.seconds} ${d.seconds === 1 ? "second" : "seconds"}` : "",
  ].filter(Boolean);
  return parts.join(" ");
}

/** "+42 Strength" / "+5% Out of Combat Movement Speed". */
function statLabelValue(name: string, value: number | PercentValue): string {
  if (typeof value === "object") {
    const p = value.percent;
    return `${p >= 0 ? "+" : ""}${p}% ${statLabel(name)}`;
  }
  return `${value >= 0 ? "+" : ""}${value} ${statLabel(name)}`;
}

/** "Tier 10: +150 Heal Rating" — one bonus line under a gem tier. */
function tierBonusLine(entry: StatValue | Proc, kind: "values" | "attributes" | "procs"): string {
  if (kind === "procs" || "trigger" in entry) {
    const p = entry as Proc;
    return `Chance ${p.trigger}, ${p.spell} on ${p.target}, ${p.rate} ${
      p.rateUnit === "ppm" ? "Procs per Minute" : "percent chance"
    }`;
  }
  const [name, value] = statEntry(entry);
  if (kind === "attributes") {
    return statLabelValue(name, value);
  }
  if (typeof value === "object") {
    return `${statLabel(name)}: ${value.percent}%`;
  }
  return `${statLabel(name)}: ${value}`;
}

type StatBlock = { id: string; rows: ReactNode[] };

/** Wrap a numeric stat value so it can receive its own styling. */
function statNum(value: string): ReactNode {
  return <span className={styles.num}>{value}</span>;
}

/**
 * Build the tooltip body as an ordered list of blocks — one per logical
 * group — in the order the original in-game tooltip shows them. The stat
 * groups stay apart (values, then weapon damage/DPS, then attributes) so they
 * can be rendered as separate sections, and every numeric value is emitted in
 * its own tag. Property labels come from the language file (stat-labels.ts).
 * Raw OCR lines not covered by the structure (vendor price, sockets, ...) are
 * kept in `lines` at the end of the final block.
 */
function statBlocks(stats: ItemStats): StatBlock[] {
  const head: ReactNode[] = [];
  if (stats.type) {
    // the tooltip prints "Type - Slot(s)"; slots is the split-off part
    head.push(stats.type + (stats.slots?.length ? ` - ${stats.slots.join(", ")}` : ""));
  }
  if (stats.gemKind) head.push(`${stats.gemKind} Gem`);
  if (stats.classes?.length) head.push(`${statLabel("classes")}: ${stats.classes.join(", ")}`);
  if (stats.itemLevel) head.push(`${statLabel("itemLevel")} ${stats.itemLevel}`);
  if (stats.requiresLevel) head.push(`${statLabel("requiresLevel")} ${stats.requiresLevel}`);
  if (stats.requiresPvpLevel) head.push(`${statLabel("requiresPvpLevel")} ${stats.requiresPvpLevel}`);
  if (stats.requiresRenownLevel) head.push(`${statLabel("requiresRenownLevel")} ${stats.requiresRenownLevel}`);
  if (stats.requiresItemLevel) head.push(`Requires a Level ${stats.requiresItemLevel} Item`);
  if (stats.mustBeUsedOutOfCombat) head.push("Must be used out of combat");
  if (stats.targetingMode) head.push(`Targeting Mode: ${stats.targetingMode}`);
  if (stats.castingTime) head.push(`Casting Time: ${durationText(stats.castingTime)}`);
  if (stats.recast) head.push(`Recast: ${durationText(stats.recast)}`);
  if (stats.duration) head.push(`Duration: ${durationText(stats.duration)}`);
  if (stats.requiresFactionRank) {
    for (const [faction, rank] of Object.entries(stats.requiresFactionRank)) {
      head.push(factionRankText(faction, rank));
    }
  }
  if (stats.canOnlyHaveOne) head.push("Can Only Have One");

  const values: ReactNode[] = (stats.values ?? []).map((v) => {
    const [name, value] = statEntry(v);
    return typeof value === "object"
      ? <>{statNum(`${value.percent}%`)} {statLabel(name)}</>
      : <>{statNum(`${value}`)} {statLabel(name)}</>;
  });

  const combat: ReactNode[] = [];
  if (stats.damage && stats.dps) {
    combat.push(
      <>{statNum(`${stats.dps}`)} DPS ({statNum(`${stats.damage.min}`)} - {statNum(`${stats.damage.max}`)})</>,
    );
  } else {
    if (stats.damage) {
      combat.push(
        <>Damage: {statNum(`${stats.damage.min}`)} - {statNum(`${stats.damage.max}`)}</>,
      );
    }
    if (stats.dps) combat.push(<>DPS: {statNum(`${stats.dps}`)}</>);
  }

  const attributes: ReactNode[] = [];
  for (const a of stats.attributes ?? []) {
    const [name, value] = statEntry(a);
    if (typeof value === "object") {
      const p = value.percent;
      attributes.push(<>{statNum(`${p >= 0 ? "+" : ""}${p}%`)} {statLabel(name)}</>);
      if (value.appliesTo?.length) {
        for (const target of value.appliesTo) attributes.push(target);
      }
    } else {
      attributes.push(<>{statNum(`${value >= 0 ? "+" : ""}${value}`)} {statLabel(name)}</>);
    }
  }

  const tail: ReactNode[] = [];
  for (const p of stats.procs ?? []) {
    // reconstruct the original tooltip line, e.g.
    // "Chance on damage, Defiling Strike on target, 3 Procs per Minute"
    tail.push(`Chance ${p.trigger}, ${p.spell} on ${p.target}, ${p.rate} ${
      p.rateUnit === "ppm" ? "Procs per Minute" : "percent chance"
    }`);
  }
  if (stats.tierBonuses) {
    for (const [tier, bonus] of Object.entries(stats.tierBonuses)) {
      const groups: [string, (StatValue | Proc)[]][] = [
        ["values", bonus.values ?? []],
        ["attributes", bonus.attributes ?? []],
        ["procs", bonus.procs ?? []],
      ];
      for (const [kind, entries] of groups) {
        for (const entry of entries) {
          tail.push(`Tier ${tier}: ${tierBonusLine(entry, kind as "values" | "attributes" | "procs")}`);
        }
      }
    }
  }
  tail.push(...stats.effects);
  if (stats.set) tail.push(stats.set);
  tail.push(...stats.setBonuses);
  if (stats.description) tail.push(...stats.description);
  if (stats.learnSpell) tail.push(`Learn Spell: ${stats.learnSpell}`);
  if (stats.engravings?.length) tail.push(`Rune Engravings: ${stats.engravings.join(", ")}`);
  if (stats.gemSlots?.length) tail.push(`Gem Slots: ${stats.gemSlots.join(", ")}`);
  if (stats.vendorPrice) {
    const parts = Object.entries(stats.vendorPrice).map(
      ([currency, amount]) => `${amount} ${currency.charAt(0).toUpperCase()}${currency.slice(1)}`,
    );
    tail.push(`Vendor Price ${parts.join(" ")}`);
  }
  tail.push(...stats.lines);

  const blocks: StatBlock[] = [];
  if (head.length) blocks.push({ id: "head", rows: head });
  if (values.length) blocks.push({ id: "values", rows: values });
  if (combat.length) blocks.push({ id: "combat", rows: combat });
  if (attributes.length) blocks.push({ id: "attributes", rows: attributes });
  if (tail.length) blocks.push({ id: "tail", rows: tail });
  return blocks;
}

/**
 * Mimics the look of the original tooltip screenshot
 * (dark panel, rarity-coloration, armor location and stats extracted with OCR from OG screenshot)
 */
export default function ItemDetailsBox({ item, compact, className }: Props) {
  const nameCls = [
    styles.tooltipName,
    item.rarity ? RARITY_CLASS[item.rarity] : "",
  ].filter(Boolean).join(" ");

  const bindText = item.stats?.binds && item.stats.binds !== "NO_BIND" ? BIND_LABEL[item.stats.binds] : null;

  const blocks = item.stats ? statBlocks(item.stats) : null;

  const boxCls = [
    styles.tooltipBox,
    compact ? styles.compact : "",
    className ?? "",
  ].filter(Boolean).join(" ");

  return (
    <div className={boxCls}>
      <h2 className={nameCls}>{item.name}</h2>
      {bindText && (<div className={styles.binds}>{bindText}</div>)}
      {blocks ? (
        <div className={styles.tooltipBody}>
          {blocks.map((block) => (
            <div key={block.id} className={styles.statSection}>
              {block.rows.map((row, i) => (
                <div key={i} className={styles.line}>
                  {row}
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.missing}>No tooltip data available for {item.name}</div>
      )}
    </div>
  );
}
