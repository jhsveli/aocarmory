import { createContext, useContext } from "react";
import type { Item } from "../types";

interface TooltipApi {
  /** Hover preview — the panel shows this item until the pointer leaves. */
  show: (item: Item) => void;
  /** Pointer left the item/panel — clears the preview unless the item is pinned. */
  hide: () => void;
  /** Click/tap — pins the item in the panel (click/tap again to unpin). */
  toggle: (item: Item) => void;
  /** Closes the panel entirely (pinned or not). */
  clear: () => void;
}

export const ItemDetails = createContext<TooltipApi>({
  show: () => {},
  hide: () => {},
  toggle: () => {},
  clear: () => {},
});

export function useItemDetails() {
  return useContext(ItemDetails);
}
