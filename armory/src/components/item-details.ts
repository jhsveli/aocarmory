import { createContext, useContext } from "react";
import type { Item } from "../types";

interface ItemDetailsApi {
  /** Hover — shows the floating tooltip near the cursor. */
  show: (item: Item, x: number, y: number) => void;
  /** Pointer left the item — hides the floating tooltip. */
  hide: () => void;
  /**
   * Click/tap — pins the item in the right-side panel.
   * additive (Pin-many mode, or Shift held) adds/removes it from the pinned
   * items; otherwise it replaces them (click the lone pinned item to unpin).
   * Replacing 2+ pinned items adds a history entry, so Back undoes it.
   */
  toggle: (item: Item, additive?: boolean) => void;
  /** Unpins everything. */
  clear: () => void;
  /** Unpins a single item (used by its close button). */
  unpin: (id: number) => void;
  /** Pinned items shown side by side in the docked panel, in click order. */
  pinnedItems: Item[];
  /** Whether Pin-many mode is armed — makes plain clicks additive too. */
  pinManyMode: boolean;
  togglePinManyMode: () => void;
  /** The armor builder's own single pinned item, separate from pinnedItems. */
  builderItem: Item | null;
  /** Click/tap on the builder — pins/unpins builderItem. */
  toggleBuilder: (item: Item) => void;
  clearBuilder: () => void;
}

export const ItemDetails = createContext<ItemDetailsApi>({
  show: () => {},
  hide: () => {},
  toggle: () => {},
  clear: () => {},
  unpin: () => {},
  pinnedItems: [],
  pinManyMode: false,
  togglePinManyMode: () => {},
  builderItem: null,
  toggleBuilder: () => {},
  clearBuilder: () => {},
});

export function useItemDetails() {
  return useContext(ItemDetails);
}
