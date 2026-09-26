import styles from "./ViewToggle.module.css";
import Button from "./Button.tsx";

export type SectionView = "location" | "class";

interface Props {
  view: SectionView;
  onChange: (view: SectionView) => void;
}

/** Segmented control switching between the drop-location and class-usability views. */
export default function ViewToggle({ view, onChange }: Props) {
  return (
    <div className={styles.viewToggle} role="group" aria-label="Section view">
      <Button pressed={view === "location"} onClick={() => onChange("location")}>
        By drop / location
      </Button>
      <Button pressed={view === "class"} onClick={() => onChange("class")}>
        By class
      </Button>
    </div>
  );
}
