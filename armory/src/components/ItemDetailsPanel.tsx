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
  const { panelItem } = useItemDetails();

  return (
      <aside className={styles.mainAside}>
        <aside className={styles.itemPanel} aria-label="Item details">
          {panelItem ? (
            <>
              <ItemDetailsBox item={panelItem} className={styles.inPanel} />
            </>
          ) : null}
        </aside>

          {panelItem?.image && (
            <aside className={styles.itemPanel}>
              <div className={styles.panelImage}>
                  <div className={styles.panelImageLabel}>Original screenshot</div>
                  <img
                      src={panelItem.image}
                      alt={`Original screenshot: ${panelItem.name}`}
                      loading="lazy"
                      decoding="async"
                  />
              </div>
            </aside>
          )}
      </aside>
  );
}
