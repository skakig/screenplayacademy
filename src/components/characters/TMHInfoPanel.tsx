import { useState } from "react";
import { Info, ChevronDown } from "lucide-react";
import { TMH_LEVELS } from "./tmh";
import { TMHBadge } from "./TMHBadge";

export function TMHInfoPanel() {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-border/60 bg-card/40">
      <button type="button" onClick={() => setOpen(!open)} className="w-full flex items-center gap-2 p-3 text-sm hover:bg-secondary/40 rounded-lg transition">
        <Info className="h-4 w-4 text-accent" />
        <span className="font-medium">What is TMH?</span>
        <span className="ml-auto text-xs text-muted-foreground">
          Moral behavior under pressure — not judgment
        </span>
        <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-1.5 text-xs text-muted-foreground">
          <p className="pt-1">
            TMH describes <span className="text-foreground">how a character behaves when pressure rises</span>. A "low" baseline isn't a bad character — it's a starting place for transformation. Heroes regress under stress. Villains aspire. The gap is your story.
          </p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-2">
            {TMH_LEVELS.map((l) => (
              <li key={l.level} className="flex items-start gap-2">
                <TMHBadge level={l.level} size="xs" />
                <span className="text-[11px] leading-tight">{l.description}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
