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
 * Provides the near-cursor hover tooltip, the click-pinned item for the
 * docked right-side panel, and the shift-click staging list for the
 * dedicated compare page. The panel itself is rendered in-flow by
 * ItemDetailsPanel (pages place it in their right column); only the floating
 * tooltip lives here.
 */
export function TooltipProvider({ children }: { children: ReactNode }) {
  const [tip, setTip] = useState<TooltipState | null>(null);
  const [panelItem, setPanelItem] = useState<Item | null>(null);
  const [itemsToCompare, setItemsToCompare] = useState<Item[]>([]);
  const showTimer = useRef<number | null>(null);

  const show = useCallback((item: Item, x: number, y: number) => {
    if (showTimer.current) window.clearTimeout(showTimer.current);
    showTimer.current = window.setTimeout(() => setTip({ item, x, y }), SHOW_DELAY);
  }, []);

  const hide = useCallback(() => {
    if (showTimer.current) window.clearTimeout(showTimer.current);
    setTip(null);
  }, []);

  const toggle = useCallback((item: Item) => {
    if (showTimer.current) window.clearTimeout(showTimer.current);
    setTip(null); // a tap shouldn't leave the hover tooltip lingering
    setPanelItem((prev) => (prev?.id === item.id ? null : item));
  }, []);

  const clear = useCallback(() => {
    setPanelItem(null);
  }, []);

  const toggleCompare = useCallback((item: Item) => {
    setItemsToCompare((prev) => {
      const exists = prev.some((p) => p.id === item.id);
      return exists ? prev.filter((p) => p.id !== item.id) : [...prev, item];
    });
  }, []);

  const removeFromCompare = useCallback((id: number) => {
    setItemsToCompare((prev) => prev.filter((p) => p.id !== id));
  }, []);

  return (
    <ItemDetails.Provider
      value={{
        show, hide, toggle, clear, panelItem,
        itemsToCompare, toggleCompare, removeFromCompare,
      }}
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
