import { Link } from "react-router-dom";
import styles from "./FactionsPage.module.css";

// Rise of the Godslayer faction content from the archived Factions page.
const OPPOSITIONS: Array<[string, string]> = [
  ["Brittle Blade", "Shadows of Jade"],
  ["Children of Yag-kosha", "Yellow Priests of Yun"],
  ["Hyrkanians", "Wolves of the Steppes"],
  ["Last Legion", "Scarlet Circle"],
  ["Scholars of Cheng-Ho", "Tamarin's Tigers"],
];

const FACTION_IDS: Record<string, number> = {
  "Brittle Blade": 1,
  "Shadows of Jade": 7,
  "Children of Yag-kosha": 2,
  "Yellow Priests of Yun": 10,
  "Hyrkanians": 3,
  "Wolves of the Steppes": 9,
  "Last Legion": 4,
  "Scarlet Circle": 5,
  "Scholars of Cheng-Ho": 6,
  "Tamarin's Tigers": 8,
};

export default function FactionsPage() {
  return (
    <div className="content">
      <h1>Rise of the Godslayer Factions</h1>
      <p>
        Rise of The Godslayer brings a new dimension to Age of Conan... Faction Warfare.
      </p>
      <p>
        Which faction you pledge your allegiance to, depends on the rewards they lure you with.
      </p>
      <p>
        The two hottest factions to join are <em>Tamarin's Tigers</em> for their Tiger pet/mount
        and <em>Wolves of the Steppes</em> for their Wolf pet/mount, but aligning with them will
        make you enemies with two other factions, so choose wisely.
      </p>
      <p>
        To make your choice easier, I've made this page to give you a helping hand when you weigh
        one faction against another. Check out what kind of armor, weapons and accessories each
        faction can provide you with and make the choice which is right for you.
      </p>

      <h2>The opposing factions in Rise of the Godslayer are:</h2>
      <div className={styles.factionOppositions}>
        {OPPOSITIONS.map(([a, b]) => (
          <div key={a} style={{ display: "contents" }}>
            <span className={styles.side}>
              <Link to={`/s/${FACTION_IDS[a]}`}>{a}</Link>
            </span>
            <span className={styles.vs}>vs</span>
            <span className={styles.side}>
              <Link to={`/s/${FACTION_IDS[b]}`}>{b}</Link>
            </span>
          </div>
        ))}
      </div>
      <p>
        In addition to the ten factions, there are two hidden factions which you have to seek
        out on your own. The rewards they may provide you with remains to be seen...
      </p>
      <p>
        RotGS also brings upgrades to your combos and spells in form of{" "}
        <Link to="/s/12">consumable books</Link>. You can find the location and what upgrades
        each book provide on this page.
      </p>

      <h2>Armor sets explained</h2>
      <p>There are multiple ways to put together an armor set.</p>
      <p>
        You can purchase a <strong>faction armor set</strong> which include 6 rare items and 2
        epic items (feet, wrist) using <strong>Mark of Acclaim</strong> which you can gain by
        doing faction quests. The set is named by its suffix.
      </p>
      <p>
        You can purchase a <strong>dungeon armor set</strong> which include 6 rare items and 2
        epic items (head, chest) using <strong>Simple Trophies</strong> and{" "}
        <strong>Rare Trophies</strong> which you can gain by doing dungeons in normal and
        hardmode. The set is named by its suffix.
      </p>
      <p>
        You can put together an <strong>epic armor set</strong> by purchasing 2 epic faction
        items (feet, wrist) using Mark of Acclaim, 2 epic dungeon items (head, chest) using Rare
        Trophies and doing dungeons in hardmode to obtain the 4 last epic pieces (shoulder,
        gloves, belt, legs) which drops from certain instances. The set is named by its prefix.
      </p>
      <p>The last option is of course the best option since you will get a full epic set.</p>
    </div>
  );
}
