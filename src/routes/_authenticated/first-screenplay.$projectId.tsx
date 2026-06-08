import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { GuidedStepCard } from "@/components/guided/GuidedStepCard";
import { STEP_META } from "@/components/guided/stepMeta";
import { updateGuidedStep } from "@/lib/academy.functions";

export const Route = createFileRoute("/_authenticated/first-screenplay/$projectId")({
  head: () => ({ meta: [{ title: "First Screenplay Path — SceneSmith AI" }] }),
  component: FirstScreenplayPage,
});

// Thresholds for auto-detecting editor step completion
const AUTO_THRESHOLDS = {
  opening_scene: { minHeadings: 1, minBlocks: 5 },
  act1: { minScenes: 3, minBlocks: 40 },
  rough_draft: { minBlocks: 150 },
};

function FirstScreenplayPage() {
  const { projectId } = Route.useParams();
  const qc = useQueryClient();
  const updateFn = useServerFn(updateGuidedStep);
  const autoCompletedRef = useRef<Set<string>>(new Set());

  const { data, isLoading } = useQuery({
    queryKey: ["first-screenplay", projectId],
    queryFn: async () => {
      const [{ data: project }, { data: steps }, { data: blocks }, { data: scenes }] = await Promise.all([
        supabase.from("projects").select("title, logline, genre, tone, project_type").eq("id", projectId).maybeSingle(),
        supabase.from("project_guided_steps").select("*").eq("project_id", projectId).order("order_index"),
        supabase.from("script_blocks").select("id, block_type").eq("project_id", projectId),
        supabase.from("scenes").select("id").eq("project_id", projectId),
      ]);
      return { project, steps: steps ?? [], blocks: blocks ?? [], scenes: scenes ?? [] };
    },
  });

  // Auto-complete create_project (Step 1) since the project exists
  useEffect(() => {
    if (!data?.steps) return;
    const step1 = data.steps.find((s) => s.step_key === "create_project");
    if (step1 && step1.status !== "complete" && !autoCompletedRef.current.has("create_project")) {
      autoCompletedRef.current.add("create_project");
      updateFn({ data: { projectId, stepKey: "create_project", status: "complete" } })
        .then(() => qc.invalidateQueries({ queryKey: ["first-screenplay", projectId] }))
        .catch(() => autoCompletedRef.current.delete("create_project"));
    }
  }, [data, projectId, updateFn, qc]);

  // Auto-detect editor-driven steps based on blocks/scenes
  useEffect(() => {
    if (!data?.steps) return;
    const blocks = data.blocks;
    const scenes = data.scenes;
    const headings = blocks.filter((b) => b.block_type === "scene_heading").length;
    const totalBlocks = blocks.length;
    const totalScenes = scenes.length;

    const checks: Array<[keyof typeof AUTO_THRESHOLDS, boolean]> = [
      ["opening_scene", headings >= AUTO_THRESHOLDS.opening_scene.minHeadings && totalBlocks >= AUTO_THRESHOLDS.opening_scene.minBlocks],
      ["act1", totalScenes >= AUTO_THRESHOLDS.act1.minScenes && totalBlocks >= AUTO_THRESHOLDS.act1.minBlocks],
      ["rough_draft", totalBlocks >= AUTO_THRESHOLDS.rough_draft.minBlocks],
    ];

    for (const [key, met] of checks) {
      if (!met) continue;
      const step = data.steps.find((s) => s.step_key === key);
      if (!step || step.status === "complete") continue;
      if (autoCompletedRef.current.has(key)) continue;
      autoCompletedRef.current.add(key);
      updateFn({ data: { projectId, stepKey: key, status: "complete" } })
        .then(() => qc.invalidateQueries({ queryKey: ["first-screenplay", projectId] }))
        .catch(() => autoCompletedRef.current.delete(key));
    }
  }, [data, projectId, updateFn, qc]);

  if (isLoading) return <AppShell><div className="p-10 text-muted-foreground">Loading…</div></AppShell>;
  if (!data?.project) return <AppShell><div className="p-10">Project not found.</div></AppShell>;

  const done = data.steps.filter((s) => s.status === "complete").length;
  const total = data.steps.length;
  const projectContext = `Title: ${data.project.title}\nType: ${data.project.project_type}\nGenre: ${data.project.genre ?? ""}\nTone: ${data.project.tone ?? ""}\nLogline: ${data.project.logline ?? ""}`;

  const autoKeys = new Set(["create_project", "opening_scene", "act1", "rough_draft"]);

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">First Screenplay Path</div>
          <h1 className="font-display text-3xl font-bold">{data.project.title}</h1>
          <p className="text-muted-foreground mt-1">{done} of {total} steps complete</p>
          {total > 0 && (
            <div className="mt-3 h-2 rounded-full bg-secondary overflow-hidden">
              <div className="h-full bg-primary transition-all" style={{ width: `${Math.round((done / total) * 100)}%` }} />
            </div>
          )}
          <Button asChild variant="ghost" size="sm" className="mt-3">
            <Link to="/editor/$projectId" params={{ projectId }}>Open editor <ArrowRight className="h-3.5 w-3.5 ml-1.5" /></Link>
          </Button>
        </div>

        <div className="space-y-3">
          {data.steps.map((s, i) => {
            const meta = STEP_META[s.step_key];
            if (!meta) return null;
            return (
              <GuidedStepCard
                key={s.id}
                step={s}
                meta={meta}
                index={i}
                projectId={projectId}
                projectContext={projectContext}
                autoCompleted={autoKeys.has(s.step_key)}
              />
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
