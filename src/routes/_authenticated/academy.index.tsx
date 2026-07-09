import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GraduationCap, Clock, ArrowRight, Check } from "lucide-react";
import { t } from "@/lib/i18n/t";

export const Route = createFileRoute("/_authenticated/academy/")({
  head: () => ({
    meta: [
      { title: t("academy.head.title") },
      { name: "description", content: t("academy.head.description") },
      { property: "og:title", content: t("academy.head.ogTitle") },
      { property: "og:description", content: t("academy.head.ogDescription") },
    ],
  }),
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
          <GraduationCap className="h-7 w-7 text-primary" aria-hidden="true" />
          <h1 className="font-display text-3xl font-bold">{t("academy.title")}</h1>
        </div>
        <p className="text-muted-foreground mb-8">{t("academy.subtitle")}</p>

        {isLoading ? (
          <div className="text-muted-foreground">{t("academy.loading")}</div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {modules.map((m) => {
              const pct = m.total ? Math.round((m.done / m.total) * 100) : 0;
              const allDone = m.total > 0 && m.done === m.total;
              const lessonsLabel = m.total === 1
                ? t("academy.lessonsAvailable", { n: m.total })
                : t("academy.lessonsAvailable_plural", { n: m.total });
              return (
                <Link key={m.id} to="/academy/$moduleSlug" params={{ moduleSlug: m.slug }}>
                  <Card className="p-5 h-full hover:border-primary/60 hover:shadow-lg hover:shadow-primary/10 transition cursor-pointer">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-display text-lg font-semibold">{m.title}</h3>
                      {allDone && (
                        <Badge className="bg-primary/15 text-primary border-primary/30">
                          <Check className="h-3 w-3 mr-1" aria-hidden="true" />
                          {t("academy.done")}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">{m.description}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" aria-hidden="true" />
                        {t("academy.minutes", { n: m.estimated_minutes })}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{lessonsLabel}</span>
                      {m.total > 0 && m.done > 0 && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-primary">{t("academy.progressComplete", { done: m.done, total: m.total })}</span>
                        </>
                      )}
                      <ArrowRight className="h-3.5 w-3.5 ml-auto text-primary" aria-hidden="true" />
                    </div>
                    {m.total > 0 && (
                      <div className="mt-3 h-1.5 rounded-full bg-secondary overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
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
