import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sparkles, Check, ArrowRight, Copy, Save, FileInput, Lock, RefreshCw, Wand2 } from "lucide-react";
import { toast } from "sonner";
import {
  updateGuidedStep,
  applyStepOutput,
  saveStepVersion,
  aiGenerateLoglineOptions,
  aiGenerateThemeOptions,
  aiCreateProtagonistFromLesson,
  aiCreateAntagonistFromLesson,
  aiBuildStoryArcFromLesson,
  aiCreateSceneListFromLesson,
  aiDiagnoseBeginnerScript,
  aiGenerateRewriteExercise,
  aiDraftOpeningScene,
  aiOutlineAct1Beats,
} from "@/lib/academy.functions";
import type { GuidedStepMeta } from "./stepMeta";
import { StepVersionHistory } from "./StepVersionHistory";

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
  openingScene: aiDraftOpeningScene,
  act1Beats: aiOutlineAct1Beats,
} as const;

const EDITOR_STEPS = new Set(["opening_scene", "act1", "rough_draft"]);
const APPLIABLE_STEPS = new Set([
  "logline", "protagonist", "antagonist", "theme", "story_arc",
  "scene_cards", "opening_scene", "act1", "midpoint", "rough_draft",
]);

function friendlyError(err: unknown): string {
  const msg = String((err as { message?: string })?.message ?? err ?? "");
  if (/rate limit|429/i.test(msg)) return "AI is busy right now — try again in a few seconds.";
  if (/credit|402/i.test(msg)) return "AI credits exhausted. Add credits in workspace settings to keep going.";
  if (/parse|json/i.test(msg)) return "Couldn't read the AI output cleanly. Try regenerating, or paste your own answer.";
  if (/Nothing to apply/i.test(msg)) return "Write your answer or run the AI helper first.";
  return msg || "Something went wrong. Please try again.";
}

