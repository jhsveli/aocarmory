import { RARITIES } from "../lib/search";
import type { ItemFilters } from "../lib/filters";
import type { Rarity } from "../types";
import styles from "./FilterBar.module.css";

interface Props {
  filters: ItemFilters;
  onChange: (patch: Partial<ItemFilters>) => void;
}

/** Rarity threshold + Requires Level range controls for a Section's item tree. */
export default function FilterBar({ filters, onChange }: Props) {
  return (
    <div className={styles.filterBar} role="group" aria-label="Item filters">
      <label>
        Min rarity{" "}
        <select
          value={filters.minRarity ?? RARITIES[0]}
          onChange={(e) => onChange({ minRarity: e.target.value as Rarity })}
        >
          {RARITIES.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </label>
      <label>
        Min level{" "}
        <input
          type="number"
          min={1}
          max={80}
          value={filters.minLevel ?? ""}
          onChange={(e) => onChange({ minLevel: e.target.value ? Number(e.target.value) : undefined })}
        />
      </label>
      <label>
        Max level{" "}
        <input
          type="number"
          min={1}
          max={80}
          value={filters.maxLevel ?? ""}
          onChange={(e) => onChange({ maxLevel: e.target.value ? Number(e.target.value) : undefined })}
        />
      </label>
    </div>
  );
}
