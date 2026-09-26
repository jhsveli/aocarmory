import type { ButtonHTMLAttributes } from "react";
import styles from "./Button.module.css";

type Variant =
  /** Toolbar/action button (Add item, Clear all, Open calculator). */
  | "default"
  /** Emphasised action (Copy share link). */
  | "primary"
  /** Square × close/remove button on a card corner. */
  | "icon"
  /** Small outlined caps label (Set main, equip). */
  | "tag"
  /** Inline text link look (Disable filters, remove, Original screenshot). */
  | "link";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  /**
   * Makes it a toggle: sets aria-pressed and the crimson active look
   * (Pin many, Filter, view toggle segments). Leave undefined for plain buttons.
   */
  pressed?: boolean;
}

/**
 * The app's one button. Styling lives in Button.module.css; callers only
 * pass className for placement (position, margins), never for looks.
 */
export default function Button({ variant = "default", pressed, className, type = "button", ...rest }: Props) {
  const cls = [
    styles.button,
    styles[variant],
    pressed ? styles.pressed : "",
    className ?? "",
  ].filter(Boolean).join(" ");

  return <button type={type} className={cls} aria-pressed={pressed} {...rest} />;
}
