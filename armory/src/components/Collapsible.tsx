import { useState } from "react";
import type { ReactNode } from "react";

interface Props {
  label: ReactNode;
  /** default expanded state (uncontrolled) */
  defaultOpen?: boolean;
  className?: string;
  children: ReactNode;
}

/** Collapsible tree node: click the label to expand/collapse the children. */
export default function Collapsible({ label, defaultOpen = true, className, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <li className={`${open ? "expanded" : "collapsed"} ${className ?? ""}`.trim()}>
      <span
        className="nodeLabel"
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(!open);
          }
        }}
      >
        {label}
      </span>
      {open && <div className="children">{children}</div>}
    </li>
  );
}
