import { useItemDetails } from "./item-details.ts";
import ItemDetailsBox from "./ItemDetailsBox.tsx";
import styles from "./ItemDetailsPanel.module.css";

/**
 * The docked item-detail panel, rendered in-flow where a page places it
 * (typically the right column). Shows the click-pinned item(s) side by side
 * — Compare mode (or Shift-click) pins more than one at a time — plus a
 * placeholder while nothing is pinned. The floating hover tooltip is
 * rendered separately by TooltipProvider.
 */
export default function ItemDetailsPanel() {
  const { panelItems, compareMode, toggleCompareMode, clearOne } = useItemDetails();
  const comparing = panelItems.length > 1;

  return (
    <aside className={styles.mainAside}>
      <div className={styles.toolbar}>
        <button
          type="button"
          className={compareMode ? styles.compareActive : styles.compareBtn}
          aria-pressed={compareMode}
          onClick={toggleCompareMode}
          title="Keep clicked items side by side instead of replacing the panel (Shift-click does this too)"
        >
          Compare
        </button>
      </div>

      {panelItems.length === 0 ? (
        <aside className={styles.itemPanel} aria-label="Item details">
          <p className={styles.panelEmpty}>Click an item to see its details.</p>
        </aside>
      ) : (
        <div className={styles.compareRow}>
          {panelItems.map((item) => (
            <aside key={item.id} className={styles.itemPanel} aria-label="Item details">
              <div className={styles.panelHeader}>
                <button
                  type="button"
                  className={styles.panelClose}
                  aria-label={comparing ? `Remove ${item.name} from comparison` : "Close item details"}
                  onClick={() => clearOne(item.id)}
                >
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
          ))}
        </div>
      )}
    </aside>
  );
}
