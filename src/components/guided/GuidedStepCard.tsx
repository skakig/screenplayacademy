import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sparkles, Check, ArrowRight, Copy } from "lucide-react";
import { toast } from "sonner";
import {
  updateGuidedStep,
  aiGenerateLoglineOptions,
  aiGenerateThemeOptions,
  aiCreateProtagonistFromLesson,
  aiCreateAntagonistFromLesson,
  aiBuildStoryArcFromLesson,
  aiCreateSceneListFromLesson,
  aiDiagnoseBeginnerScript,
  aiGenerateRewriteExercise,
} from "@/lib/academy.functions";
import type { GuidedStepMeta } from "./stepMeta";

type Step = {
  id: string;
  step_key: string;
  title: string;
  status: string;
  user_output: string | null;
  order_index: number;
};

const AI_HELPERS = {
  logline: aiGenerateLoglineOptions,
  theme: aiGenerateThemeOptions,
  protagonist: aiCreateProtagonistFromLesson,
  antagonist: aiCreateAntagonistFromLesson,
  arc: aiBuildStoryArcFromLesson,
  scenes: aiCreateSceneListFromLesson,
  diagnose: aiDiagnoseBeginnerScript,
  rewrite: aiGenerateRewriteExercise,
} as const;

export function GuidedStepCard({
  step,
  meta,
  index,
  projectId,
  projectContext,
}: {
  step: Step;
  meta: GuidedStepMeta;
  index: number;
  projectId: string;
  projectContext: string;
}) {
  const qc = useQueryClient();
  const [notes, setNotes] = useState(step.user_output ?? "");
  const [aiOutput, setAiOutput] = useState<string>("");
  const updateFn = useServerFn(updateGuidedStep);
  const aiFn = useServerFn(meta.aiHelper ? AI_HELPERS[meta.aiHelper] : aiGenerateLoglineOptions);

  const saveAndComplete = useMutation({
    mutationFn: () =>
      updateFn({
        data: {
          projectId,
          stepKey: step.step_key,
          status: "complete",
          user_output: notes || aiOutput || null,
        },
      }),
    onSuccess: () => {
      toast.success("Step complete");
      qc.invalidateQueries({ queryKey: ["first-screenplay", projectId] });
    },
    onError: (e: any) => toast.error(e.message ?? "Could not save"),
  });

  const saveDraft = useMutation({
    mutationFn: () =>
      updateFn({
        data: { projectId, stepKey: step.step_key, user_output: notes },
      }),
    onSuccess: () => toast.success("Draft saved"),
  });

  const runAi = useMutation({
    mutationFn: () =>
      aiFn({ data: { prompt: notes || meta.task, context: projectContext } }),
    onSuccess: (res: any) => {
      setAiOutput(res.text);
      if (res.demo) toast.message("Demo output — connect AI for live results.");
    },
    onError: (e: any) => toast.error(e.message ?? "AI failed"),
  });

  const isLocked = step.status === "locked";
  const isComplete = step.status === "complete";

  return (
    <Card className={`p-5 ${isComplete ? "border-primary/30 bg-primary/5" : "border-border/60"}`}>
      <div className="flex items-start gap-3 mb-4">
        <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${isComplete ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"}`}>
          {isComplete ? <Check className="h-4 w-4" /> : <span className="text-xs font-semibold">{index + 1}</span>}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-display text-lg font-semibold">{step.title}</h3>
          <p className="text-sm text-muted-foreground mt-0.5">{meta.concept}</p>
        </div>
      </div>

      {!isLocked && (
        <div className="space-y-3 pl-11">
          <div className="grid sm:grid-cols-2 gap-3 text-xs">
            <div className="rounded-md border border-border/40 bg-card/30 p-3">
              <div className="uppercase text-[10px] tracking-wider text-muted-foreground mb-1">Why it matters</div>
              <p className="text-foreground/80">{meta.why}</p>
            </div>
            <div className="rounded-md border border-border/40 bg-card/30 p-3">
              <div className="uppercase text-[10px] tracking-wider text-muted-foreground mb-1">Example</div>
              <p className="text-foreground/80 italic">{meta.example}</p>
            </div>
          </div>

          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5">Your task</div>
            <p className="text-sm mb-2">{meta.task}</p>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Write your answer, notes, or paste in something to refine…"
              className="text-sm min-h-[100px]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {meta.aiHelper && (
              <Button size="sm" variant="outline" onClick={() => runAi.mutate()} disabled={runAi.isPending}>
                {runAi.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5" />}
                {meta.aiLabel ?? "Help me"}
              </Button>
            )}
            {meta.destination && (
              <Button asChild size="sm" variant="outline">
                <Link
                  to={
                    meta.destination === "editor" ? "/editor/$projectId" :
                    meta.destination === "characters" ? "/characters/$projectId" :
                    meta.destination === "story-arc" ? "/story-arc/$projectId" :
                    meta.destination === "scenes" ? "/scenes/$projectId" :
                    meta.destination === "pitch" ? "/pitch/$projectId" :
                    "/tableread/$projectId"
                  }
                  params={{ projectId }}
                >
                  Open {meta.destination} <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                </Link>
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => saveDraft.mutate()} disabled={saveDraft.isPending}>
              Save draft
            </Button>
            <Button
              size="sm"
              className="ml-auto"
              onClick={() => saveAndComplete.mutate()}
              disabled={saveAndComplete.isPending}
            >
              {saveAndComplete.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Check className="h-3.5 w-3.5 mr-1.5" />}
              Mark complete
            </Button>
          </div>

          {aiOutput && (
            <div className="rounded-md border border-primary/30 bg-primary/5 p-3 mt-2">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] uppercase tracking-wider text-primary font-semibold">AI suggestion</span>
                <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => { navigator.clipboard.writeText(aiOutput); toast.success("Copied"); }}>
                  <Copy className="h-3 w-3 mr-1" />Copy
                </Button>
              </div>
              <pre className="text-xs whitespace-pre-wrap font-sans text-foreground/85">{aiOutput}</pre>
            </div>
          )}
        </div>
      )}

      {isLocked && (
        <p className="pl-11 text-xs text-muted-foreground italic">Complete the previous step to unlock.</p>
      )}
    </Card>
  );
}
