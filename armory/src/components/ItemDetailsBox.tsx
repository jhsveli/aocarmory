import type { Item, ItemStats, StatValue } from "../types";
import { BIND_LABEL, RARITY_CLASS } from "../lib/format";
import { statLabel } from "../lib/stat-labels";
import styles from "./ItemDetailsBox.module.css";

interface Props {
  item: Item;
  /** extra class names (e.g. the panel's in-box override) */
  className?: string;
  /** compact variant for small slots (armor builder) */
  compact?: boolean;
}

/** The single key/value pair of a StatValue (e.g. { armor: 512 }). */
function statEntry(v: StatValue): [string, number] {
  const [name, value] = Object.entries(v)[0];
  // StatValue is Partial to allow single-key entries, but a present key
  // always carries a number in the generated data.
  return [name, value as number];
}

/**
 * Flatten the structured parse into display lines, in the order the original
 * in-game tooltip shows them. Property labels come from the language file
 * (stat-labels.ts). Raw OCR lines not covered by the structure (vendor price,
 * faction/rank requirements, sockets, ...) are kept in `lines`.
 */
function statLines(stats: ItemStats): string[] {
  const out: string[] = [];
  if (stats.type) out.push(stats.type);
  if (stats.classes?.length) out.push(`${statLabel("classes")}: ${stats.classes.join(", ")}`);
  if (stats.itemLevel) out.push(`${statLabel("itemLevel")} ${stats.itemLevel}`);
  if (stats.requiresLevel) out.push(`${statLabel("requiresLevel")} ${stats.requiresLevel}`);
  if (stats.requiresPvpLevel) out.push(`${statLabel("requiresPvpLevel")} ${stats.requiresPvpLevel}`);
  if (stats.requiresRenownLevel) out.push(`${statLabel("requiresRenownLevel")} ${stats.requiresRenownLevel}`);
  if (stats.requiresItemLevel) out.push(`Requires a Level ${stats.requiresItemLevel} Item`);
  for (const v of stats.values) {
    const [name, value] = statEntry(v);
    out.push(`${statLabel(name)}: ${value}`);
  }
  if (stats.damage && stats.dps) {
    out.push(`${stats.dps} DPS (${stats.damage.min} - ${stats.damage.max})`);
  } else {
    if (stats.damage) out.push(`Damage: ${stats.damage.min} - ${stats.damage.max}`);
    if (stats.dps) out.push(`DPS: ${stats.dps}`);
  }
  for (const a of stats.attributes) {
    const [name, value] = statEntry(a);
    out.push(`${value >= 0 ? "+" : ""}${value} ${statLabel(name)}`);
  }
  out.push(...stats.effects);
  if (stats.set) out.push(stats.set);
  out.push(...stats.setBonuses);
  if (stats.description) out.push(...stats.description.split("\n"));
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

  const lines = item.stats
    ? statLines(item.stats)
    : item.tooltip
      ? item.tooltip.split("\n").map((l) => l.trim()).filter(Boolean)
      : null;

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
