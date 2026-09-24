import { useMemo, useState } from "react";
import { useArmoryData } from "../data";
import { slotDisplay } from "../lib/equip";
import { RARITY_CLASS } from "../lib/format";
import { DEFAULT_COMPARE_FILTERS, findCompareCandidates, type CompareFilters } from "../lib/compare-candidates";
import type { Item } from "../types";
import styles from "./AddCompareItemPicker.module.css";

const MAX_RESULTS = 40;

const FILTER_OPTIONS = [
  ["slot", "slot"],
  ["armorType", "armor type"],
  ["class", "class"],
  ["rarity", "rarity"],
] as const satisfies ReadonlyArray<readonly [keyof CompareFilters, string]>;

interface Props {
  /** the comparison's reference item (items[0]); the "Same: ..." filters are measured against it */
  mainItem?: Item;
  /** ids already in the comparison, excluded from the candidate list */
  excludeIds: Set<number>;
  onAdd: (item: Item) => void;
}

/**
 * The compare row's "add another item" card — opens inline in the slot the
 * next item would occupy, rather than as a dropdown off the toggle button.
 * Four default-checked "Same: ..." filters narrow candidates to the main
 * item's equip slot, tooltip type, class compatibility, and exact rarity —
 * each can be unchecked to widen the list.
 */
export default function AddCompareItemPicker({ mainItem, excludeIds, onAdd }: Props) {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<CompareFilters>(DEFAULT_COMPARE_FILTERS);
  const { flatItems } = useArmoryData();

  const toggleFilter = (key: keyof CompareFilters) => {
    setFilters((f) => ({ ...f, [key]: !f[key] }));
  };

  const candidates = useMemo(
    () => findCompareCandidates(flatItems, excludeIds, mainItem, filters, query),
    [flatItems, excludeIds, mainItem, filters, query],
  );

  return (
    <div className={styles.panel}>
      <div className={styles.filterRow} role="group" aria-label="Same as main item">
        <span>Same:</span>
        {FILTER_OPTIONS.map(([key, label]) => (
          <label key={key}>
            <input
              type="checkbox"
              checked={filters[key]}
              disabled={!mainItem}
              onChange={() => toggleFilter(key)}
            />
            {" "}{label}
          </label>
        ))}
      </div>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Find an item to compare..."
      />
      <ul className={styles.list}>
        {candidates.slice(0, MAX_RESULTS).map((item) => (
          <li key={item.id}>
            <button type="button" className={styles.candidate} onClick={() => onAdd(item)}>
              <span className={item.rarity ? RARITY_CLASS[item.rarity] : ""}>{item.name}</span>
              {slotDisplay(item.stats) && (
                <span className="itemSlot"> [{slotDisplay(item.stats)}]</span>
              )}
            </button>
          </li>
        ))}
        {candidates.length === 0 && <li className="page-intro">No matching items.</li>}
      </ul>
      {candidates.length > MAX_RESULTS && (
        <p className="page-intro">{candidates.length - MAX_RESULTS} more — refine your search.</p>
      )}
    </div>
  );
}
