import { createContext, useContext } from "react";
import type { Item } from "../types";

interface ItemDetailsApi {
  /** Hover — shows the floating tooltip near the cursor. */
  show: (item: Item, x: number, y: number) => void;
  /** Pointer left the item — hides the floating tooltip. */
  hide: () => void;
  /** Click/tap — pins the item in the right-side panel (click again to unpin). */
  toggle: (item: Item) => void;
  /** Closes the right-side panel. */
  clear: () => void;
  /** The click-pinned item shown in the docked panel, if any. */
  panelItem: Item | null;
  /** Items staged for the dedicated compare page, in the order they were added. */
  itemsToCompare: Item[];
  /** Shift-click — adds/removes an item from itemsToCompare. */
  toggleCompare: (item: Item) => void;
  /** Removes a single item from itemsToCompare (used by its chip's remove button). */
  removeFromCompare: (id: number) => void;
}

export const ItemDetails = createContext<ItemDetailsApi>({
  show: () => {},
  hide: () => {},
  toggle: () => {},
  clear: () => {},
  panelItem: null,
  itemsToCompare: [],
  toggleCompare: () => {},
  removeFromCompare: () => {},
});

export function useItemDetails() {
  return useContext(ItemDetails);
}
