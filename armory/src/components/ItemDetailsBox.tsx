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

/**
 * Flatten the structured parse into display lines, in the order the original
 * in-game tooltip shows them. Property labels come from the language file
 * (stat-labels.ts). Raw OCR lines not covered by the structure (vendor price,
 * sockets, ...) are kept in `lines`.
 */
function statLines(stats: ItemStats): string[] {
  const out: string[] = [];
  if (stats.type) {
    // the tooltip prints "Type - Slot(s)"; slots is the split-off part
    out.push(stats.type + (stats.slots?.length ? ` - ${stats.slots.join(", ")}` : ""));
  }
  if (stats.gemKind) out.push(`${stats.gemKind} Gem`);
  if (stats.classes?.length) out.push(`${statLabel("classes")}: ${stats.classes.join(", ")}`);
  if (stats.itemLevel) out.push(`${statLabel("itemLevel")} ${stats.itemLevel}`);
  if (stats.requiresLevel) out.push(`${statLabel("requiresLevel")} ${stats.requiresLevel}`);
  if (stats.requiresPvpLevel) out.push(`${statLabel("requiresPvpLevel")} ${stats.requiresPvpLevel}`);
  if (stats.requiresRenownLevel) out.push(`${statLabel("requiresRenownLevel")} ${stats.requiresRenownLevel}`);
  if (stats.requiresItemLevel) out.push(`Requires a Level ${stats.requiresItemLevel} Item`);
  if (stats.mustBeUsedOutOfCombat) out.push("Must be used out of combat");
  if (stats.targetingMode) out.push(`Targeting Mode: ${stats.targetingMode}`);
  if (stats.castingTime) out.push(`Casting Time: ${durationText(stats.castingTime)}`);
  if (stats.recast) out.push(`Recast: ${durationText(stats.recast)}`);
  if (stats.duration) out.push(`Duration: ${durationText(stats.duration)}`);
  if (stats.requiresFactionRank) {
    for (const [faction, rank] of Object.entries(stats.requiresFactionRank)) {
      out.push(factionRankText(faction, rank));
    }
  }
  if (stats.canOnlyHaveOne) out.push("Can Only Have One");
  for (const v of stats.values) {
    const [name, value] = statEntry(v);
    if (typeof value === "object") {
      out.push(`${statLabel(name)}: ${value.percent}%`);
    } else {
      out.push(`${statLabel(name)}: ${value}`);
    }
  }
  if (stats.damage && stats.dps) {
    out.push(`${stats.dps} DPS (${stats.damage.min} - ${stats.damage.max})`);
  } else {
    if (stats.damage) out.push(`Damage: ${stats.damage.min} - ${stats.damage.max}`);
    if (stats.dps) out.push(`DPS: ${stats.dps}`);
  }
  for (const a of stats.attributes) {
    const [name, value] = statEntry(a);
    out.push(statLabelValue(name, value));
    if (typeof value === "object" && value.appliesTo?.length) {
      for (const target of value.appliesTo) out.push(target);
    }
  }
  for (const p of stats.procs ?? []) {
    // reconstruct the original tooltip line, e.g.
    // "Chance on damage, Defiling Strike on target, 3 Procs per Minute"
    out.push(`Chance ${p.trigger}, ${p.spell} on ${p.target}, ${p.rate} ${
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
          out.push(`Tier ${tier}: ${tierBonusLine(entry, kind as "values" | "attributes" | "procs")}`);
        }
      }
    }
  }
  out.push(...stats.effects);
  if (stats.set) out.push(stats.set);
  out.push(...stats.setBonuses);
  if (stats.description) out.push(...stats.description);
  if (stats.learnSpell) out.push(`Learn Spell: ${stats.learnSpell}`);
  if (stats.engravings?.length) out.push(`Rune Engravings: ${stats.engravings.join(", ")}`);
  if (stats.gemSlots?.length) out.push(`Gem Slots: ${stats.gemSlots.join(", ")}`);
  if (stats.vendorPrice) {
    const parts = Object.entries(stats.vendorPrice).map(
      ([currency, amount]) => `${amount} ${currency.charAt(0).toUpperCase()}${currency.slice(1)}`,
    );
    out.push(`Vendor Price ${parts.join(" ")}`);
  }
  out.push(...stats.lines);
  return out;
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

  const lines = item.stats ? statLines(item.stats) : null;

  const boxCls = [
    styles.tooltipBox,
    compact ? styles.compact : "",
    className ?? "",
  ].filter(Boolean).join(" ");

  return (
    <div className={boxCls}>
      <h2 className={nameCls}>{item.name}</h2>
      {bindText && (<div className={styles.binds}>{bindText}</div>)}
      {lines ? (
        <div className={styles.tooltipBody}>
          {lines.map((line, i) => (
            <div key={i} className={styles.line}>
              {line}
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.missing}>No tooltip data available for {item.name}</div>
      )}
    </div>
  );
}
