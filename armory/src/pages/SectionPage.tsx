import { Link, useParams, useSearchParams } from "react-router-dom";
import { useArmoryData } from "../data";
import SectionTree from "../components/SectionTree";
import ClassTree from "../components/ClassTree";
import ViewToggle, { type SectionView } from "../components/ViewToggle";
import FilterBar from "../components/FilterBar";
import ItemDetailsPanel from "../components/ItemDetailsPanel";
import { filterSection, type ItemFilters } from "../lib/filters";
import type { Rarity } from "../types";
import layoutStyles from "../styles/layout.module.css";
import styles from "./SectionPage.module.css";
import { useState } from "react";
import PinManyToggle from "../components/PinManyToggle.tsx";

const FILTER_KEYS = ["minRarity", "minLevel", "maxLevel"] as const;

export default function SectionPage() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const view: SectionView = params.get("view") === "class" ? "class" : "location";
  const { sections } = useArmoryData();
  const [filtersVisible, setFiltersVisible] = useState(false)

  const setView = (v: SectionView) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (v === "class") next.set("view", "class");
      else next.delete("view");
      return next;
    }, { replace: true });
  };

  const filters: ItemFilters = {
    minRarity: (params.get("minRarity") as Rarity) ?? undefined,
    minLevel: params.get("minLevel") ? Number(params.get("minLevel")) : undefined,
    maxLevel: params.get("maxLevel") ? Number(params.get("maxLevel")) : undefined,
  };

  const updateFilters = (patch: Partial<ItemFilters>) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [key, value] of Object.entries(patch)) {
        if (value === undefined) next.delete(key);
        else next.set(key, String(value));
      }
      return next;
    }, { replace: true });
  };

  const clearFilters = () => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const key of FILTER_KEYS) next.delete(key);
      return next;
    }, { replace: true });
  };

  const tree = (section: (typeof sections)[number]) => {
    const { section: filtered, hiddenCount } = filterSection(section, filters);
    return (
      <>
        {view === "class" ? <ClassTree section={filtered} /> : <SectionTree section={filtered} />}
        {hiddenCount > 0 && (
          <p className={styles.hiddenNotice}>
            {hiddenCount} item{hiddenCount === 1 ? "" : "s"} hidden by filters.{" "}
            <button type="button" onClick={clearFilters}>Disable filters</button>
          </p>
        )}
      </>
    );
  };

  if (!id || id === "all") {
    return (
      <div className={layoutStyles.contentWrap}>
        <div className={layoutStyles.content}>
          <div className={styles.sectionHead}>
            <h1>All sections</h1>
            <div className={styles.headControls}>
              <ViewToggle view={view} onChange={setView} />
              <PinManyToggle />
              <button className={`${styles.toggleFilters} ${filtersVisible ? styles.active: ''}`} type="button" onClick={() => setFiltersVisible(!filtersVisible)}>Filter</button>
            </div>
          </div>
          {filtersVisible && <FilterBar filters={filters} onChange={updateFilters} />}
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
          <div className={styles.headControls}>
            <ViewToggle view={view} onChange={setView} />
            <PinManyToggle />
            <button className={`${styles.toggleFilters} ${filtersVisible ? styles.active: ''}`} type="button" onClick={() => setFiltersVisible(!filtersVisible)}>Filter</button>
          </div>
        </div>
        {filtersVisible && <FilterBar filters={filters} onChange={updateFilters} />}
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
