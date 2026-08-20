import { Link } from "react-router-dom";
import { classes } from "../data";
import { IMG_BASE } from "../lib/format";

export default function ArmorSetsPage() {
  return (
    <div className="content">
      <h1>Armor Sets</h1>
      <p className="page-intro">
        This page contains armor builder links for the various armor sets each class can have
        for quick comparison. Click a set to open it in the armor builder.
      </p>
      <hr />
      <div className="armorSetsGrid">
        {classes.map((c) => (
          <div className="armorSetCard" key={c.name}>
            <h2 style={{ fontSize: "1.05rem", margin: "0 0 0.4rem" }}>{c.name}</h2>
            <ul>
              {c.sets.map((s, i) => (
                <li key={`${s.section}-${s.set}-${i}`}>
                  <span className="page-intro">{s.section} :: </span>
                  {s.builder ? (
                    <Link to={`/builder?ab=${s.builder}`}>{s.set}</Link>
                  ) : (
                    <span>{s.set}</span>
                  )}{" "}
                  {s.builder && (
                    <Link to={`/builder?ab=${s.builder}`} title="Open in Armor builder">
                      <img
                        src={`${IMG_BASE}/img/12-em-link.png`}
                        width="16"
                        height="12"
                        alt="Open in Armor builder"
                        style={{ verticalAlign: "text-bottom", marginLeft: "0.3rem" }}
                      />
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
