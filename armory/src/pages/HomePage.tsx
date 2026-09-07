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
        <h1>Welcome to the Age of Conan Armory</h1>

        <hr />

        <h2>How to find what you're looking for</h2>
        <p>
          The items are structured in the following way:
        </p>
        <ol style={{ margin: "0.4em 0 0.8em 1.4em" }}>
          <li><strong>Section</strong> (f.ex: Brittle Blade)</li>
          <li><strong>Location</strong> (f.ex: Reliquary of Flames)</li>
          <li><strong>Category</strong> (f.ex: Dungeon Cloth Armor)</li>
          <li><strong>Set</strong> (f.ex: The Hidden Tomb)</li>
          <li><strong>Item</strong> (f.ex: Blade's Armbands of the Hidden Tomb)</li>
        </ol>
        <ul className="locations" style={{ listStyle: "disc" }}>
          <li>
            <p>Click your way around the lists and look at stuff.</p>
            <p>This is good if you don't know what you're looking for.</p>
          </li>
          <li>
            <p>Use the <strong>SEARCH</strong> box at the top right to find something specific.</p>

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
          </li>
        </ul>

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
