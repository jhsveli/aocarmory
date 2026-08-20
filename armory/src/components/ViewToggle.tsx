export type SectionView = "location" | "class";

interface Props {
  view: SectionView;
  onChange: (view: SectionView) => void;
}

/** Segmented control switching between the drop-location and class-usability views. */
export default function ViewToggle({ view, onChange }: Props) {
  return (
    <div className="viewToggle" role="group" aria-label="Section view">
      <button
        type="button"
        className={view === "location" ? "active" : ""}
        aria-pressed={view === "location"}
        onClick={() => onChange("location")}
      >
        By drop / location
      </button>
      <button
        type="button"
        className={view === "class" ? "active" : ""}
        aria-pressed={view === "class"}
        onClick={() => onChange("class")}
      >
        By class
      </button>
    </div>
  );
}
