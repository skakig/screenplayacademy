import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Lock, PlayCircle, ArrowRight, Sparkles } from "lucide-react";

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
        supabase.from("projects").select("title, logline").eq("id", projectId).maybeSingle(),
        supabase.from("project_guided_steps").select("*").eq("project_id", projectId).order("order_index"),
      ]);
      return { project, steps: steps ?? [] };
    },
  });

  if (isLoading) return <AppShell><div className="p-10 text-muted-foreground">Loading…</div></AppShell>;
  if (!data?.project) return <AppShell><div className="p-10">Project not found.</div></AppShell>;

  const done = data.steps.filter((s) => s.status === "complete").length;
  const total = data.steps.length;

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

        <div className="space-y-2">
          {data.steps.map((s, i) => {
            const icon = s.status === "complete" ? Check : s.status === "in_progress" ? PlayCircle : Lock;
            const Icon = icon;
            const styles =
              s.status === "complete"
                ? "border-primary/30 bg-primary/5"
                : s.status === "in_progress"
                  ? "border-primary/40 bg-card"
                  : "border-border/40 bg-card/50 opacity-70";
            return (
              <Card key={s.id} className={`p-4 flex items-center gap-3 ${styles}`}>
                <div className={`h-8 w-8 rounded-full flex items-center justify-center ${s.status === "complete" ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground"}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <div className="text-xs text-muted-foreground">Step {i + 1}</div>
                  <div className="font-medium text-sm">{s.title}</div>
                </div>
                {s.status === "in_progress" && (
                  <Button size="sm" asChild>
                    <Link to="/editor/$projectId" params={{ projectId }}>
                      <Sparkles className="h-3.5 w-3.5 mr-1.5" />Work on this
                    </Link>
                  </Button>
                )}
              </Card>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground text-center pt-4">
          Detailed per-step lessons and AI helpers ship in the next update. Use the editor and Academy for now — your progress is being tracked.
        </p>
      </div>
    </AppShell>
  );
}
