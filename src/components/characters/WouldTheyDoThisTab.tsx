import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Scale, Info, ChevronDown, ChevronRight } from "lucide-react";
import {
  evaluateActionFit,
  evaluateDialogueFit,
  type CharacterTruthResult,
} from "@/lib/story-intelligence/characterTruthEngine";
import { normalizeSceneStateForTruthEngine } from "@/lib/story-intelligence/sceneStateAdapter";
import {
  createTruthCoachOutput,
  type CoachingLevel,
  type TruthCoachOutput,
} from "@/lib/story-intelligence/truthCoach";

type Mode = "basic" | "advanced";

export function WouldTheyDoThisTab({
  projectId,
  character,
  mode = "advanced",
  coachingLevel = null,
  writerExperienceLevel = null,
}: {
  projectId: string;
  character: any;
  /** Explicit mode wins. Default to advanced (never Focus — Focus hides the tab). */
  mode?: Mode;
  coachingLevel?: CoachingLevel | null;
  writerExperienceLevel?: string | null;
}) {
  const [kind, setKind] = useState<"action" | "dialogue">("action");
  const [sceneId, setSceneId] = useState<string>("");
  const [text, setText] = useState("");
  const [result, setResult] = useState<CharacterTruthResult | null>(null);
  const [showEvidence, setShowEvidence] = useState(false);

  const { data: scenes = [] } = useQuery<any[]>({
    queryKey: ["truth-scenes", projectId],
    queryFn: async () =>
      (await supabase.from("scenes").select("id,title,order_index").eq("project_id", projectId).order("order_index")).data ?? [],
  });

  const { data: relationships = [] } = useQuery<any[]>({
    enabled: !!character?.id,
    queryKey: ["truth-relationships", character?.id],
    queryFn: async () =>
      (await supabase
        .from("character_relationships")
        .select("*")
        .eq("character_id", character.id)).data ?? [],
  });

  const { data: sceneStates = [] } = useQuery<any[]>({
    enabled: !!character?.id,
    queryKey: ["truth-scene-states", character?.id],
    queryFn: async () =>
      (await supabase
        .from("character_scene_states")
        .select("*")
        .eq("character_id", character.id)).data ?? [],
  });

  const { data: arc } = useQuery<any>({
    enabled: !!character?.id,
    queryKey: ["truth-arc", character?.id],
    queryFn: async () =>
      (await supabase
        .from("character_arcs")
        .select("*")
        .eq("character_id", character.id)
        .maybeSingle()).data ?? null,
  });

  const { data: sceneBeat = null } = useQuery<any>({
    enabled: !!sceneId,
    queryKey: ["truth-scene-beat", sceneId],
    queryFn: async () =>
      (await supabase
        .from("scene_arc_beats")
        .select("*")
        .eq("scene_id", sceneId)
        .limit(1)
        .maybeSingle()).data ?? null,
  });

  const sceneState = useMemo(
    () => (sceneId ? sceneStates.find((s: any) => s.scene_id === sceneId) : null),
    [sceneId, sceneStates],
  );

  const analyze = () => {
    if (!character) return;
    const normalized = normalizeSceneStateForTruthEngine(sceneState, sceneBeat);
    const ctx = { sceneState: normalized, relationships, arc };
    const r = kind === "action"
      ? evaluateActionFit(character, text, ctx)
      : evaluateDialogueFit(character, text, ctx);
    setResult(r);
  };

  const coach: TruthCoachOutput | null = useMemo(
    () =>
      result
        ? createTruthCoachOutput(result, {
            mode,
            coachingLevel,
            writerExperienceLevel,
          })
        : null,
    [result, mode, coachingLevel, writerExperienceLevel],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-md bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
          <Scale className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0">
          <h3 className="font-display text-lg leading-tight">Truth Check</h3>
          <p className="text-xs text-muted-foreground">
            Would <span className="font-medium">{character?.name || "this character"}</span> say or do this?
            A first-pass check based only on the character data you've filled in — not AI.
          </p>
        </div>
      </div>

      <Card className="p-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-xs">Optional scene context</Label>
            <Select value={sceneId || "none"} onValueChange={(v) => setSceneId(v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="No scene selected" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— No scene —</SelectItem>
                {scenes.map((s: any) => (
                  <SelectItem key={s.id} value={s.id}>{s.title || `Scene ${s.order_index ?? ""}`}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">What are you checking?</Label>
            <RadioGroup value={kind} onValueChange={(v) => setKind(v as any)} className="flex items-center gap-4 mt-2">
              <label className="flex items-center gap-1.5 text-sm">
                <RadioGroupItem value="action" />Action
              </label>
              <label className="flex items-center gap-1.5 text-sm">
                <RadioGroupItem value="dialogue" />Dialogue
              </label>
            </RadioGroup>
          </div>
        </div>
        <div>
          <Label className="text-xs">
            {kind === "action" ? "Describe what they do" : "Paste the line"}
          </Label>
          <Textarea
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              kind === "action"
                ? "e.g. HANS quietly hands the informant's name to the officer."
                : "e.g. \"I trusted you. That was my mistake.\""
            }
          />
        </div>
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Info className="h-3 w-3" /> Analyzes only. Never edits your character or screenplay.
          </p>
          <Button onClick={analyze} disabled={!text.trim() || !character}>
            <Scale className="h-3.5 w-3.5 mr-1.5" />Analyze
          </Button>
        </div>
      </Card>

      {result && coach && (
        <ResultCard
          result={result}
          coach={coach}
          showEvidence={showEvidence}
          setShowEvidence={setShowEvidence}
        />
      )}
    </div>
  );
}

function ResultCard({
  result,
  coach,
  showEvidence,
  setShowEvidence,
}: {
  result: CharacterTruthResult;
  coach: TruthCoachOutput;
  showEvidence: boolean;
  setShowEvidence: (v: boolean) => void;
}) {
  const verdictLabel = {
    fits: "Fits",
    strained: "Strained",
    contradicts: "Contradicts",
    insufficient_data: "Not enough data",
  }[result.verdict];

  const verdictTone = {
    fits: "bg-emerald-500/15 text-emerald-600 border-emerald-500/40",
    strained: "bg-amber-500/15 text-amber-600 border-amber-500/40",
    contradicts: "bg-destructive/15 text-destructive border-destructive/40",
    insufficient_data: "bg-secondary text-muted-foreground border-border",
  }[result.verdict];

  const isQuiet = coach.tone === "quiet";
  const reasonsToShow = result.reasons.slice(0, coach.maxReasons);
  const missingCap = coach.maxMissingInputs;

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center flex-wrap gap-2">
        <Badge variant="outline" className={verdictTone}>{verdictLabel}</Badge>
        <span className="text-[11px] text-muted-foreground">
          confidence: <span className="tabular-nums">{result.confidence}</span>
        </span>
      </div>

      {!isQuiet && (
        <div className="space-y-1">
          <div className="text-sm font-medium">{coach.headline}</div>
          {coach.explanation && (
            <p className="text-sm text-muted-foreground">{coach.explanation}</p>
          )}
        </div>
      )}

      {!isQuiet && coach.teachingPrompt && (
        <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
          {coach.concept && (
            <div className="text-[10px] uppercase tracking-wide text-primary/80 mb-1">
              {coach.concept}
            </div>
          )}
          <div className="text-sm">{coach.teachingPrompt}</div>
        </div>
      )}

      {!isQuiet && reasonsToShow.length > 0 && (
        <div>
          <div className="text-xs font-medium mb-1">Why</div>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-4">
            {reasonsToShow.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      {coach.showSuggestedFixes && result.suggestedFixes.length > 0 && (
        <div>
          <div className="text-xs font-medium mb-1">Suggested adjustment</div>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-4">
            {result.suggestedFixes.map((f, i) => (<li key={i}>{f}</li>))}
          </ul>
        </div>
      )}

      {!isQuiet && result.missingInputs.length > 0 && !coach.teachingPrompt && missingCap > 0 && (
        <div>
          <div className="text-xs font-medium mb-1">
            {coach.tone === "teaching" ? "To sharpen this, tell me:" : "Missing"}
          </div>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-4">
            {result.missingInputs.slice(0, missingCap).map((m) => (
              <li key={m.field}>{m.prompt}</li>
            ))}
          </ul>
        </div>
      )}

      {!isQuiet && coach.nextStep && (
        <div className="text-xs text-foreground/80 border-t border-border pt-2">
          <span className="font-medium">Next step: </span>
          {coach.nextStep}
        </div>
      )}

      {coach.showEvidence && result.evidence.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowEvidence(!showEvidence)}
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            {showEvidence ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            Evidence used ({result.evidence.length})
          </button>
          {showEvidence && (
            <ul className="mt-2 text-[11px] text-muted-foreground space-y-0.5 font-mono">
              {result.evidence.map((e, i) => (
                <li key={i}>
                  <span className="text-primary/70">{e.source}</span>.{e.field}
                  {e.value != null && <span className="text-muted-foreground/70"> — {String(e.value).slice(0, 60)}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}
