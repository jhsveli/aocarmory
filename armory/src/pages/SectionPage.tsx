import { Link, useParams, useSearchParams } from "react-router-dom";
import { useArmoryData } from "../data";
import SectionTree from "../components/SectionTree";
import ClassTree from "../components/ClassTree";
import ViewToggle, { type SectionView } from "../components/ViewToggle";
import ItemDetailsPanel from "../components/ItemDetailsPanel";
import layoutStyles from "../styles/layout.module.css";
import styles from "./SectionPage.module.css";

export default function SectionPage() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const view: SectionView = params.get("view") === "class" ? "class" : "location";
  const { sections } = useArmoryData();

  const setView = (v: SectionView) => {
    setParams(v === "class" ? { view: "class" } : {}, { replace: true });
  };

  const tree = (section: (typeof sections)[number]) =>
    view === "class" ? <ClassTree section={section} /> : <SectionTree section={section} />;

  if (!id || id === "all") {
    return (
      <div className={layoutStyles.contentWrap}>
        <div className={layoutStyles.content}>
          <div className={styles.sectionHead}>
            <h1>All sections</h1>
            <ViewToggle view={view} onChange={setView} />
          </div>
          {sections.map((s) => (
            <div key={s.id} style={{ marginBottom: "1.2rem" }}>
              <h2>
                <Link to={`/s/${s.id}`}>{s.name}</Link>
              </h2>
              {tree(s)}
            </div>
          ))}
        </div>
        <aside className={layoutStyles.rightColumn}>
          <ItemDetailsPanel />
        </aside>
      </div>
    );
  }

  const section = sections.find((s) => String(s.id) === id);
  if (!section) {
    return (
      <div className={layoutStyles.content}>
        <h1>Unknown section</h1>
        <p>No section with id {id}.</p>
      </div>
    );
  }

  return (
    <div className={layoutStyles.contentWrap}>
      <div className={layoutStyles.content}>
        <div className={styles.sectionHead}>
          <h1>{section.name}</h1>
          <ViewToggle view={view} onChange={setView} />
        </div>
        <p className="page-intro">
          {section.locations.length} location{section.locations.length === 1 ? "" : "s"} in
          this section.
        </p>
        {tree(section)}
      </div>
      <aside className={layoutStyles.rightColumn}>
        <ItemDetailsPanel />
      </aside>
    </div>
  );
}
