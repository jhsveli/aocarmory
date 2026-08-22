import styles from "./AboutPage.module.css";

// Milestones and credits reproduced from the archived About page.

const MILESTONES: Array<[string, string]> = [
  ["2010-05-11", "Rise of the Godslayer hits the live servers."],
  ["2010-05-13", "Started working on the Faction Armory page by mapping the location of all the faction merchants and the items which they were selling."],
  ["2010-05-17", "Finished adding all the items sold by the faction merchants."],
  ["2010-05-20", "Added Attribute calculator."],
  ["2010-05-24", "Added prices to the items sold by the merchants."],
  ["2010-06-14", "Added search functionality to the faction page."],
  ["2010-06-15", "Started the long process with adding boss drop location for epic items from Khitai hardmode dungeons."],
  ["2010-07-13", "Official thread on EU-forums finally got some glue, thx to Vorbiz."],
  ["2010-08-01", "The title Faction Armory did not fit the content of the page any more and the new Armory page came to life."],
  ["2010-09-02", "Added Armor builder to the Armory, much inspired by EvE online's EvE Fitting Tool, where you can put together items of your choice and see the stats of the items. Also started adding Tier 3 armor sets."],
  ["2010-09-03", "Added Shoutbox to the page to make it easier for all the visitors to leave feedback. Only gotten feedback from the EU-community until now."],
  ["2010-09-06", "Finished adding the Tier 3 armor sets."],
  ["2010-09-22", "Improved Armor builder by incorporating the Attribute calculator for the base stats."],
  ["2010-10-28", "Added links to Armor builder sets so that people could share their builds."],
  ["2010-10-30", "Started adding Tier 3 crafted weapons to the Armory"],
  ["2010-11-01", "Started adding Tier 1 and Tier 2 armor sets to the Armory."],
  ["2010-11-04", "Finished adding Tier 1 and Tier 2 armor sets."],
  ["2010-11-08", "Added Profiler which reads the profile data provided by YG and presents it in a plain view. The unique feature is the link to the Armor builder so that you can quickly see the stats of the items you or your friends/enemies are wearing."],
  ["2010-11-11", "Started adding PvP armor sets to the Armory."],
  ["2010-11-14", "Finished adding PvP gear including accessories and weapons."],
  ["2011-01-18", "Added last armor item, Blade's Gloves of the Hidden Tomb, which can drop from Khitai hardmodes."],
];

const CREDITS = [
  "Funcom — for creating the game (and breaking it as well...)",
  "Getrix — for running the Bebot ItemDB.",
  "YellowGremlin — for providing the gaming community with their database and services.",
  "Everyone who has contributed with feedback.",
  "Everyone who has bothered to just say thank you. We all crave attention, and I'm no different.",
];

const DONORS = [
  "Xiloscient", "Oddbjørn", "Dana", "Thutkemi", "Sidar", "Fabien", "Schmoozer",
  "Ronald", "Anthony", "Tomas", "Patrick", "David", "Armelle", "Brian", "Aaron",
  "Anna", "Billy", "Jose Manuel", "Stephan", "Howard", "Lorayne", "Markus",
  "Arild", "David", "Todd", "Jicamo", "Darlene", "Emmanuel", "Stephan", "Qassim",
  "Peter", "Durango", "James", "Richard", "Anthony", "Steinar", "Qassim", "Oscar",
  "Benoit", "Jose", "Stig", "Jonathan", "Eivind", "Bernard", "David", "Vanessa",
  "Anthony", "Jan", "Park", "Jarid", "Blair",
];

export default function AboutPage() {
  return (
    <div className="content">
      <h1>About</h1>
      <p>
        The AoC&gt;TV: Armory started out as a mapping project to find out what kind of gear the
        various factions could provide me with to make it easier to decide which faction I should
        go for. Since no-one else had created such a list I took it upon myself to do this task.
        Little did I know the amount of time I would later spend on this "small" project.
      </p>

      <h2>Milestones</h2>
      <ul className={styles.milestones}>
        {MILESTONES.map(([date, text]) => (
          <li key={date}>
            <span className={styles.date}>{date}</span> — {text}
          </li>
        ))}
      </ul>

      <h2>Credits</h2>
      <ul className="linksList">
        {CREDITS.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>

      <h2>Donations</h2>
      <p>
        I would also give a special thanks to the people who have donated to this project.
      </p>
      <p className="page-intro">{DONORS.join(" · ")}</p>
      <p className="page-intro">
        If you don't want your name in this list, please let me know.
      </p>
    </div>
  );
}
