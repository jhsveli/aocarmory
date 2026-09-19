import { useEffect, useState } from "react";
import { useItemDetails } from "./item-details.ts";
import styles from "./CompareToggle.module.css";

/**
 * Arms Compare mode: while active (or while Shift is held), clicking an
 * item name adds it to the right-side panel instead of replacing it, so
 * items show side by side. Highlights while Shift is physically held down,
 * even without a click, so the hotkey's effect is visible ahead of time.
 */
export default function CompareToggle() {
  const { compareMode, toggleCompareMode } = useItemDetails();
  const [shiftHeld, setShiftHeld] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Shift") setShiftHeld(true);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Shift") setShiftHeld(false);
    };
    const onBlur = () => setShiftHeld(false);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  const highlighted = compareMode || shiftHeld;

  return (
    <button
      type="button"
      className={highlighted ? styles.active : styles.compareToggle}
      aria-pressed={highlighted}
      onClick={toggleCompareMode}
      title="Keep clicked items side by side instead of replacing the panel (Shift-click does this too)"
    >
      ⇧ Compare
    </button>
  );
}
