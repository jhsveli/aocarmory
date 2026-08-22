import type { Category, Location, Section, Set } from "../types";
import { SLOT_LABEL } from "../lib/format";
import { IMG_BASE } from "../lib/format";
import Collapsible from "./Collapsible";
import ItemName from "./ItemName";
import Price from "./Price";
import styles from "./SectionTree.module.css";

/** The full Section -> Location -> Category -> Set -> Item browsing tree. */
export default function SectionTree({ section }: { section: Section }) {
  if (!section.locations.length) {
    return <p className="page-intro">This section has no item listings in the archived data.</p>;
  }
  return (
    <ul className="locations">
      {section.locations.map((loc, i) => (
        <LocationNode key={`${loc.name}-${i}`} loc={loc} />
      ))}
    </ul>
  );
}

function LocationNode({ loc }: { loc: Location }) {
  return (
    <Collapsible
      className={loc.type ? styles[loc.type] : undefined}
      label={
        <>
          <strong>{loc.name ?? "Unknown location"}</strong>
          {loc.coords && <span className="page-intro"> ({loc.coords})</span>}
        </>
      }
    >
      <ul className={styles.categories}>
        {loc.categories.map((cat, i) => (
          <CategoryNode key={`${cat.name}-${i}`} cat={cat} />
        ))}
      </ul>
    </Collapsible>
  );
}

function CategoryNode({ cat }: { cat: Category }) {
  if (!cat.sets.length) {
    return (
      <li>
        <span className="nodeLabel">{cat.name}</span>
        <div className="children">
          <p className="page-intro">No sets listed.</p>
        </div>
      </li>
    );
  }
  return (
    <Collapsible label={cat.name}>
      <ul className="sets">
        {cat.sets.map((set, i) => (
          <SetNode key={`${set.name}-${i}`} set={set} />
        ))}
      </ul>
    </Collapsible>
  );
}

function SetNode({ set }: { set: Set }) {
  return (
    <Collapsible defaultOpen={false} label={<SetLabel set={set} />}>
      <SetItems set={set} />
    </Collapsible>
  );
}

/** The item list of a set (prices, drop locations, rarity-colored names, slots). */
export function SetItems({ set }: { set: Set }) {
  return (
    <ul className={styles.items}>
      {set.items.map((item) => (
        <li key={`${item.id}-${item.name}`}>
          <Price price={item.price} />
          {item.drop && <span className="itemSlot"> {item.drop} — </span>}
          <ItemName item={item} />
          {item.slot && <span className="itemSlot"> [{SLOT_LABEL[item.slot] ?? item.slot}]</span>}
        </li>
      ))}
    </ul>
  );
}

export function SetLabel({ set }: { set: Set }) {
  return (
    <>
      {set.name}
      {set.classes.length > 0 && (
        <span className="setClasses"> [{set.classes.join("/")}]</span>
      )}
      {set.builder && (
        <a
          className={styles.builderLink}
          href={`/builder?ab=${set.builder}`}
          title="Open in Armor builder"
        >
          <img src={`${IMG_BASE}/img/12-em-link.png`} width="16" height="12" alt="Open in Armor builder" />
        </a>
      )}
    </>
  );
}
