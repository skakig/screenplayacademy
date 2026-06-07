import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, Loader2, Wand2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { upsertSceneArc, upsertCharacterSceneArc, deleteCharacterSceneArc, runArcTool } from "@/lib/arc.functions";
import { ArcStatusBadge } from "./ArcStatusBadge";
import { tmhLabel } from "@/components/characters/tmh";

const STORY_BEATS = [
  "Opening Image", "Inciting Incident", "Call to Action", "Act 1 Climax",
  "First Pinch", "Midpoint", "Second Pinch", "All Is Lost", "Dark Night",
  "Act 3 Climax", "Resolution", "Final Image",
];
const ACTS = ["Act 1", "Act 2A", "Act 2B", "Act 3", "Teaser", "Cold Open", "Tag"];
const ARC_MOVES = ["Rise", "Fall", "Regression", "Revelation", "Resistance", "No Change"];

const AI_TOOLS = [
  "Find this scene's turn",
  "Strengthen character movement",
  "Add moral pressure",
  "Connect scene to theme",
  "Raise the stakes",
  "Make the protagonist choose",
  "Pressure the wound",
  "Diagnose weak scene",
  "Suggest stronger ending",
  "Suggest midpoint reversal",
  "Strengthen climax choice",
  "Fix Act 2 sag",
];

