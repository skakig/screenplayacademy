import { AlertTriangle, Info, Ban, Sparkles } from "lucide-react";

type Warning = {
  category: string;
  severity: "info" | "warn" | "block";
  message: string;
};

const CATEGORY_LABEL: Record<string, string> = {
  timeline_contradiction: "Timeline contradiction",
  motivation_mismatch: "Character motivation mismatch",
  emotional_continuity: "Emotional continuity",
  duplicated_beat: "Duplicated beat",
  premature_reveal: "Premature reveal",
  missing_setup: "Missing setup",
  payoff_opportunity: "Payoff opportunity",
};

export function IntegrationWarningList({ warnings }: { warnings: Warning[] }) {
  if (warnings.length === 0) {
    return (
      <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300 flex items-start gap-2">
        <Sparkles className="h-4 w-4 mt-0.5 shrink-0" />
        <div>Nothing flagged. This scene looks clean to integrate.</div>
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {warnings.map((w, i) => {
        const styles =
          w.severity === "block"
            ? "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300"
            : w.severity === "warn"
              ? "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300"
              : "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300";
        const Icon = w.severity === "block" ? Ban : w.severity === "warn" ? AlertTriangle : Info;
        return (
          <li key={i} className={`rounded-md border p-2.5 text-sm flex items-start gap-2 ${styles}`}>
            <Icon className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              <div className="font-semibold text-xs uppercase tracking-wide">
                {CATEGORY_LABEL[w.category] ?? w.category}
              </div>
              <div className="text-sm">{w.message}</div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
