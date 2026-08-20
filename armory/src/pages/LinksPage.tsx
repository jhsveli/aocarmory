// Links page content reproduced from the archived original.
const LINKS = [
  {
    label: "Feedback thread @ RR-forums",
    url: "http://forum.rr-guild.com/viewtopic.php?f=86&t=34488",
  },
  {
    label: "Faction gear stats",
    url: "http://spreadsheets.google.com/lv?key=tney3UeUkwmVGvkCn22VNkg&type=view&gid=5&f=true&sortcolid=-1&sortasc=true&rowsperpage=250",
  },
  {
    label: "Khitai armor locations",
    url: "http://spreadsheets.google.com/pub?key=0AuctUOQqzI6idFJ6Qk1BTm9CSU9MSXY5bFhzTzhuTWc&hl=en&output=html",
  },
  {
    label: "Raid Loot Table",
    url: "http://forums.ageofconan.com/showthread.php?t=180718",
  },
  {
    label: "New names of raid weapons after 1.05",
    url: "http://forums.ageofconan.com/showthread.php?t=180693",
  },
];

export default function LinksPage() {
  return (
    <div className="content">
      <h1>Links</h1>
      <ul className="linksList">
        {LINKS.map((l) => (
          <li key={l.url}>
            <a href={l.url} target="_blank" rel="noreferrer">{l.label}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}
