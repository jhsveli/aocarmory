import { useMemo, useState } from "react";
import { useArmoryData } from "../data";
import { equipSlotKey, slotDisplay } from "../lib/equip";
import { RARITY_CLASS } from "../lib/format";
import { RARITIES } from "../lib/search";
import type { Item } from "../types";
import styles from "./AddCompareItemPicker.module.css";

const MAX_RESULTS = 40;

function rarityRank(rarity: Item["rarity"]): number {
  return rarity ? RARITIES.indexOf(rarity) : -1;
}

interface Props {
  mainItem: Item;
  onAdd: (item: Item) => void;
}

/**
 * Inline picker for the compare page's lone item — candidates are limited to
 * items sharing its equip slot, with same-rarity-or-higher items sorted
 * ahead of lower-rarity ones.
 */
export default function AddCompareItemPicker({ mainItem, onAdd }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { flatItems } = useArmoryData();
  const slot = equipSlotKey(mainItem.stats);

  const candidates = useMemo(() => {
    if (!slot) return [];
    const mainRank = rarityRank(mainItem.rarity);
    const seen = new Set<number>([mainItem.id]);
    const items: Item[] = [];
    for (const f of flatItems) {
      if (seen.has(f.item.id)) continue;
      if (equipSlotKey(f.item.stats) !== slot) continue;
      seen.add(f.item.id);
      items.push(f.item);
    }
    const q = query.trim().toLowerCase();
    const filtered = q ? items.filter((i) => i.name.toLowerCase().includes(q)) : items;
    return filtered.sort((a, b) => {
      const aRank = rarityRank(a.rarity);
      const bRank = rarityRank(b.rarity);
      const aHigher = aRank >= mainRank;
      const bHigher = bRank >= mainRank;
      if (aHigher !== bHigher) return aHigher ? -1 : 1;
      if (aRank !== bRank) return bRank - aRank;
      return a.name.localeCompare(b.name);
    });
  }, [flatItems, slot, mainItem.id, mainItem.rarity, query]);

  if (!slot) return null;

  return (
    <div className={styles.picker}>
      <button type="button" className={styles.toggle} onClick={() => setOpen((o) => !o)}>
        {open ? "Cancel" : "Add item to compare"}
      </button>
      {open && (
        <div className={styles.panel}>
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
            {candidates.length === 0 && <li className="page-intro">No matching items for this slot.</li>}
          </ul>
          {candidates.length > MAX_RESULTS && (
            <p className="page-intro">{candidates.length - MAX_RESULTS} more — refine your search.</p>
          )}
        </div>
      )}
    </div>
  );
}
