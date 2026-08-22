import { createContext, useContext } from "react";
import type { Item } from "../types";

interface ItemDetailsApi {
  /** Hover — shows the floating tooltip near the cursor. */
  show: (item: Item, x: number, y: number) => void;
  /** Pointer left the item — hides the floating tooltip. */
  hide: () => void;
  /** Click/tap — pins the item in the right-side panel (click/tap again to unpin). */
  toggle: (item: Item) => void;
  /** Closes the right-side panel. */
  clear: () => void;
  /** The click-pinned item shown in the docked panel (null when empty). */
  panelItem: Item | null;
}

export const ItemDetails = createContext<ItemDetailsApi>({
  show: () => {},
  hide: () => {},
  toggle: () => {},
  clear: () => {},
  panelItem: null,
});

export function useItemDetails() {
  return useContext(ItemDetails);
}
