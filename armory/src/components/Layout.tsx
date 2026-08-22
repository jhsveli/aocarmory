import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { sections } from "../data";
import { IMG_BASE } from "../lib/format";
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
      {/* fixed top bar — a modern take on the original -=[ ... ]=- menu */}
      <div className={styles.menuBar}>
        <div className={styles.menuLinks}>
          <Link to="/">AoC&gt;TV</Link>
          <span className={styles.sep}>::</span>
          <a href="https://aoc.is-better-than.tv/api.php">API</a>
          <span className={styles.sep}>::</span>
          <Link to="/" className={styles.selected}>Armory</Link>
          <span className={styles.sep}>::</span>
          <a href="https://aoc.is-better-than.tv/aamon.php">AAMon</a>
          <span className={styles.sep}>::</span>
          <a href="https://aoc.is-better-than.tv/bebot.php">Bebot</a>
          <span className={styles.sep}>::</span>
          <a href="https://aoc.is-better-than.tv/belaui.php">BelaUI</a>
          <span className={styles.sep}>::</span>
          <a href="https://aoc.is-better-than.tv/forums/">Forums</a>
          <span className={styles.sep}>::</span>
          <a href="https://aoc.is-better-than.tv/scripts.php">Scripts</a>
          <span className={styles.sep}>::</span>
          <a href="https://aoc.is-better-than.tv/onyx.php">The Onyx Chambers</a>
          <span className={styles.sep}>::</span>
          <a href="https://aoc.is-better-than.tv/veteran.php">Veteran Rewards</a>
        </div>
        <div className={styles.authLinks}>
          [ <a href="https://aoc.is-better-than.tv/forums/ucp.php?mode=register">Register</a>
          {" "}:: <a href="https://aoc.is-better-than.tv/forums/ucp.php?mode=login">Login</a> ]
        </div>
      </div>

      <div className={styles.page}>
        <div className={styles.topmenu}>
          <ul className={styles.mainmenu}>
            <li><NavLink to="/" end>Home</NavLink></li>
            <li><NavLink to="/sets">Armor Sets</NavLink></li>
            <li><NavLink to="/factions">Factions</NavLink></li>
            <li><NavLink to="/links">Links</NavLink></li>
            <li><NavLink to="/about">About</NavLink></li>
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

        <Link to="/">
          <img
            className={styles.banner}
            src={`${IMG_BASE}/images/armory.png`}
            alt="Faction Armory"
            height={200}
          />
        </Link>

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

        <div className={styles.footer}>
          Created by Kentarii [Ragnarok] @ EN Fury PvP 2008–2024
          <br />
          <span>Recreated in React + TypeScript from the archived original · Page generated in 0.000 seconds using 0 queries, consuming 0 kB of memory.</span>
        </div>
        <div className={styles.paypal}>
          <p>
            If you like the content on this website, feel free to donate a few $ for the yearly costs.
            <br />
            This will be used to pay the bills and keep this site running free of any ads ;o)
            <br />
            Thanks in advance!! Kentarii
          </p>
          <a href="https://www.paypal.me/phuc77">
            <img src={`${IMG_BASE}/img/btn_donate_SM.gif`} alt="Donate using PayPal" title="Donate using PayPal" />
          </a>
        </div>
      </div>
    </div>
  );
}