export function ArcSidebar({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const [sceneId, setSceneId] = useState<string | null>(null);
  const callArcTool = useServerFn(runArcTool);
  const saveScene = useServerFn(upsertSceneArc);
  const saveCharState = useServerFn(upsertCharacterSceneArc);
  const delCharState = useServerFn(deleteCharacterSceneArc);

  const { data: scenes = [] } = useQuery({
    queryKey: ["scenes", projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from("scenes").select("id, title, scene_heading, order_index").eq("project_id", projectId).order("order_index");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!sceneId && scenes.length > 0) setSceneId(scenes[0].id);
  }, [scenes, sceneId]);

  const { data: beat } = useQuery({
    queryKey: ["scene-arc", sceneId],
    enabled: !!sceneId,
    queryFn: async () => {
      const { data } = await supabase.from("scene_arc_beats").select("*").eq("scene_id", sceneId!).maybeSingle();
      return data;
    },
  });

  const { data: characters = [] } = useQuery({
    queryKey: ["characters-lite", projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from("characters").select("id, name, role, tmh_baseline").eq("project_id", projectId).order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: charStates = [] } = useQuery({
    queryKey: ["char-arc-states", sceneId],
    enabled: !!sceneId,
    queryFn: async () => {
      const { data } = await supabase.from("character_scene_arc_states").select("*").eq("scene_id", sceneId!);
      return data || [];
    },
  });

  const persist = useMutation({
    mutationFn: async (patch: Record<string, any>) => {
      if (!sceneId) return;
      await saveScene({ data: { project_id: projectId, scene_id: sceneId, patch } });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scene-arc", sceneId] }),
  });

  const persistChar = useMutation({
    mutationFn: async ({ character_id, patch }: { character_id: string; patch: Record<string, any> }) => {
      if (!sceneId) return;
      await saveCharState({ data: { project_id: projectId, scene_id: sceneId, character_id, patch } });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["char-arc-states", sceneId] }),
  });

  const removeCharState = useMutation({
    mutationFn: async (id: string) => { await delCharState({ data: { id } }); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["char-arc-states", sceneId] }),
  });

  // AI tool
  const [tool, setTool] = useState(AI_TOOLS[0]);
  const [aiOut, setAiOut] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const runTool = async () => {
    if (!sceneId) { toast.error("Pick a scene first"); return; }
    setAiLoading(true); setAiOut("");
    try {
      const res = await callArcTool({ data: { project_id: projectId, scene_id: sceneId, tool } });
      setAiOut(res.text);
      if (res.demo) toast.info("Demo output — connect AI for live craft notes");
    } catch (e: any) {
      toast.error(e.message ?? "AI failed");
    } finally {
      setAiLoading(false);
    }
  };

  if (scenes.length === 0) {
    return (
      <div className="p-4 text-xs text-muted-foreground font-sans">
        Create a scene to start tracking arc beats.
      </div>
    );
  }

  return (
    <div className="font-sans">
      <div className="p-3 border-b border-border/40">
        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Scene</Label>
        <Select value={sceneId || ""} onValueChange={setSceneId}>
          <SelectTrigger className="text-xs h-8 mt-1"><SelectValue placeholder="Select scene" /></SelectTrigger>
          <SelectContent>
            {scenes.map((s: any, i: number) => (
              <SelectItem key={s.id} value={s.id}>
                {String(i + 1).padStart(2, "0")} — {s.scene_heading || s.title || "Untitled"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {beat && (
          <div className="mt-2 flex items-center gap-2">
            <ArcStatusBadge status={beat.arc_status} score={beat.scene_strength_score} />
          </div>
        )}
      </div>

      <ScrollArea className="h-[calc(100vh-200px)]">
        <div className="p-3 space-y-4">
          {/* Scene Arc */}
          <section>
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-primary mb-2">Scene Arc</h4>
            <div className="grid grid-cols-2 gap-2">
              <ArcField label="Act" type="select" options={ACTS} value={beat?.act} onSave={(v) => persist.mutate({ act: v })} />
              <ArcField label="Story Beat" type="select" options={STORY_BEATS} value={beat?.story_beat} onSave={(v) => persist.mutate({ story_beat: v })} />
            </div>
            <ArcField label="Scene Purpose" type="textarea" value={beat?.scene_purpose} onSave={(v) => persist.mutate({ scene_purpose: v })} />
            <ArcField label="Scene Turn" type="textarea" value={beat?.scene_turn} onSave={(v) => persist.mutate({ scene_turn: v })} />
            <ArcField label="External Plot Change" type="textarea" value={beat?.external_plot_change} onSave={(v) => persist.mutate({ external_plot_change: v })} />
            <ArcField label="Stakes Change" type="textarea" value={beat?.stakes_change} onSave={(v) => persist.mutate({ stakes_change: v })} />
            <ArcField label="Moral Pressure" type="textarea" value={beat?.moral_pressure} onSave={(v) => persist.mutate({ moral_pressure: v })} />
            <ArcField label="Theme Connection" type="textarea" value={beat?.theme_connection} onSave={(v) => persist.mutate({ theme_connection: v })} />
            <ArcField label="Relationship Change" type="textarea" value={beat?.relationship_change} onSave={(v) => persist.mutate({ relationship_change: v })} />
            <div className="grid grid-cols-2 gap-2">
              <ArcField label="Question Raised" type="text" value={beat?.question_raised} onSave={(v) => persist.mutate({ question_raised: v })} />
              <ArcField label="Question Answered" type="text" value={beat?.question_answered} onSave={(v) => persist.mutate({ question_answered: v })} />
            </div>
            <div className="mt-2">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Emotional Charge: {beat?.emotional_charge ?? "—"}/10</Label>
              <Slider min={1} max={10} step={1} value={[beat?.emotional_charge || 5]} onValueChange={([v]) => persist.mutate({ emotional_charge: v })} className="mt-2" />
            </div>
          </section>

          {/* Character Movement */}
          <section>
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-primary mb-2">Character Movement</h4>
            {characters.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">No characters yet.</p>
            ) : (
              <>
                <Select onValueChange={(cid) => persistChar.mutate({ character_id: cid, patch: {} })}>
                  <SelectTrigger className="text-xs h-8"><SelectValue placeholder="+ Add character to scene" /></SelectTrigger>
                  <SelectContent>
                    {characters.filter((c: any) => !charStates.some((s: any) => s.character_id === c.id)).map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="space-y-3 mt-2">
                  {charStates.map((s: any) => {
                    const c = characters.find((c: any) => c.id === s.character_id);
                    return (
                      <div key={s.id} className="rounded-md border border-border/60 bg-card/40 p-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold">{c?.name || "Character"}</span>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeCharState.mutate(s.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                        <ArcField label="Goal in scene" type="text" value={s.goal_in_scene} onSave={(v) => persistChar.mutate({ character_id: s.character_id, patch: { goal_in_scene: v } })} />
                        <ArcField label="Tactic" type="text" value={s.tactic} onSave={(v) => persistChar.mutate({ character_id: s.character_id, patch: { tactic: v } })} />
                        <div className="grid grid-cols-2 gap-2 mt-1">
                          <ArcField label="Emotion start" type="text" value={s.emotional_state_start} onSave={(v) => persistChar.mutate({ character_id: s.character_id, patch: { emotional_state_start: v } })} />
                          <ArcField label="Emotion end" type="text" value={s.emotional_state_end} onSave={(v) => persistChar.mutate({ character_id: s.character_id, patch: { emotional_state_end: v } })} />
                        </div>
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          <div>
                            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">TMH start: {tmhLabel(s.tmh_start_level)}</Label>
                            <Slider min={1} max={9} step={1} value={[s.tmh_start_level || 5]} onValueChange={([v]) => persistChar.mutate({ character_id: s.character_id, patch: { tmh_start_level: v } })} className="mt-1" />
                          </div>
                          <div>
                            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">TMH end: {tmhLabel(s.tmh_end_level)}</Label>
                            <Slider min={1} max={9} step={1} value={[s.tmh_end_level || 5]} onValueChange={([v]) => persistChar.mutate({ character_id: s.character_id, patch: { tmh_end_level: v } })} className="mt-1" />
                          </div>
                        </div>
                        <div className="mt-2">
                          <ArcField label="Movement" type="select" options={ARC_MOVES} value={s.arc_movement} onSave={(v) => persistChar.mutate({ character_id: s.character_id, patch: { arc_movement: v } })} />
                        </div>
                        <ArcField label="Cost" type="text" value={s.cost} onSave={(v) => persistChar.mutate({ character_id: s.character_id, patch: { cost: v } })} />
                        <ArcField label="Revelation" type="text" value={s.revelation} onSave={(v) => persistChar.mutate({ character_id: s.character_id, patch: { revelation: v } })} />
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </section>

          {/* AI Arc Tools */}
          <section>
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-primary mb-2 flex items-center gap-1.5">
              <Wand2 className="h-3 w-3" /> AI Arc Tools
            </h4>
            <Select value={tool} onValueChange={setTool}>
              <SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger>
              <SelectContent>{AI_TOOLS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
            <Button size="sm" className="w-full mt-2" onClick={runTool} disabled={aiLoading || !sceneId}>
              {aiLoading ? <><Loader2 className="h-3 w-3 mr-1.5 animate-spin" />Thinking…</> : <><Sparkles className="h-3 w-3 mr-1.5" />Run</>}
            </Button>
            {aiOut && (
              <div className="mt-2 rounded-md border border-border/60 bg-background/50 p-2 text-[11px] whitespace-pre-wrap text-foreground/90">
                {aiOut}
              </div>
            )}
          </section>
        </div>
      </ScrollArea>
    </div>
  );
}

function ArcField({
  label, type, value, options, onSave,
}: {
  label: string;
  type: "text" | "textarea" | "select";
  value?: string | null;
  options?: string[];
  onSave: (v: string) => void;
}) {
  const [v, setV] = useState<string>(value ?? "");
  useEffect(() => setV(value ?? ""), [value]);
  const commit = () => { if (v !== (value ?? "")) onSave(v); };
  return (
    <div className="mt-1.5">
      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</Label>
      {type === "textarea" ? (
        <Textarea value={v} onChange={(e) => setV(e.target.value)} onBlur={commit} rows={2} className="mt-1 text-xs min-h-[44px]" />
      ) : type === "select" ? (
        <Select value={v} onValueChange={(nv) => { setV(nv); onSave(nv); }}>
          <SelectTrigger className="text-xs h-8 mt-1"><SelectValue placeholder="—" /></SelectTrigger>
          <SelectContent>{(options || []).map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
        </Select>
      ) : (
        <Input value={v} onChange={(e) => setV(e.target.value)} onBlur={commit} className="mt-1 text-xs h-8" />
      )}
    </div>
  );
}
