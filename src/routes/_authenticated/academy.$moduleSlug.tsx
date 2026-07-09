import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Check, ArrowLeft, Clock, BookOpen } from "lucide-react";
import { t } from "@/lib/i18n/t";

export const Route = createFileRoute("/_authenticated/academy/$moduleSlug")({
  head: ({ params }) => ({ meta: [{ title: `${params.moduleSlug} — Academy` }] }),
  component: ModulePage,
});

function ModulePage() {
  const { moduleSlug } = Route.useParams();

  const { data, isLoading } = useQuery({
    queryKey: ["module-lessons", moduleSlug],
    queryFn: async () => {
      const { data: mod } = await supabase.from("academy_modules").select("*").eq("slug", moduleSlug).maybeSingle();
      if (!mod) return null;
      const { data: lessons = [] } = await supabase
        .from("academy_lessons")
        .select("*")
        .eq("module_id", mod.id)
        .order("order_index");
      const { data: u } = await supabase.auth.getUser();
      const { data: progress = [] } = u.user
        ? await supabase.from("user_lesson_progress").select("lesson_id, status").eq("user_id", u.user.id)
        : { data: [] };
      const completed = new Set((progress ?? []).filter((p: { status: string }) => p.status === "complete").map((p: { lesson_id: string }) => p.lesson_id));
      return { mod, lessons: lessons ?? [], completed };
    },
  });

  if (isLoading) return <AppShell><div className="p-10 text-muted-foreground">{t("academy.loading")}</div></AppShell>;
  if (!data) return <AppShell><div className="p-10">{t("academy.moduleNotFound")}</div></AppShell>;

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto px-4 py-10">
        <Link to="/academy" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4">
          <ArrowLeft className="h-3 w-3" aria-hidden="true" /> {t("academy.back")}
        </Link>
        <h1 className="font-display text-3xl font-bold mb-1">{data.mod.title}</h1>
        <p className="text-muted-foreground mb-6">{data.mod.description}</p>

        {data.lessons.length === 0 ? (
          <Card className="p-8 text-center border-dashed">
            <BookOpen className="h-8 w-8 mx-auto text-muted-foreground mb-2" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">{t("academy.comingSoon")}</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {data.lessons.map((l, i) => {
              const done = data.completed.has(l.id);
              return (
                <Link key={l.id} to="/academy/$moduleSlug/$lessonSlug" params={{ moduleSlug, lessonSlug: l.slug }}>
                  <Card className="p-4 hover:border-primary/60 transition cursor-pointer flex items-center gap-3">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold ${done ? "bg-primary/15 text-primary border border-primary/30" : "bg-secondary text-muted-foreground"}`}>
                      {done ? <Check className="h-4 w-4" aria-hidden="true" /> : i + 1}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-sm">{l.title}</div>
                      {l.concept && <div className="text-xs text-muted-foreground line-clamp-1">{l.concept}</div>}
                    </div>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" aria-hidden="true" />
                      {t("academy.minutesShort", { n: l.estimated_minutes })}
                    </span>
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