export function GuidedStepCard({
  step,
  meta,
  index,
  projectId,
  projectContext,
  autoCompleted,
}: {
  step: Step;
  meta: GuidedStepMeta;
  index: number;
  projectId: string;
  projectContext: string;
  autoCompleted?: boolean;
}) {
  const qc = useQueryClient();
  const [notes, setNotes] = useState(step.user_output ?? "");
  const [aiOutput, setAiOutput] = useState<string>("");
  const cardRef = useRef<HTMLDivElement>(null);
  const updateFn = useServerFn(updateGuidedStep);
  const applyFn = useServerFn(applyStepOutput);
  const versionFn = useServerFn(saveStepVersion);
  const aiFn = useServerFn(meta.aiHelper ? AI_HELPERS[meta.aiHelper] : aiGenerateLoglineOptions);

  // Scroll-into-view if URL hash targets this step
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash === `#step-${step.step_key}`) {
      cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [step.step_key]);

  const recordVersion = (content: string, source: "manual" | "ai" | "applied", label?: string) => {
    if (!content?.trim()) return;
    versionFn({ data: { projectId, stepKey: step.step_key, content, source, label } })
      .then(() => qc.invalidateQueries({ queryKey: ["step-versions", projectId, step.step_key] }))
      .catch(() => { /* non-blocking */ });
  };

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["first-screenplay", projectId] });
    qc.invalidateQueries({ queryKey: ["blocks", projectId] });
    qc.invalidateQueries({ queryKey: ["scenes", projectId] });
    qc.invalidateQueries({ queryKey: ["characters", projectId] });
    qc.invalidateQueries({ queryKey: ["story-arc", projectId] });
    qc.invalidateQueries({ queryKey: ["project", projectId] });
  };

  const draftToUse = () => (notes.trim() || aiOutput.trim());
  const hasContent = !!draftToUse();

  const apply = useMutation({
    mutationFn: async (insertIntoEditor: boolean) => {
      const text = draftToUse();
      if (!text) throw new Error("Nothing to apply yet — write notes or run the AI helper first.");
      const res = await applyFn({ data: { projectId, stepKey: step.step_key, text, insertIntoEditor } });
      recordVersion(text, "applied", insertIntoEditor ? "Applied + editor" : "Applied to project");
      return res;
    },
    onSuccess: (r: { summary?: string }) => {
      toast.success(r.summary ?? "Applied");
      invalidateAll();
    },
    onError: (e: unknown) => toast.error(friendlyError(e)),
  });

  const acceptAndApply = useMutation({
    mutationFn: async () => {
      // Combo: use AI as answer, apply, mark complete
      const text = aiOutput.trim() || notes.trim();
      if (!text) throw new Error("Nothing to apply yet — run the AI helper first.");
      setNotes(text);
      if (APPLIABLE_STEPS.has(step.step_key)) {
        await applyFn({
          data: { projectId, stepKey: step.step_key, text, insertIntoEditor: EDITOR_STEPS.has(step.step_key) },
        });
        recordVersion(text, "applied", "Accept & apply");
      }
      await updateFn({
        data: { projectId, stepKey: step.step_key, status: "complete", user_output: text },
      });
    },
    onSuccess: () => {
      toast.success("Saved and step complete");
      invalidateAll();
    },
    onError: (e: unknown) => toast.error(friendlyError(e)),
  });

  const saveAndComplete = useMutation({
    mutationFn: async () => {
      const text = draftToUse();
      if (APPLIABLE_STEPS.has(step.step_key) && !text) {
        throw new Error("Write your answer or run the AI helper first.");
      }
      if (text && APPLIABLE_STEPS.has(step.step_key)) {
        await applyFn({
          data: {
            projectId,
            stepKey: step.step_key,
            text,
            insertIntoEditor: EDITOR_STEPS.has(step.step_key),
          },
        });
      }
      await updateFn({
        data: { projectId, stepKey: step.step_key, status: "complete", user_output: text || null },
      });
    },
    onSuccess: () => {
      toast.success("Step complete");
      invalidateAll();
    },
    onError: (e: unknown) => toast.error(friendlyError(e)),
  });

  const saveDraft = useMutation({
    mutationFn: async () => {
      await updateFn({ data: { projectId, stepKey: step.step_key, user_output: notes } });
      recordVersion(notes, "manual", "Manual draft");
    },
    onSuccess: () => {
      toast.success("Draft saved");
      qc.invalidateQueries({ queryKey: ["first-screenplay", projectId] });
    },
    onError: (e: unknown) => toast.error(friendlyError(e)),
  });

  const runAi = useMutation({
    mutationFn: () =>
      aiFn({ data: { prompt: notes || meta.task, context: projectContext } }),
    onSuccess: (res: { text: string; demo?: boolean }) => {
      setAiOutput(res.text);
      recordVersion(res.text, "ai", meta.aiLabel);
      if (res.demo) toast.message("Demo output — connect AI for live results.");
    },
    onError: (e: unknown) => toast.error(friendlyError(e)),
  });

  const isLocked = step.status === "locked";
  const isComplete = step.status === "complete";
  const canApply = APPLIABLE_STEPS.has(step.step_key);
  const completeDisabled = saveAndComplete.isPending || (canApply && !hasContent);

  return (
    <Card
      ref={cardRef}
      id={`step-${step.step_key}`}
      className={`p-5 scroll-mt-20 ${isComplete ? "border-primary/30 bg-primary/5" : isLocked ? "border-border/40 opacity-75" : "border-border/60"}`}
    >
      <div className="flex items-start gap-3 mb-4">
        <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
          isComplete ? "bg-primary text-primary-foreground"
          : isLocked ? "bg-secondary text-muted-foreground"
          : "bg-secondary text-foreground"
        }`}>
          {isComplete ? <Check className="h-4 w-4" /> :
            isLocked ? <Lock className="h-3.5 w-3.5" /> :
            <span className="text-xs font-semibold">{index + 1}</span>}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-display text-lg font-semibold">{step.title}</h3>
          <p className="text-sm text-muted-foreground mt-0.5">{meta.concept}</p>
          {autoCompleted && isComplete && (
            <p className="text-[11px] text-primary/80 mt-1">✓ Auto-detected from your project</p>
          )}
        </div>
      </div>

      {/* Brief is visible even when locked (read-only) */}
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

        {isLocked ? (
          <div className="rounded-md border border-dashed border-border/50 bg-secondary/30 p-3 text-xs text-muted-foreground flex items-center gap-2">
            <Lock className="h-3.5 w-3.5 shrink-0" />
            <span>Finish step {index} to unlock this one. You can still read the brief above.</span>
          </div>
        ) : (
          <>
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
                <Button asChild size="sm" variant="ghost">
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
                <Save className="h-3.5 w-3.5 mr-1.5" />Save draft
              </Button>
              <StepVersionHistory
                projectId={projectId}
                stepKey={step.step_key}
                onRestore={(content) => setNotes(content)}
              />
              {canApply && (
                <Button size="sm" variant="secondary" onClick={() => apply.mutate(false)} disabled={apply.isPending || !hasContent}>
                  {apply.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <FileInput className="h-3.5 w-3.5 mr-1.5" />}
                  Apply to project
                </Button>
              )}
              <Button
                size="sm"
                className="ml-auto"
                onClick={() => saveAndComplete.mutate()}
                disabled={completeDisabled}
                title={canApply && !hasContent ? "Write something or run the AI helper first" : undefined}
              >
                {saveAndComplete.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Check className="h-3.5 w-3.5 mr-1.5" />}
                Mark complete
              </Button>
            </div>

            {aiOutput && (
              <div className="rounded-md border border-primary/30 bg-primary/5 p-3 mt-2">
                <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
                  <span className="text-[10px] uppercase tracking-wider text-primary font-semibold">AI suggestion</span>
                  <div className="flex flex-wrap gap-1">
                    {canApply && (
                      <Button size="sm" variant="default" className="h-6 text-xs" onClick={() => acceptAndApply.mutate()} disabled={acceptAndApply.isPending}>
                        {acceptAndApply.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Wand2 className="h-3 w-3 mr-1" />}
                        Accept &amp; apply
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setNotes(aiOutput)}>
                      Use as my answer
                    </Button>
                    {meta.aiHelper && (
                      <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => runAi.mutate()} disabled={runAi.isPending}>
                        {runAi.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                        Regenerate
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => { navigator.clipboard.writeText(aiOutput); toast.success("Copied"); }}>
                      <Copy className="h-3 w-3 mr-1" />Copy
                    </Button>
                  </div>
                </div>
                <pre className="text-xs whitespace-pre-wrap font-sans text-foreground/85">{aiOutput}</pre>
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
