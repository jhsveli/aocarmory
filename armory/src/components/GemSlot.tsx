import type { GemSlot as GemSlotKind } from "../types";
import styles from "./GemSlot.module.css";

/** Per-socket-type CSS class; colors are defined in GemSlot.module.css. */
const GEM_CLASS: Record<GemSlotKind, string> = {
  Black: styles.gemBlack,
  Blue: styles.gemBlue,
  Green: styles.gemGreen,
  Red: styles.gemRed,
  White: styles.gemWhite,
  Yellow: styles.gemYellow,
  Kuthcheman: styles.gemKuthcheman,
  Onslaught: styles.gemOnslaught,
  "White Hand": styles.gemWhiteHand,
  Hyperborean: styles.gemHyperborean,
  Eldritch: styles.gemEldritch,
  Occult: styles.gemOccult,
  Chaos: styles.gemChaos,
};

interface GemSlotProps {
  slot: GemSlotKind;
}

/** One gem socket: its name rendered over a colored rectangle (the ::after). */
export default function GemSlot({ slot }: GemSlotProps) {
  const cls = [styles.gemSlot, GEM_CLASS[slot] ?? styles.gemSlot].filter(Boolean).join(" ");
  return <span className={cls}>{slot}</span>;
}
