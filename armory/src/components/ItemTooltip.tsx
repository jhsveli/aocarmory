import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useLocation, useNavigate, useNavigationType } from "react-router-dom";
import type { Item } from "../types";
import { ItemDetails } from "./item-details.ts";
import ItemDetailsBox from "./ItemDetailsBox.tsx";
import styles from "./ItemTooltip.module.css";

interface TooltipState {
  item: Item;
  x: number;
  y: number;
}

/**
 * Pinned-items snapshot kept in a history entry. Entries sharing a pinChain
 * were created by replace-clicks; moving between them (Back/Forward) restores
 * their snapshot.
 */
interface PinHistoryState {
  pinChain: string;
  pinned: Item[];
}

const SHOW_DELAY = 120; // ms — avoids flashing when the cursor just passes over a name

/**
 * Provides the near-cursor hover tooltip, the pinned items for the docked
 * right-side panel and the builder's single pinned item. The panel itself is
 * rendered in-flow by ItemDetailsPanel (pages place it in their right
 * column); only the floating tooltip lives here.
 */
export function TooltipProvider({ children }: { children: ReactNode }) {
  const [tip, setTip] = useState<TooltipState | null>(null);
  const [pinnedItems, setPinnedItems] = useState<Item[]>([]);
  const [pinManyMode, setPinManyMode] = useState(false);
  const [builderItem, setBuilderItem] = useState<Item | null>(null);
  const showTimer = useRef<number | null>(null);
  const pinnedRef = useRef<Item[]>([]);
  const navigate = useNavigate();
  const location = useLocation();
  const navigationType = useNavigationType();
  const locationRef = useRef(location);
  const prevLocationState = useRef<unknown>(location.state);

  const setPinned = useCallback((next: Item[]) => {
    pinnedRef.current = next;
    setPinnedItems(next);
  }, []);

  // Back/Forward between entries of one pin chain restores that entry's snapshot
  useEffect(() => {
    locationRef.current = location;
    const prev = prevLocationState.current as PinHistoryState | null;
    const cur = location.state as PinHistoryState | null;
    prevLocationState.current = location.state;
    if (navigationType === "POP" && cur?.pinChain && prev?.pinChain === cur.pinChain) {
      setPinned(cur.pinned);
    }
  }, [location, navigationType, setPinned]);

  const show = useCallback((item: Item, x: number, y: number) => {
    if (showTimer.current) window.clearTimeout(showTimer.current);
    showTimer.current = window.setTimeout(() => setTip({ item, x, y }), SHOW_DELAY);
  }, []);

  const hide = useCallback(() => {
    if (showTimer.current) window.clearTimeout(showTimer.current);
    setTip(null);
  }, []);

  const hideNow = useCallback(() => {
    if (showTimer.current) window.clearTimeout(showTimer.current);
    setTip(null); // a tap shouldn't leave the hover tooltip lingering
  }, []);

  const toggle = useCallback((item: Item, additive = false) => {
    hideNow();
    const prev = pinnedRef.current;
    const exists = prev.some((p) => p.id === item.id);
    if (additive) {
      setPinned(exists ? prev.filter((p) => p.id !== item.id) : [...prev, item]);
      return;
    }
    const next = prev.length === 1 && exists ? [] : [item];
    if (prev.length >= 2) {
      // stamp the current entry with the old set, then push the new one — Back undoes
      const loc = locationRef.current;
      const st = loc.state as PinHistoryState | null;
      const pinChain = st?.pinChain ?? `${Date.now()}-${Math.random()}`;
      const to = { pathname: loc.pathname, search: loc.search, hash: loc.hash };
      navigate(to, { replace: true, state: { pinChain, pinned: prev } });
      navigate(to, { state: { pinChain, pinned: next } });
    }
    setPinned(next);
  }, [hideNow, navigate, setPinned]);

  const clear = useCallback(() => setPinned([]), [setPinned]);

  const unpin = useCallback((id: number) => {
    setPinned(pinnedRef.current.filter((p) => p.id !== id));
  }, [setPinned]);

  const togglePinManyMode = useCallback(() => setPinManyMode((m) => !m), []);

  const toggleBuilder = useCallback((item: Item) => {
    hideNow();
    setBuilderItem((prev) => (prev?.id === item.id ? null : item));
  }, [hideNow]);

  const clearBuilder = useCallback(() => setBuilderItem(null), []);

  return (
    <ItemDetails.Provider
      value={{
        show, hide, toggle, clear, unpin, pinnedItems,
        pinManyMode, togglePinManyMode,
        builderItem, toggleBuilder, clearBuilder,
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
