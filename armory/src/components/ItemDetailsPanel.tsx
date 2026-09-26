import { Link } from "react-router-dom";
import type { Item } from "../types";
import { useItemDetails } from "./item-details.ts";
import ItemDetailsBox from "./ItemDetailsBox.tsx";
import PinManyToggle from "./PinManyToggle.tsx";
import styles from "./ItemDetailsPanel.module.css";

interface Props {
  /** Show the builder's own single pinned item, without pin-many controls. */
  builder?: boolean;
}

/**
 * The docked item-detail panel, rendered in-flow where a page places it
 * (typically the right column). Shows the pinned items side by side under a
 * header with the Pin-many toggle, Clear all and a link opening them on the
 * Compare page, plus a placeholder while nothing is pinned. The floating
 * hover tooltip is rendered separately by TooltipProvider.
 */
export default function ItemDetailsPanel({ builder }: Props) {
  const { pinnedItems, unpin, clear, builderItem, clearBuilder } = useItemDetails();

  if (builder) {
    return builderItem
      ? <PinnedCard item={builderItem} closeLabel="Close item details" onClose={clearBuilder} />
      : <EmptyCard />;
  }

  const many = pinnedItems.length > 1;
  const compareHref = `/compare?items=${pinnedItems.map((i) => i.id).join(",")}`;

  return (
    <section className={styles.pinnedPanel} aria-label="Pinned items">
      <div className={styles.pinnedHead}>
        {many && (
          <>
            <button type="button" className={styles.clearAll} onClick={clear}>
              Clear all
            </button>
            <Link to={compareHref} className={styles.compareLink}>
              Compare {pinnedItems.length} items
            </Link>
          </>
        )}
      </div>
      {pinnedItems.length === 0 ? (
        <EmptyCard />
      ) : (
        <div className={styles.pinnedRow}>
          {pinnedItems.map((item) => (
            <PinnedCard
              key={item.id}
              item={item}
              closeLabel={many ? `Unpin ${item.name}` : "Close item details"}
              onClose={() => unpin(item.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function EmptyCard() {
  return (
    <aside className={styles.itemPanel} aria-label="Item details">
      <p className={styles.panelEmpty}>Click an item to see its details.</p>
    </aside>
  );
}

function PinnedCard({ item, closeLabel, onClose }: { item: Item; closeLabel: string; onClose: () => void }) {
  return (
    <aside className={styles.itemPanel} aria-label="Item details">
      <div className={styles.panelHeader}>
        <button type="button" className={styles.panelClose} aria-label={closeLabel} onClick={onClose}>
          ×
        </button>
      </div>
      <ItemDetailsBox item={item} className={styles.inPanel} />
      {item.image && (
        <div className={styles.panelImage}>
          <div className={styles.panelImageLabel}>Original screenshot</div>
          <img
            src={item.image}
            alt={`Original screenshot: ${item.name}`}
            loading="lazy"
            decoding="async"
          />
        </div>
      )}
    </aside>
  );
}
