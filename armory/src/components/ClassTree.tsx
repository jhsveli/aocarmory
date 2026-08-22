import type { Section } from "../types";
import { groupSectionByClass, NO_CLASS_TAG } from "../lib/classView";
import Collapsible from "./Collapsible";
import { SetItems, SetLabel } from "./SectionTree";
import styles from "./ClassTree.module.css";

/**
 * Class-usability view of a section: Section -> Class tag -> Set -> Item.
 * Sets keep their category and drop-location as context labels.
 */
export default function ClassTree({ section }: { section: Section }) {
  const groups = groupSectionByClass(section);

  if (groups.length === 0) {
    return <p className="page-intro">This section has no item listings in the archived data.</p>;
  }

  return (
    <>
      <p className="page-intro">
        Grouped by the original set class tags — e.g. [Demo/Necro] is usable by both classes.
      </p>
      <ul className="locations">
        {groups.map((g) => (
          <Collapsible
            key={g.tag}
            className={g.tag === NO_CLASS_TAG ? "" : "classGroup"}
            label={
              <>
                <strong>{g.tag}</strong>
                {g.fullNames.length > 0 && (
                  <span className="setClasses"> — {g.fullNames.join(" / ")}</span>
                )}
              </>
            }
          >
            <ul className="sets">
              {g.sets.map((entry, i) => (
                <Collapsible
                  key={`${entry.set.name}-${i}`}
                  defaultOpen={false}
                  label={
                    <>
                      <SetLabel set={entry.set} />
                      <span className={styles.setContext}>
                        {" "}
                        {[entry.category, entry.location].filter(Boolean).join(" · ")}
                      </span>
                    </>
                  }
                >
                  <SetItems set={entry.set} />
                </Collapsible>
              ))}
            </ul>
          </Collapsible>
        ))}
      </ul>
    </>
  );
}
