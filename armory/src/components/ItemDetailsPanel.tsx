import { useItemDetails } from "./item-details.ts";
import ItemDetailsBox from "./ItemDetailsBox.tsx";
import styles from "./ItemDetailsPanel.module.css";

/**
 * The docked item-detail panel, rendered in-flow where a page places it
 * (typically the right column). Shows the click-pinned item's stats; a
 * placeholder while nothing is pinned. The floating hover tooltip is rendered
 * separately by TooltipProvider.
 */
export default function ItemDetailsPanel() {
  const { panelItem, clear } = useItemDetails();

  return (
    <aside className={styles.itemPanel} aria-label="Item details">
      <div className={styles.panelHeader}>
        <span className={styles.panelTitle}>Item details</span>
        {panelItem && (
          <button
            type="button"
            className={styles.panelClose}
            onClick={clear}
            aria-label="Close item details"
          >
            ✕
          </button>
        )}
      </div>
      {panelItem ? (
        <>
          <ItemDetailsBox item={panelItem} className={styles.inPanel} />
          {panelItem.image && (
            <div className={styles.panelImage}>
              <div className={styles.panelImageLabel}>Original screenshot</div>
              <img
                src={panelItem.image}
                alt={`Original screenshot: ${panelItem.name}`}
                loading="lazy"
                decoding="async"
              />
            </div>
          )}
        </>
      ) : (
        <div className={styles.panelEmpty}>Click an item to view its details.</div>
      )}
    </aside>
  );
}
