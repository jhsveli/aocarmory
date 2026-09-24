import { Link } from "react-router-dom";
import { useItemDetails } from "./item-details.ts";
import styles from "./ItemsToCompareBar.module.css";

/**
 * Left-column staging list built by shift-clicking items. Once it holds at
 * least two, a link opens the dedicated compare page for exactly those
 * items via a URL param — this list itself is left untouched by that.
 */
export default function ItemsToCompareBar() {
  const { itemsToCompare, removeFromCompare } = useItemDetails();

  if (itemsToCompare.length === 0) return null;

  const compareHref = `/compare?items=${itemsToCompare.map((i) => i.id).join(",")}`;

  return (
    <div className={styles.bar} role="group" aria-label="Items to compare">
      <ul className={styles.chips}>
        {itemsToCompare.map((item) => (
          <li key={item.id} className={styles.chip}>
            {item.name}
            <button
              type="button"
              className={styles.chipRemove}
              aria-label={`Remove ${item.name} from comparison`}
              onClick={() => removeFromCompare(item.id)}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      {itemsToCompare.length >= 2 && (
        <Link to={compareHref} className={styles.compareLink}>
          Compare {itemsToCompare.length} items
        </Link>
      )}
    </div>
  );
}
