import { useItemDetails } from "./item-details.ts";
import styles from "./CompareToggle.module.css";

/**
 * Arms Compare mode: while active (or while Shift is held), clicking an
 * item name adds it to the right-side panel instead of replacing it, so
 * items show side by side.
 */
export default function CompareToggle() {
  const { compareMode, toggleCompareMode } = useItemDetails();
  return (
    <button
      type="button"
      className={compareMode ? styles.active : styles.compareToggle}
      aria-pressed={compareMode}
      onClick={toggleCompareMode}
      title="Keep clicked items side by side instead of replacing the panel (Shift-click does this too)"
    >
      ⇧ Compare
    </button>
  );
}
