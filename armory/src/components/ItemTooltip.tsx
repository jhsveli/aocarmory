import { useCallback, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Item } from "../types";
import { ItemDetails } from "./item-details.ts";
import ItemDetailsBox from "./ItemDetailsBox.tsx";
import styles from "./ItemTooltip.module.css";

interface TooltipState {
  item: Item;
  x: number;
  y: number;
}

const SHOW_DELAY = 120; // ms — avoids flashing when the cursor just passes over a name

/**
 * Provides the near-cursor hover tooltip and the click-pinned item state for
 * the docked item-detail panel. The panel itself is rendered in-flow by
 * ItemDetailsPanel (pages place it in their right column); only the floating
 * tooltip lives here.
 */
export function TooltipProvider({ children }: { children: ReactNode }) {
  const [tip, setTip] = useState<TooltipState | null>(null);
  const [panelItems, setPanelItems] = useState<Item[]>([]);
  const [compareMode, setCompareMode] = useState(false);
  const showTimer = useRef<number | null>(null);

  const show = useCallback((item: Item, x: number, y: number) => {
    if (showTimer.current) window.clearTimeout(showTimer.current);
    showTimer.current = window.setTimeout(() => setTip({ item, x, y }), SHOW_DELAY);
  }, []);

  const hide = useCallback(() => {
    if (showTimer.current) window.clearTimeout(showTimer.current);
    setTip(null);
  }, []);

  const toggle = useCallback((item: Item, additive?: boolean) => {
    if (showTimer.current) window.clearTimeout(showTimer.current);
    setTip(null); // a tap shouldn't leave the hover tooltip lingering
    setPanelItems((prev) => {
      const exists = prev.some((p) => p.id === item.id);
      if (additive) {
        return exists ? prev.filter((p) => p.id !== item.id) : [...prev, item];
      }
      // a plain click always focuses just this item — except toggling the
      // sole pinned item off again, which unpins instead of no-op'ing.
      return exists && prev.length === 1 ? [] : [item];
    });
  }, []);

  const clear = useCallback(() => {
    setPanelItems([]);
  }, []);

  const clearOne = useCallback((id: number) => {
    setPanelItems((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const toggleCompareMode = useCallback(() => {
    setCompareMode((c) => !c);
  }, []);

  return (
    <ItemDetails.Provider
      value={{ show, hide, toggle, clear, clearOne, panelItems, compareMode, toggleCompareMode }}
    >
      {children}
      {tip && (
        <div
          className={styles.itemTooltip}
          role="tooltip"
          style={{
            left: Math.min(tip.x + 16, window.innerWidth - 360),
            top: tip.y + 12,
          }}
        >
          <ItemDetailsBox item={tip.item} />
        </div>
      )}
    </ItemDetails.Provider>
  );
}
