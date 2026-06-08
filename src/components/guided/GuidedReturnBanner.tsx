import { Link, useLocation } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, BookOpen } from "lucide-react";

/**
 * Sticky "Return to First Screenplay Path" banner.
 * Shows on destination pages (editor/characters/story-arc/scenes/pitch/tableread)
 * when the user has a guided project with an in-progress step.
 */
export function GuidedReturnBanner() {
  const location = useLocation();
  const path = location.pathname;

  // Only show on destination pages tied to a project
  const projectIdFromPath = (() => {
    const m = path.match(/^\/(editor|characters|story-arc|scenes|pitch|tableread|arc-timeline|storyboard)\/([0-9a-f-]{36})/i);
    return m?.[2];
  })();

  const enabled = !!projectIdFromPath;

  const { data } = useQuery({
    queryKey: ["guided-return-banner", projectIdFromPath],
    enabled,
    staleTime: 30_000,
    queryFn: async () => {
      if (!projectIdFromPath) return null;
      const { data: steps } = await supabase
        .from("project_guided_steps")
        .select("step_key, title, status, order_index")
        .eq("project_id", projectIdFromPath)
        .order("order_index");
      if (!steps || steps.length === 0) return null;
      const allComplete = steps.every((s) => s.status === "complete");
      if (allComplete) return null;
      const current =
        steps.find((s) => s.status === "in_progress") ??
        steps.find((s) => s.status !== "complete") ??
        steps[0];
      return { projectId: projectIdFromPath, current, total: steps.length };
    },
  });

  if (!data?.current) return null;

  return (
    <div className="border-b border-primary/30 bg-primary/5">
      <div className="max-w-[1600px] mx-auto px-4 py-2 flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <BookOpen className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="text-muted-foreground shrink-0">First Screenplay Path</span>
          <span className="text-foreground/70 shrink-0">•</span>
          <span className="font-medium truncate">
            Step {data.current.order_index} of {data.total}: {data.current.title}
          </span>
        </div>
        <Link
          to="/first-screenplay/$projectId"
          params={{ projectId: data.projectId }}
          hash={`step-${data.current.step_key}`}
          className="flex items-center gap-1 text-primary hover:underline shrink-0"
        >
          <ArrowLeft className="h-3 w-3" /> Return to guided path
        </Link>
      </div>
    </div>
  );
}
