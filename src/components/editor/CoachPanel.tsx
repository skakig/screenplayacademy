import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sparkles, X, ChevronDown, ChevronUp, Compass, GraduationCap, Wrench, BookOpen } from "lucide-react";
import { useCoachMode } from "@/hooks/use-coach-mode";
import { aiCoachCurrentScene, aiNextStepHint, aiExplainScreenplayConcept } from "@/lib/academy.functions";

// Lightweight concept → academy lesson router (best-effort)
const CONCEPT_LESSONS: { match: RegExp; module: string; lesson: string; label: string }[] = [
  { match: /scene heading|slug|int\.|ext\./i, module: "foundations", lesson: "slugline", label: "Sluglines (scene headings)" },
  { match: /subtext|on[- ]the[- ]nose/i, module: "scene-craft", lesson: "subtext", label: "Subtext in dialogue" },
  { match: /character arc|change|transformation/i, module: "character-creation", lesson: "character-arcs", label: "Character arcs" },
  { match: /three act|3 act|act structure/i, module: "story-architecture", lesson: "three-act", label: "Three-act structure" },
  { match: /midpoint/i, module: "story-architecture", lesson: "midpoint", label: "The midpoint" },
  { match: /inciting/i, module: "story-architecture", lesson: "inciting-incident", label: "Inciting incident" },
  { match: /want|need|goal/i, module: "character-creation", lesson: "want-vs-need", label: "Want vs need" },
  { match: /logline/i, module: "foundations", lesson: "logline", label: "Logline" },
  { match: /scene goal|conflict|turn/i, module: "scene-craft", lesson: "scene-goal-conflict-turn", label: "Scene: goal, conflict, turn" },
];
function lessonForConcept(concept: string) {
  return CONCEPT_LESSONS.find((c) => c.match.test(concept)) ?? null;
}

