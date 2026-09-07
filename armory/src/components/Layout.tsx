import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useArmoryData } from "../data";
import styles from "./Layout.module.css";

export default function Layout() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const { sectionGroups } = useArmoryData();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const query = q.trim();
    if (query) navigate(`/search?q=${encodeURIComponent(query)}`);
  }

  return (
    <div>
      <div className={styles.page}>
        <div className={styles.topmenu}>
          <ul className={styles.mainmenu}>
            <li><NavLink to="/" end>Home</NavLink></li>
            <li><NavLink to="/sets">Armor Sets</NavLink></li>
            <li><NavLink to="/factions">Factions</NavLink></li>
            <li><NavLink to="/builder">Armor builder</NavLink></li>
          </ul>
          <form className={styles.searchForm} onSubmit={submit}>
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search items, sets, classes..."
              maxLength={128}
            />
            <input type="submit" value="SEARCH" />
          </form>
        </div>

        <div className={styles.bottommenu}>
          <Link className={styles.allLink} to="/s/all">Open all sections</Link>
          {sectionGroups.map((group) => (
            <div className={styles.menuGroup} key={group.label}>
              <span className={styles.groupLabel}>{group.label}</span>
              <div className={styles.groupLinks}>
                {group.sections.map((s) => (
                  <Link key={s.id} to={`/s/${s.id}`}>{s.name}</Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        <Outlet />

      </div>
    </div>
  );
}
