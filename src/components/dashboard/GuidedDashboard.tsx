import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GraduationCap, BookOpen, ArrowRight, Sparkles, Plus } from "lucide-react";

export function GuidedDashboard() {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["guided-dashboard"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const [{ data: projects }, { data: progress }] = await Promise.all([
        supabase.from("projects").select("*").order("updated_at", { ascending: false }).limit(3),
        u.user
          ? supabase.from("user_lesson_progress").select("lesson_id, status").eq("user_id", u.user.id)
          : Promise.resolve({ data: [] }),
      ]);
      const currentProject = (projects ?? [])[0];
      let steps: { step_key: string; title: string; status: string; order_index: number }[] = [];
      let current: typeof steps[number] | undefined;
      if (currentProject) {
        const { data: s } = await supabase
          .from("project_guided_steps")
          .select("step_key, title, status, order_index")
          .eq("project_id", currentProject.id)
          .order("order_index");
        steps = s ?? [];
        current = steps.find((x) => x.status === "in_progress") ?? steps.find((x) => x.status === "locked") ?? steps[steps.length - 1];
      }
      const done = steps.filter((s) => s.status === "complete").length;
      const total = steps.length;
      const suggestedLessons = (await supabase.from("academy_lessons").select("id, title, slug, module_id").order("order_index").limit(20)).data ?? [];
      const completedSet = new Set((progress ?? []).filter((p: { status: string }) => p.status === "complete").map((p: { lesson_id: string }) => p.lesson_id));
      const suggestedLesson = suggestedLessons.find((l) => !completedSet.has(l.id));
      return { project: currentProject, steps, current, done, total, suggestedLesson };
    },
  });

  if (isLoading) return <div className="p-10 text-muted-foreground">Loading…</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Welcome back</h1>
        <p className="text-muted-foreground mt-1">Let's keep building your first screenplay.</p>
      </div>

      {!data?.project ? (
        <Card className="p-8 border-dashed">
          <div className="flex flex-col items-center text-center">
            <BookOpen className="h-12 w-12 mx-auto text-primary mb-3" />
            <h3 className="font-display text-2xl font-semibold mb-2">Start your first screenplay</h3>
            <p className="text-sm text-muted-foreground max-w-md mb-5">
              We'll walk you through 13 focused steps — logline, characters, story arc, scenes, opening pages, draft, table read, and pitch package. Most beginners finish a complete rough draft in 2–4 weeks.
            </p>
            <Button size="lg" onClick={() => navigate({ to: "/projects/new" })} className="shadow-lg shadow-primary/20">
              <Plus className="h-4 w-4 mr-1.5" />Create your first project
            </Button>
            <p className="text-xs text-muted-foreground mt-3">No experience needed. You can change anything later.</p>
          </div>
        </Card>
      ) : (
        <Card className="p-6">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <Badge variant="secondary" className="text-[10px] mb-2">First Screenplay Path</Badge>
              <h2 className="font-display text-xl font-semibold">{data.project.title}</h2>
              {data.current && <p className="text-sm text-muted-foreground mt-1">Next up: {data.current.title}</p>}
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <div className="font-semibold text-foreground">{data.done}/{data.total} steps</div>
              <div>complete</div>
            </div>
          </div>
          {data.total > 0 && (
            <div className="h-2 rounded-full bg-secondary overflow-hidden mb-4">
              <div className="h-full bg-primary transition-all" style={{ width: `${Math.round((data.done / data.total) * 100)}%` }} />
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link to="/first-screenplay/$projectId" params={{ projectId: data.project.id }}>
                Continue path <ArrowRight className="h-4 w-4 ml-1.5" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/editor/$projectId" params={{ projectId: data.project.id }}>
                Open editor
              </Link>
            </Button>
          </div>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-2">
            <GraduationCap className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Suggested lesson</h3>
          </div>
          {data?.suggestedLesson ? (
            <>
              <p className="text-sm mb-3">{data.suggestedLesson.title}</p>
              <Button asChild size="sm" variant="outline">
                <Link to="/academy">Open Academy <ArrowRight className="h-3.5 w-3.5 ml-1.5" /></Link>
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">You're up to date. Nice work.</p>
          )}
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Coach Mode</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-3">Adjust how chatty the editor's coach is.</p>
          <Button asChild size="sm" variant="outline"><Link to="/settings">Open Settings</Link></Button>
        </Card>
      </div>
    </div>
  );
}
