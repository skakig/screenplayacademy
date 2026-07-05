import { Link } from "@tanstack/react-router";
import { STEP_META } from "@/components/guided/stepMeta";
import { BookOpen } from "lucide-react";

/**
 * Compact progress pill for Basic Mode.
 * Replaces the full horizontal GuidedStepStrip.
 * Example: "Step 10 of 13 · Build the Midpoint"
 */
export function BasicProgressPill({
  projectId,
  currentStep,
}: {
  projectId: string;
  currentStep?: string | null;
}) {
  const keys = Object.keys(STEP_META);
  const idx = currentStep ? keys.indexOf(currentStep) : -1;
  const total = keys.length;
  const shown = idx >= 0 ? idx + 1 : 1;
  const label = currentStep && STEP_META[currentStep]
    ? STEP_META[currentStep].concept.split(" — ")[0].split(":")[0]
    : "Get started";

  return (
    <Link
      to="/first-screenplay/$projectId"
      params={{ projectId }}
      className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/[0.06] hover:bg-primary/[0.12] transition-colors px-3 py-1 text-[11px] font-medium text-foreground"
      title="Open the guided path"
    >
      <BookOpen className="h-3 w-3 text-primary" />
      <span className="font-mono tabular-nums text-primary">
        Step {shown} of {total}
      </span>
      <span className="opacity-60">·</span>
      <span className="truncate max-w-[220px]">{label}</span>
    </Link>
  );
}