export function CoachPanel({
  sceneText,
  blockCount = 0,
  activeStep,
}: {
  sceneText: string;
  blockCount?: number;
  activeStep?: string;
}) {
  const { level, enabled } = useCoachMode();
  const [collapsed, setCollapsed] = useState(level === "gentle");
  const [dismissed, setDismissed] = useState(false);
  const [output, setOutput] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [mode, setMode] = useState<"fix" | "teach">("fix");
  const [teachQuery, setTeachQuery] = useState("");
  const [teachConcept, setTeachConcept] = useState<string | null>(null);
  const coachFn = useServerFn(aiCoachCurrentScene);
  const hintFn = useServerFn(aiNextStepHint);
  const teachFn = useServerFn(aiExplainScreenplayConcept);

  const run = useMutation({
    mutationFn: () =>
      coachFn({
        data: {
          sceneText: sceneText.slice(0, 16000),
          level: level === "off" ? "gentle" : level,
        },
      }),
    onSuccess: (r) => setOutput(r.text),
  });

  const teach = useMutation({
    mutationFn: (concept: string) => teachFn({ data: { concept } }),
    onSuccess: (r) => setOutput(r.text),
  });

  const nextStep = useMutation({
    mutationFn: () =>
      hintFn({
        data: {
          sceneText: sceneText.slice(-6000),
          activeStep,
          blockCount,
        },
      }),
    onSuccess: (r) => setHint(r.text),
  });

  // Auto-coach on active/teaching when scene changes (debounced) — only in Fix mode
  useEffect(() => {
    if (mode !== "fix") return;
    if (!enabled || level === "gentle") return;
    if (!sceneText || sceneText.length < 200) return;
    const t = setTimeout(() => run.mutate(), 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneText, level, mode]);

  // Suggestion heuristic for gentle mode (no AI call required)
  const localHint = (() => {
    if (blockCount === 0) return "Add a scene heading to start (try INT. KITCHEN — NIGHT).";
    const hasHeading = /\[scene_heading\]/.test(sceneText);
    const hasAction = /\[action\]/.test(sceneText);
    const hasDialogue = /\[dialogue\]/.test(sceneText);
    if (!hasHeading) return "Add a scene heading so we know where we are.";
    if (!hasAction) return "Describe what we see — add a line of action.";
    if (!hasDialogue) return "Who's in this scene? Add a character and a line of dialogue.";
    return "Strong start. Add the next scene heading to keep moving.";
  })();

  const lesson = teachConcept ? lessonForConcept(teachConcept) : null;

  if (!enabled || dismissed) return null;


  return (
    <Card className="p-3 border-primary/20 bg-primary/5">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-semibold uppercase tracking-wide text-primary">Director's Chair</span>
        <span className="text-[10px] text-muted-foreground capitalize">· {level}</span>
        <div className="ml-auto flex items-center gap-1">
          {/* Fix / Teach toggle */}
          <div className="flex items-center rounded-md border border-border/60 bg-background/40 p-0.5 mr-1">
            <button
              className={`text-[10px] px-1.5 py-0.5 rounded-sm flex items-center gap-1 ${mode === "fix" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => { setMode("fix"); setOutput(null); }}
              title="Get craft feedback on your scene"
            >
              <Wrench className="h-2.5 w-2.5" /> Fix
            </button>
            <button
              className={`text-[10px] px-1.5 py-0.5 rounded-sm flex items-center gap-1 ${mode === "teach" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => { setMode("teach"); setOutput(null); }}
              title="Ask the Director's Chair to explain a screenwriting concept"
            >
              <GraduationCap className="h-2.5 w-2.5" /> Teach
            </button>
          </div>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
          </Button>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setDismissed(true)}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      {!collapsed && mode === "fix" && (
        <div className="space-y-2">
          <div className="rounded-md bg-background/60 border border-border/40 p-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Suggested next step</p>
            <p className="text-xs text-foreground/90">{hint ?? localHint}</p>
            <Button
              size="sm"
              variant="outline"
              className="mt-2 h-7 text-xs w-full"
              onClick={() => nextStep.mutate()}
              disabled={nextStep.isPending}
            >
              <Compass className="h-3.5 w-3.5 mr-1.5" />
              {nextStep.isPending ? "Thinking…" : "What should I do next?"}
            </Button>
          </div>
          {level !== "gentle" && (
            <>
              {output ? (
                <div className="text-xs whitespace-pre-wrap text-foreground/85">{output}</div>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="text-xs text-muted-foreground">{run.isPending ? "Reading…" : "Get a take on this scene."}</p>
                  <Button size="sm" variant="outline" className="ml-auto h-7 text-xs" onClick={() => run.mutate()} disabled={run.isPending || !sceneText}>
                    Director's notes
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      )}
      {!collapsed && mode === "teach" && (
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Ask the Director's Chair</p>
          <div className="flex gap-1.5">
            <Input
              value={teachQuery}
              onChange={(e) => setTeachQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && teachQuery.trim()) {
                  setTeachConcept(teachQuery.trim());
                  teach.mutate(teachQuery.trim());
                }
              }}
              placeholder="e.g. subtext, midpoint, character arc"
              className="h-7 text-xs"
            />
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs whitespace-nowrap"
              onClick={() => { if (teachQuery.trim()) { setTeachConcept(teachQuery.trim()); teach.mutate(teachQuery.trim()); } }}
              disabled={teach.isPending || !teachQuery.trim()}
            >
              {teach.isPending ? "…" : "Explain"}
            </Button>
          </div>
          <div className="flex flex-wrap gap-1">
            {["Subtext", "Midpoint", "Character arc", "Want vs need", "Theme"].map((c) => (
              <button
                key={c}
                onClick={() => { setTeachQuery(c); setTeachConcept(c); teach.mutate(c); }}
                className="text-[10px] px-1.5 py-0.5 rounded border border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                {c}
              </button>
            ))}
          </div>
          {output && (
            <div className="rounded-md bg-background/60 border border-border/40 p-2 space-y-2">
              <div className="text-xs whitespace-pre-wrap text-foreground/85">{output}</div>
              {lesson && (
                <Link
                  to="/academy/$moduleSlug/$lessonSlug"
                  params={{ moduleSlug: lesson.module, lessonSlug: lesson.lesson }}
                  className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                >
                  <BookOpen className="h-3 w-3" />
                  Open lesson: {lesson.label}
                </Link>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
