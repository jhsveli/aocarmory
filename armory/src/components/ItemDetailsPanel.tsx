import { useItemDetails } from "./item-details.ts";
import ItemDetailsBox from "./ItemDetailsBox.tsx";
import styles from "./ItemDetailsPanel.module.css";

/**
 * The docked item-detail panel, rendered in-flow where a page places it
 * (typically the right column). Shows the click-pinned item, plus a
 * placeholder while nothing is pinned. The floating hover tooltip and the
 * shift-click compare list are handled elsewhere.
 */
export default function ItemDetailsPanel() {
  const { panelItem, clear } = useItemDetails();

  return (
    <aside className={styles.itemPanel} aria-label="Item details">
      {!panelItem ? (
        <p className={styles.panelEmpty}>Click an item to see its details.</p>
      ) : (
        <>
          <div className={styles.panelHeader}>
            <button
              type="button"
              className={styles.panelClose}
              aria-label="Close item details"
              onClick={clear}
            >
              ×
            </button>
          </div>
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
      )}
    </aside>
  );
}
