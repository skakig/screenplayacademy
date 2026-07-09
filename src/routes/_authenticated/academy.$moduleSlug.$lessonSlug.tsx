import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { LessonView } from "@/components/academy/Lesson";
import { ArrowLeft } from "lucide-react";
import { t } from "@/lib/i18n/t";
import {
  aiGenerateLoglineOptions,
  aiGenerateThemeOptions,
  aiExplainScreenplayConcept,
  aiCreateProtagonistFromLesson,
} from "@/lib/academy.functions";

export const Route = createFileRoute("/_authenticated/academy/$moduleSlug/$lessonSlug")({
  head: ({ params }) => ({ meta: [{ title: `${params.lessonSlug} — Academy` }] }),
  component: LessonPage,
});

const AI_FOR_SLUG: Record<string, "logline" | "theme" | "concept" | "protagonist"> = {
  logline: "logline",
  "create-your-logline": "logline",
  "find-your-theme": "theme",
  "create-your-protagonist": "protagonist",
};

function LessonPage() {
  const { moduleSlug, lessonSlug } = Route.useParams();
  const loglineFn = useServerFn(aiGenerateLoglineOptions);
  const themeFn = useServerFn(aiGenerateThemeOptions);
  const conceptFn = useServerFn(aiExplainScreenplayConcept);
  const protagonistFn = useServerFn(aiCreateProtagonistFromLesson);

  const { data: lesson, isLoading } = useQuery({
    queryKey: ["lesson", moduleSlug, lessonSlug],
    queryFn: async () => {
      const { data: mod } = await supabase.from("academy_modules").select("id, title").eq("slug", moduleSlug).maybeSingle();
      if (!mod) return null;
      const { data } = await supabase
        .from("academy_lessons")
        .select("*")
        .eq("module_id", mod.id)
        .eq("slug", lessonSlug)
        .maybeSingle();
      return data;
    },
  });

  if (isLoading) return <AppShell><div className="p-10 text-muted-foreground">Loading…</div></AppShell>;
  if (!lesson) return <AppShell><div className="p-10">Lesson not found.</div></AppShell>;

  const aiKind = AI_FOR_SLUG[lessonSlug];

  const onAIAssist = async (input: string) => {
    if (aiKind === "logline") {
      const r = await loglineFn({ data: { prompt: input } });
      return r.text;
    }
    if (aiKind === "theme") {
      const r = await themeFn({ data: { prompt: input } });
      return r.text;
    }
    if (aiKind === "protagonist") {
      const r = await protagonistFn({ data: { prompt: input } });
      return r.text;
    }
    const r = await conceptFn({ data: { concept: lesson.title } });
    return r.text;
  };

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto px-4 py-10">
        <Link to="/academy/$moduleSlug" params={{ moduleSlug }} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4">
          <ArrowLeft className="h-3 w-3" /> Back to module
        </Link>
        <LessonView lesson={lesson} onAIAssist={onAIAssist} />
      </div>
    </AppShell>
  );
}
