import { createContext, useContext } from "react";
import type { Item } from "../types";

interface ItemDetailsApi {
  /** Hover — shows the floating tooltip near the cursor. */
  show: (item: Item, x: number, y: number) => void;
  /** Pointer left the item — hides the floating tooltip. */
  hide: () => void;
  /**
   * Click/tap — pins the item in the right-side panel.
   * additive (compare mode active, or Shift held) adds/removes the item
   * from the panel instead of replacing it, showing items side by side.
   */
  toggle: (item: Item, additive?: boolean) => void;
  /** Closes the right-side panel entirely. */
  clear: () => void;
  /** Removes a single item from the panel (used by its close button). */
  clearOne: (id: number) => void;
  /** The click-pinned items shown in the docked panel, in click order. */
  panelItems: Item[];
  /** Whether Compare mode is armed — makes plain clicks additive too. */
  compareMode: boolean;
  toggleCompareMode: () => void;
}

export const ItemDetails = createContext<ItemDetailsApi>({
  show: () => {},
  hide: () => {},
  toggle: () => {},
  clear: () => {},
  clearOne: () => {},
  panelItems: [],
  compareMode: false,
  toggleCompareMode: () => {},
});

export function useItemDetails() {
  return useContext(ItemDetails);
}
