import { useCallback, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Item } from "../types";
import { ItemDetails } from "./item-details.ts";
import ItemTooltipBox from "./ItemTooltipBox";
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
  const [panel, setPanel] = useState<Item | null>(null);
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
    setPanel((p) => (p?.id === item.id ? null : item));
  }, []);

  const clear = useCallback(() => {
    setPanel(null);
  }, []);

  return (
    <ItemDetails.Provider value={{ show, hide, toggle, clear, panelItem: panel }}>
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
          <ItemTooltipBox item={tip.item} />
        </div>
      )}
    </ItemDetails.Provider>
  );
}
