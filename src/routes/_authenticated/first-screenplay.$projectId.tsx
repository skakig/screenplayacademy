import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { GuidedStepCard } from "@/components/guided/GuidedStepCard";
import { STEP_META } from "@/components/guided/stepMeta";

export const Route = createFileRoute("/_authenticated/first-screenplay/$projectId")({
  head: () => ({ meta: [{ title: "First Screenplay Path — SceneSmith AI" }] }),
  component: FirstScreenplayPage,
});

function FirstScreenplayPage() {
  const { projectId } = Route.useParams();

  const { data, isLoading } = useQuery({
    queryKey: ["first-screenplay", projectId],
    queryFn: async () => {
      const [{ data: project }, { data: steps }] = await Promise.all([
        supabase.from("projects").select("title, logline, genre, tone, project_type").eq("id", projectId).maybeSingle(),
        supabase.from("project_guided_steps").select("*").eq("project_id", projectId).order("order_index"),
      ]);
      return { project, steps: steps ?? [] };
    },
  });

  if (isLoading) return <AppShell><div className="p-10 text-muted-foreground">Loading…</div></AppShell>;
  if (!data?.project) return <AppShell><div className="p-10">Project not found.</div></AppShell>;

  const done = data.steps.filter((s) => s.status === "complete").length;
  const total = data.steps.length;
  const projectContext = `Title: ${data.project.title}\nType: ${data.project.project_type}\nGenre: ${data.project.genre ?? ""}\nTone: ${data.project.tone ?? ""}\nLogline: ${data.project.logline ?? ""}`;

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
                step={s as any}
                meta={meta}
                index={i}
                projectId={projectId}
                projectContext={projectContext}
              />
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
