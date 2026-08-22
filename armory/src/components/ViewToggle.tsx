import styles from "./ViewToggle.module.css";

export type SectionView = "location" | "class";

interface Props {
  view: SectionView;
  onChange: (view: SectionView) => void;
}

/** Segmented control switching between the drop-location and class-usability views. */
export default function ViewToggle({ view, onChange }: Props) {
  return (
    <div className={styles.viewToggle} role="group" aria-label="Section view">
      <button
        type="button"
        className={view === "location" ? styles.active : undefined}
        aria-pressed={view === "location"}
        onClick={() => onChange("location")}
      >
        By drop / location
      </button>
      <button
        type="button"
        className={view === "class" ? styles.active : undefined}
        aria-pressed={view === "class"}
        onClick={() => onChange("class")}
      >
        By class
      </button>
    </div>
  );
}
