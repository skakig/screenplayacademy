import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Check, Sparkles, Save } from "lucide-react";
import { toast } from "sonner";
import { upsertLessonProgress } from "@/lib/academy.functions";
import { t } from "@/lib/i18n/t";

type Lesson = {
  id: string;
  title: string;
  concept: string | null;
  why_it_matters: string | null;
  example: string | null;
  task_prompt: string | null;
  ai_button_label: string | null;
};

export function LessonView({
  lesson,
  onAIAssist,
  onSaveToProject,
}: {
  lesson: Lesson;
  onAIAssist?: (userInput: string) => Promise<string>;
  onSaveToProject?: (userInput: string) => Promise<void>;
}) {
  const qc = useQueryClient();
  const upsertFn = useServerFn(upsertLessonProgress);
  const [userInput, setUserInput] = useState("");
  const [aiOutput, setAiOutput] = useState<string | null>(null);

  const { data: progress } = useQuery({
    queryKey: ["lesson-progress", lesson.id],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase
        .from("user_lesson_progress")
        .select("*")
        .eq("user_id", u.user.id)
        .eq("lesson_id", lesson.id)
        .maybeSingle();
      if (data?.user_output) setUserInput(data.user_output);
      return data;
    },
  });

  const aiRun = useMutation({
    mutationFn: async () => {
      if (!onAIAssist) return "";
      return onAIAssist(userInput);
    },
    onSuccess: (text) => setAiOutput(text),
    onError: (e: Error) => toast.error(e.message),
  });

  const save = useMutation({
    mutationFn: () => upsertFn({ data: { lessonId: lesson.id, status: "in_progress", user_output: userInput } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lesson-progress", lesson.id] });
      toast.success(t("academy.toast.saved"));
    },
  });

  const markComplete = useMutation({
    mutationFn: () => upsertFn({ data: { lessonId: lesson.id, status: "complete", user_output: userInput } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lesson-progress", lesson.id] });
      qc.invalidateQueries({ queryKey: ["module-lessons"] });
      toast.success(t("academy.toast.lessonComplete"));
    },
  });

  const saveToProj = useMutation({
    mutationFn: async () => {
      if (!onSaveToProject) return;
      await onSaveToProject(aiOutput ?? userInput);
    },
    onSuccess: () => toast.success(t("academy.toast.savedToProject")),
    onError: (e: Error) => toast.error(e.message),
  });

  const isComplete = progress?.status === "complete";

  return (
    <Card className="p-6 space-y-5">
      <div className="flex items-start justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">{lesson.title}</h1>
        {isComplete && <Badge className="bg-primary/15 text-primary border-primary/30"><Check className="h-3 w-3 mr-1" />Complete</Badge>}
      </div>

      {lesson.concept && (
        <section>
          <h3 className="text-xs uppercase tracking-wide text-muted-foreground mb-1.5">Concept</h3>
          <p className="text-sm">{lesson.concept}</p>
        </section>
      )}

      {lesson.why_it_matters && (
        <section>
          <h3 className="text-xs uppercase tracking-wide text-muted-foreground mb-1.5">Why it matters</h3>
          <p className="text-sm text-foreground/85">{lesson.why_it_matters}</p>
        </section>
      )}

      {lesson.example && (
        <section className="p-3 rounded-md bg-secondary/40 border border-border/40">
          <h3 className="text-xs uppercase tracking-wide text-muted-foreground mb-1.5">Example</h3>
          <p className="text-sm italic">{lesson.example}</p>
        </section>
      )}

      {lesson.task_prompt && (
        <section>
          <h3 className="text-xs uppercase tracking-wide text-muted-foreground mb-1.5">Try it now</h3>
          <p className="text-sm text-muted-foreground mb-2">{lesson.task_prompt}</p>
          <Textarea rows={5} value={userInput} onChange={(e) => setUserInput(e.target.value)} placeholder="Write here…" />
        </section>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => save.mutate()} disabled={!userInput || save.isPending}>
          <Save className="h-3.5 w-3.5 mr-1.5" />Save draft
        </Button>
        {onAIAssist && lesson.ai_button_label && (
          <Button size="sm" onClick={() => aiRun.mutate()} disabled={!userInput || aiRun.isPending}>
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            {aiRun.isPending ? "Thinking…" : lesson.ai_button_label}
          </Button>
        )}
        <div className="ml-auto" />
        <Button size="sm" variant={isComplete ? "secondary" : "default"} onClick={() => markComplete.mutate()} disabled={markComplete.isPending}>
          <Check className="h-3.5 w-3.5 mr-1.5" />{isComplete ? "Marked complete" : "Mark complete"}
        </Button>
      </div>

      {aiOutput && (
        <Card className="p-4 bg-primary/5 border-primary/20 whitespace-pre-wrap text-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs uppercase tracking-wide text-primary font-semibold">AI suggestion</div>
            {onSaveToProject && (
              <Button size="sm" variant="ghost" onClick={() => saveToProj.mutate()} disabled={saveToProj.isPending}>
                Use in project
              </Button>
            )}
          </div>
          {aiOutput}
        </Card>
      )}
    </Card>
  );
}
