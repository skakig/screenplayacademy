import { Link } from "@tanstack/react-router";
import { Check } from "lucide-react";

const STEPS = [
  { key: "foundation", label: "Foundation" },
  { key: "characters", label: "Characters" },
  { key: "arc", label: "Arc" },
  { key: "scenes", label: "Scenes" },
  { key: "polish", label: "Polish" },
] as const;

type Props = {
  projectId: string;
  currentStep?: string | null;
  completedCount?: number;
};

export function GuidedStepStrip({ projectId, currentStep, completedCount = 0 }: Props) {
  const currentIdx = Math.max(
    0,
    STEPS.findIndex((s) => s.key === currentStep),
  );
  return (
    <div className="border-b border-border/40 bg-card/40 backdrop-blur">
      <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-2 flex items-center gap-1 overflow-x-auto">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mr-2 shrink-0">
          First Screenplay
        </span>
        {STEPS.map((s, i) => {
          const isCurrent = i === currentIdx;
          const isDone = i < completedCount;
          return (
            <Link
              key={s.key}
              to="/first-screenplay/$projectId"
              params={{ projectId }}
              hash={`step-${s.key}`}
              className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                isCurrent
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : isDone
                  ? "bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted/70 hover:text-foreground"
              }`}
            >
              <span className="font-mono tabular-nums opacity-60">{i + 1}</span>
              {isDone && <Check className="h-3 w-3" />}
              {s.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
