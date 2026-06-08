import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GraduationCap, Clock, ArrowRight, Check } from "lucide-react";

export const Route = createFileRoute("/_authenticated/academy/")({
  head: () => ({ meta: [{ title: "Academy — SceneSmith AI" }] }),
  component: AcademyIndex,
});

function AcademyIndex() {
  const { data: modules = [], isLoading } = useQuery({
    queryKey: ["academy-modules-with-progress"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const [{ data: mods }, { data: lessons }, { data: progress }] = await Promise.all([
        supabase.from("academy_modules").select("*").order("order_index"),
        supabase.from("academy_lessons").select("id, module_id"),
        u.user
          ? supabase.from("user_lesson_progress").select("lesson_id, status").eq("user_id", u.user.id)
          : Promise.resolve({ data: [] }),
      ]);
      const completedSet = new Set((progress ?? []).filter((p: { status: string }) => p.status === "complete").map((p: { lesson_id: string }) => p.lesson_id));
      const byModule = new Map<string, { total: number; done: number }>();
      (lessons ?? []).forEach((l: { id: string; module_id: string }) => {
        const entry = byModule.get(l.module_id) ?? { total: 0, done: 0 };
        entry.total += 1;
        if (completedSet.has(l.id)) entry.done += 1;
        byModule.set(l.module_id, entry);
      });
      return (mods ?? []).map((m) => ({ ...m, ...(byModule.get(m.id) ?? { total: 0, done: 0 }) }));
    },
  });

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="flex items-center gap-3 mb-2">
          <GraduationCap className="h-7 w-7 text-primary" />
          <h1 className="font-display text-3xl font-bold">Academy</h1>
        </div>
        <p className="text-muted-foreground mb-8">Learn the craft of screenwriting, one module at a time. Every lesson connects back to your project.</p>

        {isLoading ? (
          <div className="text-muted-foreground">Loading…</div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {modules.map((m) => {
              const pct = m.total ? Math.round((m.done / m.total) * 100) : 0;
              const allDone = m.total > 0 && m.done === m.total;
              return (
                <Link key={m.id} to="/academy/$moduleSlug" params={{ moduleSlug: m.slug }}>
                  <Card className="p-5 h-full hover:border-primary/60 hover:shadow-lg hover:shadow-primary/10 transition cursor-pointer">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-display text-lg font-semibold">{m.title}</h3>
                      {allDone && <Badge className="bg-primary/15 text-primary border-primary/30"><Check className="h-3 w-3 mr-1" />Done</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">{m.description}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{m.estimated_minutes} min</span>
                      <span>·</span>
                      <span>{m.done}/{m.total} lessons</span>
                      <ArrowRight className="h-3.5 w-3.5 ml-auto text-primary" />
                    </div>
                    {m.total > 0 && (
                      <div className="mt-3 h-1.5 rounded-full bg-secondary overflow-hidden">
                        <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    )}
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
