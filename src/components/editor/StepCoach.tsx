import { Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Check, Circle, Sparkles, ArrowRight, BookOpen, Loader2 } from "lucide-react";
import { STEP_META } from "@/components/guided/stepMeta";
import type { StepProgress } from "@/lib/editor/stepCompletion";
import { useState } from "react";

type Props = {
  projectId: string;
  stepKey: string | undefined;
  progress: StepProgress;
  onPrimary: () => void | Promise<void>;
  onMarkComplete: () => void | Promise<void>;
  primaryBusy?: boolean;
  markBusy?: boolean;
};

export function StepCoach({
  projectId,
  stepKey,
  progress,
  onPrimary,
  onMarkComplete,
  primaryBusy,
  markBusy,
}: Props) {
  const navigate = useNavigate();
  const meta = stepKey ? STEP_META[stepKey] : undefined;
  const [exampleOpen, setExampleOpen] = useState(false);

  if (!meta) return null;

  return (
    <div className="max-w-[680px] mx-auto mb-4 font-sans">
      <div className="rounded-lg border border-primary/30 bg-primary/[0.06] p-4 lg:p-5 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-primary font-semibold flex items-center gap-1.5">
              <BookOpen className="h-3 w-3" />
              Guided step · {stepKey?.replace(/_/g, " ")}
            </div>
            <h3 className="font-semibold text-base mt-0.5">{meta.concept}</h3>
            <p className="text-sm text-muted-foreground mt-1">{meta.task}</p>
          </div>
          <Link
            to="/first-screenplay/$projectId"
            params={{ projectId }}
            className="text-xs text-primary hover:underline whitespace-nowrap"
          >
            All steps →
          </Link>
        </div>

        {progress.checks.length > 0 && (
          <ul className="space-y-1.5">
            {progress.checks.map((c, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                {c.done ? (
                  <Check className="h-4 w-4 text-primary shrink-0" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                )}
                <span className={c.done ? "text-foreground" : "text-muted-foreground"}>{c.label}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {progress.primaryAction && progress.primaryAction.kind !== "mark" && (
            <Button size="sm" onClick={() => void onPrimary()} disabled={primaryBusy}>
              {primaryBusy ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : progress.primaryAction.kind === "ai" ? (
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              ) : (
                <ArrowRight className="h-3.5 w-3.5 mr-1.5" />
              )}
              {progress.primaryAction.label}
            </Button>
          )}
          <Button
            size="sm"
            variant={progress.allDone ? "default" : "outline"}
            disabled={!progress.allDone || markBusy}
            onClick={() => void onMarkComplete()}
          >
            {markBusy ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Check className="h-3.5 w-3.5 mr-1.5" />}
            Mark step complete
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setExampleOpen((v) => !v)}>
            {exampleOpen ? "Hide example" : "Show me an example"}
          </Button>
          <Button asChild size="sm" variant="ghost" className="ml-auto">
            <Link to="/first-screenplay/$projectId" params={{ projectId }}>
              Back to guided path
            </Link>
          </Button>
        </div>

        {exampleOpen && (
          <div className="rounded-md border border-border/60 bg-card/60 p-3 text-sm text-muted-foreground italic">
            <span className="not-italic font-semibold text-foreground/80">Example: </span>
            {meta.example}
          </div>
        )}
      </div>
    </div>
  );
}
