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
  /** Pins into the builder's own single-item panel instead; Shift is ignored. */
  builderPin?: boolean;
}

/**
 * Rarity-colored item name. Hovering shows a floating tooltip near the
 * cursor; clicking/tapping pins the item in the right-side detail panel
 * (click/tap again to unpin). Shift-click, or any click in Pin-many mode,
 * adds/removes it from the pinned items instead of replacing them.
 */
export default function ItemName({ item, className, draggable, onDragStart, builderPin }: Props) {
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
        if (builderPin) tip.toggleBuilder(item);
        else tip.toggle(item, tip.pinManyMode || e.shiftKey);
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
