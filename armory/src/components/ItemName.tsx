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
}

/**
 * Rarity-colored item name. Hovering (or focusing) previews the item in the
 * right-side detail panel; clicking/tapping pins it there — click/tap again
 * to unpin.
 */
export default function ItemName({ item, className, draggable, onDragStart }: Props) {
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
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={(e) => {
        e.preventDefault();
        tip.toggle(item);
      }}
      onMouseEnter={() => tip.show(item)}
      onMouseLeave={tip.hide}
      onFocus={() => tip.show(item)}
      onBlur={tip.hide}
    >
      {item.name}
    </a>
  );
}
