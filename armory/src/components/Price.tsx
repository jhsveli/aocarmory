import type { Price } from "../types";
import { COIN_TITLES, coinSrc, hasPrice } from "../lib/format";

/** Renders a price using the original coin icons (mark/trophy/gold). */
export default function Price({ price }: { price: Price | null }) {
  if (!price || !hasPrice(price)) return null;
  const parts: Array<[keyof Price, number]> = [];
  if (price.mark > 0) parts.push(["mark", price.mark]);
  if (price.trophy > 0) parts.push(["trophy", price.trophy]);
  if (price.gold > 0) parts.push(["gold", price.gold]);
  if (price.silver > 0) parts.push(["silver", price.silver]);
  return (
    <span className="itemPrice">
      {parts.map(([kind, amount]) => (
        <span key={kind}>
          <img
            className="coin"
            src={coinSrc(kind)}
            alt={COIN_TITLES[kind]}
            title={COIN_TITLES[kind]}
            height="12"
            width="12"
          />
          {amount}
        </span>
      ))}
    </span>
  );
}
