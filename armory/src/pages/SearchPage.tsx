import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Link } from "react-router-dom";
import { searchArmory } from "../lib/search";
import ItemName from "../components/ItemName";
import { SLOT_LABEL } from "../lib/format";

export default function SearchPage() {
  const [params] = useSearchParams();
  const q = params.get("q") ?? "";
  const results = useMemo(() => (q ? searchArmory(q) : []), [q]);

  return (
    <div className="content">
      <h1>Search results</h1>
      {!q && (
        <p className="searchExamples">
          Type a search in the box at the top: an item, set, location, category or section name,
          or a class tag (<em>sin</em>, <em>hox</em>), slot (<em>hands</em>) or rarity (
          <em>rare</em>). Examples: <em>the+grasslands belt</em>, <em>pillars+of+heaven</em>,{" "}
          <em>hox epic dungeon</em>, <em>tos scarlet+circle epic</em>.
        </p>
      )}
      {q && results.length === 0 && (
        <p>Your search did not match any items.</p>
      )}
      {q && results.length > 0 && (
        <>
          <p className="searchMeta">
            {results.length} match{results.length === 1 ? "" : "es"} for “
            {q}” (showing up to 300).
          </p>
          <ol className="searchResults">
            {results.map((r) => {
              const it = r.item.item;
              return (
                <li key={`${r.item.sectionId}-${it.id}-${it.name}`}>
                  <ItemName item={it} />
                  {it.slot && <span className="itemSlot"> [{SLOT_LABEL[it.slot] ?? it.slot}]</span>}
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
  );
}
