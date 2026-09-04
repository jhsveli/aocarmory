import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { sections } from "../data";
import styles from "./Layout.module.css";

export default function Layout() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");

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
          <ul className={styles.sectionmenu}>
            <li><Link to="/s/all">All</Link></li>
            {sections.map((s) => (
              <li key={s.id}>
                <Link to={`/s/${s.id}`}>{s.name}</Link>
              </li>
            ))}
          </ul>
        </div>

        <Outlet />

      </div>
    </div>
  );
}
