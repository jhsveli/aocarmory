import type { PercentValue } from "../types";
import { statLabel } from "../lib/stat-labels";
import styles from "./StatLine.module.css";

interface StatLineProps {
  /** normalized stat property name (see lib/stat-labels) */
  name: string;
  value: number | PercentValue;
  /** prefix non-negative values with "+" (attribute-style bonuses) */
  signed?: boolean;
}

/**
 * One numeric stat line: the (styled) value followed by its label, e.g.
 * "512 Armor" or "+42 Strength". Percent values render with a trailing "%".
 */
export default function StatLine({ name, value, signed = false }: StatLineProps) {
  const num = typeof value === "object"
    ? `${value.percent >= 0 && signed ? "+" : ""}${value.percent}%`
    : `${value >= 0 && signed ? "+" : ""}${value}`;
  return typeof value === "object" ? (
    <>
      <span className={`${styles.num} ${value.percent < 0 ? styles.neg: styles.pos}`}>{num}</span> {statLabel(name)}
    </>
  ) : (
      <>
        <span className={`${styles.num} ${value < 0 ? styles.neg: styles.pos}`}>{num}</span> {statLabel(name)}
      </>
  );
}
