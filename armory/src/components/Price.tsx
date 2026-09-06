import type { Price } from "../types";
import { COIN_TITLES, coinSrc, hasPrice } from "../lib/format";
import styles from "./Price.module.css";

/** Renders a price using the original coin icons for each stored currency. */
export default function Price({ price }: { price: Price | null }) {
  if (!price || !hasPrice(price)) return null;

  return (
    <span className={styles.itemPrice}>
      {(Object.keys(price) as Array<keyof typeof Price>).map((currency) => {
        const amount = price[currency];
        return (
          <span key={currency}>
            <img
              className={styles.coin}
              src={coinSrc(currency)}
              alt={COIN_TITLES[currency] ?? currency}
              title={COIN_TITLES[currency] ?? currency}
              height="12"
              width="12"
            />
            {amount}
          </span>
        );
      })}
    </span>
  );
}
