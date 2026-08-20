import { useCallback, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Item } from "../types";
import { ItemDetails } from "./item-details.ts";
import ItemTooltipBox from "./ItemTooltipBox";

interface PanelState {
  item: Item;
  /** Clicked/tapped — stays visible until closed, unpinned, or replaced. */
  pinned: boolean;
}

const SHOW_DELAY = 120; // ms — avoids flashing when the cursor just passes over a name
const HIDE_GRACE = 200; // ms — lets the pointer reach the panel before a preview clears

/**
 * Provides the single right-side item-detail panel (replaces the old
 * near-cursor tooltip). Hovering an item previews it in the panel; clicking
 * or tapping pins it there so it survives until closed, unpinned, or replaced.
 */
export function TooltipProvider({ children }: { children: ReactNode }) {
  const [panel, setPanel] = useState<PanelState | null>(null);
  const showTimer = useRef<number | null>(null);
  const hideTimer = useRef<number | null>(null);

  const show = useCallback((item: Item) => {
    if (showTimer.current) window.clearTimeout(showTimer.current);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    showTimer.current = window.setTimeout(() => {
      setPanel((p) =>
        p?.pinned && p.item.id === item.id ? p : { item, pinned: false },
      );
    }, SHOW_DELAY);
  }, []);

  const hide = useCallback(() => {
    if (showTimer.current) window.clearTimeout(showTimer.current);
    hideTimer.current = window.setTimeout(() => {
      setPanel((p) => (p?.pinned ? p : null));
    }, HIDE_GRACE);
  }, []);

  const toggle = useCallback((item: Item) => {
    if (showTimer.current) window.clearTimeout(showTimer.current);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    setPanel((p) =>
      p?.pinned && p.item.id === item.id ? null : { item, pinned: true },
    );
  }, []);

  const clear = useCallback(() => {
    if (showTimer.current) window.clearTimeout(showTimer.current);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    setPanel(null);
  }, []);

  return (
    <ItemDetails.Provider value={{ show, hide, toggle, clear }}>
      {children}
      {panel && (
        <aside
          className="itemPanel"
          aria-label="Item details"
          onMouseEnter={() => {
            if (hideTimer.current) window.clearTimeout(hideTimer.current);
          }}
          onMouseLeave={hide}
        >
          <div className="panelHeader">
            <span className="panelTitle">Item details</span>
            <button
              type="button"
              className="panelClose"
              onClick={clear}
              aria-label="Close item details"
            >
              ✕
            </button>
          </div>
          <ItemTooltipBox item={panel.item} />
        </aside>
      )}
    </ItemDetails.Provider>
  );
}
