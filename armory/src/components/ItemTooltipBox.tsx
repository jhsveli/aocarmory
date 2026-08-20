import type { Item, ItemStats } from "../types";
import { BIND_LABEL, RARITY_CLASS } from "../lib/format";

interface Props {
  item: Item;
  /** compact variant for small slots (armor builder) */
  compact?: boolean;
}

/**
 * Flatten the structured parse into display lines, in the order the original
 * in-game tooltip shows them. Raw OCR lines not covered by the structure
 * (vendor price, faction/rank requirements, sockets, ...) are kept in `lines`.
 */
function statLines(stats: ItemStats): string[] {
  const out: string[] = [];
  // Display text is derived from the bind enum. NO_BIND is not rendered:
  // the original tooltip screenshots never show a "No Bind" line.
  if (stats.binds !== "NO_BIND") out.push(BIND_LABEL[stats.binds]);
  if (stats.type) out.push(stats.type);
  if (stats.level) out.push(`Item Level ${stats.level}`);
  if (stats.requires) out.push(stats.requires);
  if (stats.armor) out.push(`Armor: ${stats.armor}`);
  if (stats.damage && stats.dps) {
    out.push(`${stats.dps} DPS (${stats.damage.min} - ${stats.damage.max})`);
  } else {
    if (stats.damage) out.push(`Damage: ${stats.damage.min} - ${stats.damage.max}`);
    if (stats.dps) out.push(`DPS: ${stats.dps}`);
  }
  out.push(...stats.attributes, ...stats.effects);
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
