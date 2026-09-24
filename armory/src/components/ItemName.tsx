import type { DragEvent } from "react";
import type { Item } from "../types";
import { RARITY_CLASS } from "../lib/format";
import { useItemDetails } from "./item-details.ts";

interface Props {
  item: Item;
  /** extra class names (e.g. for the builder drag handle) */
  className?: string;
  draggable?: boolean;
  onDragStart?: (e: DragEvent<HTMLAnchorElement>) => void;
  /** Ignore Shift — used on the armor builder, which has no compare-list UI to show it in. */
  compareDisabled?: boolean;
}

/**
 * Rarity-colored item name. Hovering shows a floating tooltip near the
 * cursor; clicking/tapping pins the item in the right-side detail panel
 * (click/tap again to unpin). Shift-click instead adds/removes the item
 * from the compare list (unless compareDisabled).
 */
export default function ItemName({ item, className, draggable, onDragStart, compareDisabled }: Props) {
  const tip = useItemDetails();
  const cls = [
    "itemName",
    item.rarity ? RARITY_CLASS[item.rarity] : "",
    className ?? "",
  ].filter(Boolean).join(" ");

  return (
    <a
      href="#"
      className={cls}
      data-testid="item-name"
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={(e) => {
        e.preventDefault();
        if (!compareDisabled && e.shiftKey) {
          tip.toggleCompare(item);
          return;
        }
        tip.toggle(item);
      }}
      onMouseMove={(e) => tip.show(item, e.clientX, e.clientY)}
      onMouseLeave={tip.hide}
      onFocus={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        tip.show(item, r.left, r.top);
      }}
      onBlur={tip.hide}
    >
      {item.name}
    </a>
  );
}
