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

  if (isLoading) return <div className="p-10 text-muted-foreground font-script italic">Setting the stage…</div>;

  const pct = data && data.total > 0 ? Math.round((data.done / data.total) * 100) : 0;

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
      {/* Marquee */}
      <div className="relative rounded-xl border border-border/60 p-6 md:p-8 overflow-hidden"
        style={{ background: "var(--gradient-cinematic)", boxShadow: "var(--shadow-cinematic)" }}>
        <div className="absolute inset-0 opacity-[0.07] pointer-events-none"
          style={{ backgroundImage: "radial-gradient(circle at 18% 30%, var(--primary) 0, transparent 40%), radial-gradient(circle at 82% 70%, var(--accent) 0, transparent 42%)" }} />
        <div className="relative">
          <p className="font-mono uppercase tracking-[0.22em] text-[10px] text-primary/80 mb-2">Studio Lobby · Guided Path</p>
          <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight">Welcome back to the lot.</h1>
          <p className="font-script italic text-muted-foreground mt-2">Let's keep building your first screenplay.</p>
        </div>
      </div>

      {!data?.project ? (
        <Card className="p-8 border-dashed cine-card">
          <div className="flex flex-col items-center text-center">
            <BookOpen className="h-12 w-12 mx-auto text-primary mb-3" />
            <h3 className="font-display text-2xl font-semibold mb-2">Start your first screenplay</h3>
            <p className="text-sm text-muted-foreground max-w-md mb-5">
              We'll walk you through 13 focused steps — logline, characters, story arc, scenes, opening pages, draft, table read, and pitch package. Most beginners finish a complete rough draft in 2–4 weeks.
            </p>
            <Button size="lg" onClick={() => navigate({ to: "/projects/new" })} className="shadow-lg shadow-primary/20">
              <Plus className="h-4 w-4 mr-1.5" />Open your first studio
            </Button>
            <p className="text-xs text-muted-foreground mt-3 font-mono uppercase tracking-[0.18em]">No experience needed</p>
          </div>
        </Card>
      ) : (
        <Card className="cine-card p-0 overflow-hidden border-border/60">
          <div className="px-6 pt-6 pb-5 border-b border-border/60"
            style={{ background: "linear-gradient(180deg, color-mix(in oklab, var(--primary) 8%, transparent), transparent)" }}>
            <Badge variant="secondary" className="font-mono uppercase tracking-[0.15em] text-[9px] mb-3">
              First Screenplay Path
            </Badge>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-display text-2xl font-semibold leading-tight">{data.project.title}</h2>
                {data.current && (
                  <p className="font-script italic text-sm text-muted-foreground mt-1">
                    Next scene: {data.current.title}
                  </p>
                )}
              </div>
              <div className="text-right shrink-0">
                <div className="font-display text-2xl font-semibold text-primary leading-none">{data.done}<span className="text-muted-foreground text-base">/{data.total}</span></div>
                <div className="font-mono uppercase tracking-[0.18em] text-[10px] text-muted-foreground mt-1">steps</div>
              </div>
            </div>
          </div>
          <div className="px-6 py-5">
            {data.total > 0 && (
              <div className="mb-4">
                <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                  <div className="h-full transition-all"
                    style={{ width: `${pct}%`, background: "var(--gradient-gold, var(--primary))" }} />
                </div>
                <p className="font-mono uppercase tracking-[0.2em] text-[10px] text-muted-foreground mt-2">{pct}% complete</p>
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
                  Writer's Desk
                </Link>
              </Button>
            </div>
          </div>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="cine-card p-5">
          <div className="flex items-center gap-2 mb-2">
            <GraduationCap className="h-4 w-4 text-primary" />
            <h3 className="font-display text-base font-semibold">Suggested lesson</h3>
          </div>
          {data?.suggestedLesson ? (
            <>
              <p className="font-script italic text-sm mb-3">{data.suggestedLesson.title}</p>
              <Button asChild size="sm" variant="outline">
                <Link to="/academy">Screenplay School <ArrowRight className="h-3.5 w-3.5 ml-1.5" /></Link>
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">You're up to date. Nice work.</p>
          )}
        </Card>
        <Card className="cine-card p-5">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="font-display text-base font-semibold">Director's Chair</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-3">Adjust how present your director is while you write.</p>
          <Button asChild size="sm" variant="outline"><Link to="/settings">Studio Settings</Link></Button>
        </Card>
      </div>
    </div>
  );
}
