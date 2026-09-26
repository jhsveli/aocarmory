import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useArmoryData } from "../data";
import ItemDetailsBox from "../components/ItemDetailsBox.tsx";
import Button from "../components/Button.tsx";
import StatDiffBox from "../components/StatDiffBox.tsx";
import AddCompareItemPicker from "../components/AddCompareItemPicker.tsx";
import type { Item } from "../types";
import layoutStyles from "../styles/layout.module.css";
import styles from "./ComparePage.module.css";

function parseIds(raw: string | null): number[] {
  if (!raw) return [];
  return raw.split(",").map(Number).filter(Number.isFinite);
}

/**
 * The item each position diffs against: with exactly 2 items they diff
 * against each other; with more, item 0 is the implicit main (first in the
 * ?items= param order) and has no partner of its own.
 */
function diffPartner(items: Item[], index: number): Item | undefined {
  if (items.length < 2) return undefined;
  if (items.length === 2) return items[index === 0 ? 1 : 0];
  return index === 0 ? undefined : items[0];
}

/** One compared item, with its screenshot collapsed behind a link until requested. */
function CompareItem({
  item, onRemove, onMakeMain, diffAgainst, isMain,
}: {
  item: Item;
  onRemove: (id: number) => void;
  /** Set when this item can become the main (3+ items, not already main). */
  onMakeMain?: (id: number) => void;
  diffAgainst?: Item;
  isMain?: boolean;
}) {
  const [showScreenshot, setShowScreenshot] = useState(false);

  return (
    <div className={styles.compareItem}>
      <Button
        variant="icon"
        className={styles.remove}
        aria-label={`Remove ${item.name} from comparison`}
        onClick={() => onRemove(item.id)}
      >
        ×
      </Button>
      {onMakeMain && (
        <Button
          variant="tag"
          className={styles.makeMain}
          aria-label={`Make ${item.name} the main item`}
          onClick={() => onMakeMain(item.id)}
        >
          Set main
        </Button>
      )}
      {isMain && <span className={styles.mainBadge}>Main</span>}
      <ItemDetailsBox item={item} diffTarget={diffAgainst} />
      {item.image && (
        showScreenshot ? (
          <div className={styles.itemImage}>
            <div className={styles.itemImageLabel}>Original screenshot</div>
            <img
              src={item.image}
              alt={`Original screenshot: ${item.name}`}
              loading="lazy"
              decoding="async"
            />
          </div>
        ) : (
          <Button variant="link" className={styles.screenshotLink} onClick={() => setShowScreenshot(true)}>
            Original screenshot
          </Button>
        )
      )}
    </div>
  );
}

/**
 * Full-width side-by-side comparison, driven entirely by the ?items= URL
 * param (not the pinned items) so the link is shareable and
 * survives a refresh. Unresolvable ids are dropped silently.
 */
export default function ComparePage() {
  const [params, setParams] = useSearchParams();
  const { itemById } = useArmoryData();
  const ids = parseIds(params.get("items"));
  const items = useMemo(
    () => ids.map((id) => itemById.get(id)).filter((item): item is NonNullable<typeof item> => Boolean(item)),
    [ids, itemById],
  );

  const remove = (id: number) => {
    const remaining = ids.filter((i) => i !== id);
    setParams(remaining.length ? { items: remaining.join(",") } : {}, { replace: true });
  };

  // moves the item to the front; the old main shifts to 2nd, the rest keep order
  const makeMain = (id: number) => {
    setParams({ items: [id, ...ids.filter((i) => i !== id)].join(",") }, { replace: true });
  };

  const [addOpen, setAddOpen] = useState(false);

  const add = (item: Item) => {
    setParams({ items: [...items.map((i) => i.id), item.id].join(",") }, { replace: true });
    setAddOpen(false);
  };

  const excludeIds = useMemo(() => new Set(items.map((i) => i.id)), [items]);

  return (
    <div className={layoutStyles.contentWrap}>
      <div className={layoutStyles.content}>
        <div className={styles.pageHead}>
          <h1>Compare items</h1>
          <Button onClick={() => setAddOpen((o) => !o)}>
            {addOpen ? "Cancel" : "Add item to compare"}
          </Button>
        </div>
        {items.length === 0 && !addOpen && (
          <p className="page-intro">
            Shift-click items on a section or search page, or use the Add item button above, to
            start a comparison. <Link to="/search">Search for items</Link>.
          </p>
        )}
        <div className={styles.compareRow}>
          {items.map((item, index) => (
            <CompareItem
              key={item.id}
              item={item}
              onRemove={remove}
              onMakeMain={items.length > 2 && index > 0 ? makeMain : undefined}
              diffAgainst={diffPartner(items, index)}
              isMain={items.length > 2 && index === 0}
            />
          ))}
          {addOpen && (
            <AddCompareItemPicker mainItem={items[0]} excludeIds={excludeIds} onAdd={add} />
          )}
        </div>
      </div>
    </div>
  );
}
