import type { Item } from "../types";
import { computeStatDiff } from "../lib/stat-diff";
import styles from "./StatDiffBox.module.css";

interface Props {
  /** the reference item this diff is measured against */
  main: Item;
  /** the item being compared to main */
  item: Item;
}

/** Rounds to 1 decimal (dps is the only fractional stat) and drops a trailing .0. */
function formatNumber(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/** Per-item stat delta vs. the comparison's main item; renders nothing when every stat ties. */
export default function StatDiffBox({ main, item }: Props) {
  const rows = computeStatDiff(main, item);
  if (rows.length === 0) return null;

  return (
    <div className={styles.diffBox}>
      <div className={styles.diffLabel}>Diff vs. {main.name}</div>
      <ul className={styles.diffList}>
        {rows.map((row) => (
          <li key={row.key} className={row.good ? styles.pos : styles.neg}>
            {row.delta > 0 ? "+" : ""}{formatNumber(row.delta)}{row.isPercent ? "%" : ""} {row.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
