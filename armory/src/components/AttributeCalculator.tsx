import { useEffect, useState } from "react";
import {
  ATTRIBUTE_KEYS, ATTRIBUTES, calculateAttribute, type AttributeKey,
} from "../lib/attributes";

interface Props {
  open: boolean;
  onClose: () => void;
}

/** Attribute trickle-down calculator — the site's draggable popup, modernized. */
export default function AttributeCalculator({ open, onClose }: Props) {
  const [attr, setAttr] = useState<AttributeKey>("Constitution");
  const [amount, setAmount] = useState(100);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const result = calculateAttribute(attr, Number.isFinite(amount) ? amount : 0);
  const def = ATTRIBUTES.find((a) => a.key === attr);

  return (
    <div className="calcOverlay" onClick={onClose}>
      <div className="calcCard" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Attribute trickle-down calculator">
        <button className="closeBtn" onClick={onClose} aria-label="Close calculator">✕ close</button>
        <h2 style={{ marginTop: 0 }}>Attribute trickle-down calculator</h2>
        <p className="page-intro">{def?.blurb}</p>
        <form
          className="calcForm"
          onSubmit={(e) => e.preventDefault()}
        >
          <input
            type="number"
            value={amount}
            min={1}
            onChange={(e) => setAmount(Number(e.target.value))}
            aria-label="Attribute amount"
          />
          <select value={attr} onChange={(e) => setAttr(e.target.value as AttributeKey)} aria-label="Attribute">
            {ATTRIBUTE_KEYS.map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        </form>
        <div className="calcResults">
          <table>
            <tbody>
              {result.rows.map((row) => (
                <tr key={row.stat}>
                  <td>
                    {row.stat}
                    {row.note && <span className="page-intro"> ({row.note})</span>}
                  </td>
                  <td>+{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="calcNote">
          Per the officially documented attribute effects (combat revamp). Health from
          Constitution varies roughly 5–8 per point by class; 6.5 is used here.
        </p>
      </div>
    </div>
  );
}
