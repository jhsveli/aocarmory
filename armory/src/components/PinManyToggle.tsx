import { useEffect, useState } from "react";
import { useItemDetails } from "./item-details.ts";
import Button from "./Button.tsx";
import styles from "./PinManyToggle.module.css"

/**
 * Arms Pin-many mode: while active (or while Shift is held), clicking an
 * item name adds it to the pinned items instead of replacing them, so
 * items show side by side. Highlights while Shift is physically held down,
 * even without a click, so the hotkey's effect is visible ahead of time.
 */
export default function PinManyToggle() {
  const { pinManyMode, togglePinManyMode } = useItemDetails();
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

  const highlighted = pinManyMode || shiftHeld;

  return (
      <div className={styles.pinManyOuter}>
        <Button
          pressed={highlighted}
          onClick={togglePinManyMode}
          title="Keep clicked items side by side instead of replacing them (Shift-click does this too)"
        >
          Pin many
        </Button>
        <span>(Shift + Click)</span>
      </div>
  );
}
