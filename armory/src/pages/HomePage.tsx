import { Link } from "react-router-dom";
import { useArmoryData } from "../data";
import { fmtNumber } from "../lib/format";
import layoutStyles from "../styles/layout.module.css";
import styles from "./HomePage.module.css";

export default function HomePage() {
  const { meta } = useArmoryData();
  return (
    <div className={layoutStyles.contentWrap}>
      <div className={layoutStyles.content}>
        <h1>Welcome to the Age of Conan Armory - reconstructed</h1>

        <p className={styles.intro}>
          An hommage and spiritual successor to the original <a href="https://aoc.is-better-than.tv">Age of Conan Armory</a> by Kentarii.
        </p>
        <hr />

        <h2>How to use</h2>
            <p>Browse sections by locations or class. </p>
            <p>Filter by rarity ond usable level</p>
            <p>Shift + click items to stage them, then open the compare page to see them side by side</p>

        <h3>Search</h3>
            <p>Use Search to find something specific</p>

            <p>
              You can type in any of the 5 things mentioned above, but you can also search
              for class (f.ex: <em>sin</em>), category (f.ex: <em>hands</em>), power level
              (f.ex: <em>rare</em>).
            </p>

            <p>
              <h4>Here's a few examples you can type in the search box:</h4>

              <em>the+grasslands belt</em> · <em>pillars+of+heaven</em> · <em>hox epic dungeon</em> ·{" "}
              <em>tos scarlet+circle epic</em>
            </p>

        <hr />

        <h2>Tools</h2>
        <p>
          <Link to="/builder">Armor builder</Link> — drag &amp; drop items into your gear
          slots and share the result with a link.
          <br />
          <Link to="/builder?calc=1">Attribute trickle-down calculator</Link> — see what a
          stack of an attribute is worth.
        </p>
      </div>

      <aside className={layoutStyles.rightColumn}>
        <div className={styles.rightBox}>
          <div className={styles.header}>Statistics</div>
          <div className={styles.body}>
            <table className={styles.statsTable}>
              <tbody>
                <tr>
                  <th>Sections</th>
                  <td>{fmtNumber(meta.sections)}</td>
                </tr>
                <tr>
                  <th>Sets</th>
                  <td>{fmtNumber(meta.uniqueSets)}</td>
                </tr>
                <tr>
                  <th>Items</th>
                  <td>{fmtNumber(meta.uniqueItems)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </aside>
    </div>
  );
}
