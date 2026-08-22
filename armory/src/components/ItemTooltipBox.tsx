import type { Item, ItemStats, StatValue } from "../types";
import { BIND_LABEL, RARITY_CLASS } from "../lib/format";
import { statLabel } from "../lib/stat-labels";

interface Props {
  item: Item;
  /** compact variant for small slots (armor builder) */
  compact?: boolean;
}

/** The single key/value pair of a StatValue (e.g. { armor: 512 }). */
function statEntry(v: StatValue): [string, number] {
  return Object.entries(v)[0];
}

/**
 * Flatten the structured parse into display lines, in the order the original
 * in-game tooltip shows them. Property labels come from the language file
 * (stat-labels.ts). Raw OCR lines not covered by the structure (vendor price,
 * faction/rank requirements, sockets, ...) are kept in `lines`.
 */
function statLines(stats: ItemStats): string[] {
  const out: string[] = [];
  // Display text is derived from the bind enum. NO_BIND is not rendered:
  // the original tooltip screenshots never show a "No Bind" line.
  if (stats.binds !== "NO_BIND") out.push(BIND_LABEL[stats.binds]);
  if (stats.type) out.push(stats.type);
  if (stats.itemLevel) out.push(`${statLabel("itemLevel")} ${stats.itemLevel}`);
  if (stats.requiresLevel) out.push(`${statLabel("requiresLevel")} ${stats.requiresLevel}`);
  if (stats.requires) out.push(stats.requires);
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
 * A CSS-drawn box that mimics the look of the original tooltip screenshot
 * (dark panel, rarity-colored item name, stat lines) — rendered from the
 * OCR-extracted text instead of a hotlinked image.
 */
export default function ItemTooltipBox({ item, compact }: Props) {
  const nameCls = [
    "tooltipName",
    item.rarity ? RARITY_CLASS[item.rarity] : "",
  ].filter(Boolean).join(" ");

  const lines = item.stats
    ? statLines(item.stats)
    : item.tooltip
      ? item.tooltip.split("\n").map((l) => l.trim()).filter(Boolean)
      : null;

  return (
    <div className={`tooltipBox${compact ? " compact" : ""}`}>
      <div className={nameCls}>{item.name}</div>
      {lines ? (
        <div className="tooltipBody">
          {lines.map((line, i) => (
            <div key={i} className="line">
              {line}
            </div>
          ))}
        </div>
      ) : (
        <div className="missing">No tooltip data available for {item.name}</div>
      )}
    </div>
  );
}
