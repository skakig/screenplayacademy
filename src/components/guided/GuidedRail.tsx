import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOnboarding } from "@/hooks/use-onboarding";
import { STEP_META } from "@/components/guided/stepMeta";
import { BookOpen, ArrowRight, CheckCircle2 } from "lucide-react";

/**
 * Persistent guided-path strip. Renders only when:
 *  - user is in guided mode AND
 *  - project has seeded guided steps AND
 *  - at least one step is not yet complete.
 * Lives at the top of any project page (editor, scenes, characters, etc).
 */
export function GuidedRail({ projectId }: { projectId: string }) {
  const { data: onboarding } = useOnboarding();
  const isGuided = onboarding?.preferred_mode === "guided";

  const { data } = useQuery({
    queryKey: ["guided-rail", projectId],
    enabled: !!isGuided,
    queryFn: async () => {
      const { data: steps } = await supabase
        .from("project_guided_steps")
        .select("step_key, title, status, order_index")
        .eq("project_id", projectId)
        .order("order_index");
      return steps ?? [];
    },
  });

  if (!isGuided || !data || data.length === 0) return null;

  const done = data.filter((s) => s.status === "complete").length;
  const total = data.length;
  if (done === total) return null;

  const current =
    data.find((s) => s.status === "in_progress") ??
    data.find((s) => s.status !== "complete");
  if (!current) return null;

  const meta = STEP_META[current.step_key];
  const pct = Math.round((done / total) * 100);

  return (
    <div data-tour="guided-rail" className="border-b border-primary/20 bg-primary/[0.04]">
      <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-2 flex items-center gap-3 flex-wrap text-xs">
        <Link
          to="/first-screenplay/$projectId"
          params={{ projectId }}
          className="inline-flex items-center gap-1.5 text-primary hover:underline font-medium"
        >
          <BookOpen className="h-3.5 w-3.5" />
          Guided Path
        </Link>
        <span className="text-muted-foreground">
          Step {current.order_index} of {total}:
        </span>
        <span className="font-medium text-foreground truncate max-w-[280px]">
          {current.title}
        </span>
        {meta?.task && (
          <span className="text-muted-foreground hidden md:inline truncate max-w-[420px]">
            — {meta.task}
          </span>
        )}
        <div className="hidden sm:flex items-center gap-2 ml-auto">
          <div className="flex items-center gap-1 text-muted-foreground">
            <CheckCircle2 className="h-3 w-3" />
            {done}/{total}
          </div>
          <div className="h-1 w-24 rounded-full bg-secondary overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
          </div>
          <Link
            to="/first-screenplay/$projectId"
            params={{ projectId }}
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            Continue <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}
