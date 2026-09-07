import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Link } from "react-router-dom";
import { useArmoryData } from "../data";
import { searchArmory } from "../lib/search";
import { slotDisplay } from "../lib/equip";
import ItemName from "../components/ItemName";
import ItemDetailsPanel from "../components/ItemDetailsPanel";
import layoutStyles from "../styles/layout.module.css";
import styles from "./SearchPage.module.css";

export default function SearchPage() {
  const [params] = useSearchParams();
  const q = params.get("q") ?? "";
  const { flatItems } = useArmoryData();
  const results = useMemo(() => (q ? searchArmory(q, flatItems) : []), [q, flatItems]);

  return (
    <div className={layoutStyles.contentWrap}>
      <div className={layoutStyles.content}>
        <h1>Search results</h1>
        {!q && (
          <p className={styles.searchExamples}>
            Type a search in the box at the top: an item, set, location, category or section name,
            or a class tag (<em>sin</em>, <em>hox</em>), slot (<em>hands</em>) or rarity (
            <em>rare</em>). Examples: <em>the+grasslands belt</em>, <em>pillars+of+heaven</em>,{" "}
            <em>hox epic dungeon</em>, <em>tos scarlet+circle epic</em>.
          </p>
        )}
        {q && results.length === 0 && <p>Your search did not match any items.</p>}
        {q && results.length > 0 && (
          <>
            <p className={styles.searchMeta}>
              {results.length} match{results.length === 1 ? "" : "es"} for “
              {q}” (showing up to 300).
            </p>
            <ol className={styles.searchResults}>
              {results.map((r) => {
                const it = r.item.item;
                const slotLabel = slotDisplay(it.stats);
                return (
                  <li key={`${r.item.sectionId}-${it.id}-${it.name}`}>
                    <ItemName item={it} />
                    {slotLabel && <span className="itemSlot"> [{slotLabel}]</span>}
                    {" — "}
                    <Link to={`/s/${r.item.sectionId}`}>{r.item.section}</Link>
                    {r.item.set && (
                      <>
                        {" :: "}
                        <span className="page-intro">{r.item.set}</span>
                      </>
                    )}
                    {r.reasons.length > 0 && (
                      <span className="itemSlot"> ({r.reasons.join(", ")})</span>
                    )}
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </div>
      <aside className={layoutStyles.rightColumn}>
        <ItemDetailsPanel />
      </aside>
    </div>
  );
}
