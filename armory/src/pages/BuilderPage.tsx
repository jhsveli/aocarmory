import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { DragEvent } from "react";
import type { Item } from "../types";
import { flatItems } from "../data";
import { SLOT_LABEL } from "../lib/format";
import { searchArmory } from "../lib/search";
import { decodeBuilder, encodeBuilder } from "../lib/builder";
import ItemName from "../components/ItemName";
import ItemDetailsBox from "../components/ItemDetailsBox.tsx";
import ItemDetailsPanel from "../components/ItemDetailsPanel";
import AttributeCalculator from "../components/AttributeCalculator";
import layoutStyles from "../styles/layout.module.css";
import styles from "./BuilderPage.module.css";

/** The builder slot grid (mirrors the original site's draggable slot groups). */
const SLOT_GROUPS: Array<{ group: string; slots: string[] }> = [
  { group: "Armor", slots: ["head", "shoulder", "chest", "hands", "belt", "legs", "feet", "wrist"] },
  { group: "Accessories", slots: ["back", "necklace", "ring1", "ring2"] },
  {
    group: "Weapons",
    slots: ["1hb", "1he", "1heranger", "2hb", "2he", "bow", "crossbow", "dagger", "talisman", "polearm", "staff", "shield", "ammunition"],
  },
];

/** Choose a builder slot key for an item. Rings get the first free ring slot. */
function slotKeyFor(item: Item, prev: Record<string, Item>): string | null {
  if (!item.slot) return null;
  if (item.slot === "ring") {
    if (!prev.ring1) return "ring1";
    if (!prev.ring2) return "ring2";
    return "ring2"; // replace the second ring
  }
  return item.slot;
}

export default function BuilderPage() {
  const [params] = useSearchParams();
  const [equipped, setEquipped] = useState<Record<string, Item>>({});
  const [query, setQuery] = useState("");
  const [calcOpen, setCalcOpen] = useState(params.get("calc") === "1");
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const loaded = useRef(false);

  // Load a set from the ?ab= param (original site's zlib+base64 encoding).
  useEffect(() => {
    if (loaded.current) return;
    const ab = params.get("ab");
    if (!ab) return;
    loaded.current = true;
    (async () => {
      const pairs = await decodeBuilder(ab);
      const next: Record<string, Item> = {};
      for (const p of pairs) {
        const item = flatItems.find((f) => f.item.id === p.itemId)?.item;
        if (!item) continue;
        const key = slotKeyFor(item, next);
        if (key) next[key] = item;
      }
      setEquipped(next);
    })();
  }, [params]);

  const results = useMemo(() => (query.trim() ? searchArmory(query) : []), [query]);

  const equip = useCallback((item: Item) => {
    setEquipped((prev) => {
      const key = slotKeyFor(item, prev);
      if (!key) return prev;
      return { ...prev, [key]: item };
    });
  }, []);

  const unequip = useCallback((key: string) => {
    setEquipped((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    setDragOver(null);
    const id = e.dataTransfer.getData("text/item-id");
    if (!id) return;
    const item = flatItems.find((f) => String(f.item.id) === id)?.item;
    if (item) equip(item);
  }, [equip]);

  async function share() {
    const pairs: Array<[string, number]> = Object.entries(equipped)
      .map(([slot, item]) => [slot, item.id] as [string, number])
      .sort((a, b) => a[0].localeCompare(b[0]));
    const ab = await encodeBuilder(pairs);
    const url = new URL(window.location.href);
    url.search = "";
    url.searchParams.set("ab", ab);
    window.history.replaceState(null, "", url.toString());
    await navigator.clipboard.writeText(url.toString()).catch(() => {});
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  const totalEquipped = Object.keys(equipped).length;

  return (
    <div className={layoutStyles.content}>
      <div className={styles.builderHead}>
        <h1>Armor builder</h1>
        <div className={styles.builderHeadBtns}>
          <button className={styles.builderBtn} onClick={() => setCalcOpen(true)}>
            Attribute calculator
          </button>
          <button
            className={`${styles.builderBtn} ${styles.primary}`}
            onClick={share}
            disabled={totalEquipped === 0}
          >
            {copied ? "Link copied!" : "Copy share link"}
          </button>
        </div>
      </div>
      <p className="page-intro">
        Drag items from the search list into the slots, or click <em>equip</em>. The share link
        uses the original site's format, so it works with the classic armory too.
      </p>

      <div className={styles.builderLayout}>
        <div className={styles.builderSide}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find items to equip..."
          />
          <ul className={styles.builderSearchList} style={{ listStyle: "none", paddingLeft: 0 }}>
            {results.map((r) => {
              const it = r.item.item;
              return (
                <li key={`${it.id}-${it.name}`}>
                  <ItemName
                    item={it}
                    className={styles.searchItem}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/item-id", String(it.id));
                      e.dataTransfer.setData("text/plain", it.name ?? "");
                    }}
                  />
                  {it.slot && <span className="itemSlot"> [{SLOT_LABEL[it.slot] ?? it.slot}]</span>}
                  <button className={styles.equipMini} onClick={() => equip(it)} title={`Equip ${it.name}`}>
                    equip
                  </button>
                </li>
              );
            })}
            {query.trim() !== "" && results.length === 0 && (
              <li className="page-intro">No matches.</li>
            )}
            {query.trim() === "" && (
              <li className="page-intro">Search by name, slot, class or rarity above.</li>
            )}
          </ul>
          <ItemDetailsPanel />
        </div>

        <div>
          {SLOT_GROUPS.map((g) => (
            <div key={g.group} style={{ marginBottom: "0.8rem" }}>
              <h2 style={{ fontSize: "1rem", margin: "0.4rem 0" }}>{g.group}</h2>
              <div className={styles.slotGrid}>
                {g.slots.map((slotKey) => {
                  const item = equipped[slotKey];
                  const label = slotKey.startsWith("ring")
                    ? (slotKey === "ring1" ? "Ring I" : "Ring II")
                    : SLOT_LABEL[slotKey] ?? slotKey;
                  return (
                    <div
                      key={slotKey}
                      className={`${styles.slotCell}${dragOver === slotKey ? ` ${styles.dropHover}` : ""}`}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOver(slotKey);
                      }}
                      onDragLeave={() => setDragOver((s) => (s === slotKey ? null : s))}
                      onDrop={handleDrop}
                    >
                      <span className={styles.slotName}>{label}</span>
                      {item ? (
                        <>
                          <div className={styles.equipped}>
                            <ItemDetailsBox item={item} compact />
                          </div>
                          <div className={styles.equippedName}>
                            <ItemName item={item} />
                          </div>
                          <button className={styles.removeBtn} onClick={() => unequip(slotKey)}>
                            remove
                          </button>
                        </>
                      ) : (
                        <span className={`page-intro ${styles.emptySlot}`}>empty</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <AttributeCalculator open={calcOpen} onClose={() => setCalcOpen(false)} />
    </div>
  );
}
