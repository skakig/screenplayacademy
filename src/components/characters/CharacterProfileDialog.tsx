import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Sparkles, Loader2, ImagePlus, BookOpen, Brain, Mic2, Eye, Users, Activity, FileText, Wand2, Volume2,
  AlertTriangle, MessageSquareQuote, Search, Lightbulb,
} from "lucide-react";
import { toast } from "sonner";
import { TMHInfoPanel } from "./TMHInfoPanel";
import { TMHBadge } from "./TMHBadge";
import { tmhLabel, GROUPS, completenessPct } from "./tmh";
import { RelationshipsTab } from "./RelationshipsTab";
import { SceneUsageTab } from "./SceneUsageTab";
import { CharacterArcSection } from "./CharacterArcSection";
import { SaveStatus } from "./SaveStatus";
import { useAutosave } from "@/hooks/use-autosave";
import {
  upsertCharacter, generateFullCharacter, generateBackstory, generateTMHProfile,
  generateDialogueVoice, generateVisualPrompt, runMoralPressureTest, analyzeCharacterArc,
  testDialogue, findContradictions, suggestSceneUse, generatePortrait,
} from "@/lib/characters.functions";
import { listElevenLabsVoices } from "@/lib/elevenlabs-voices.functions";

const TextField = ({ label, value, onChange, multiline, rows = 2, placeholder }: any) => (
  <div>
    <Label className="text-xs">{label}</Label>
    {multiline ? (
      <Textarea value={value ?? ""} rows={rows} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    ) : (
      <Input value={value ?? ""} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    )}
  </div>
);

export function CharacterProfileDialog({
  projectId, characterId, open, onOpenChange,
}: {
  projectId: string;
  characterId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const qc = useQueryClient();
  const callUpsert = useServerFn(upsertCharacter);
  const callFull = useServerFn(generateFullCharacter);
  const callBack = useServerFn(generateBackstory);
  const callTMH = useServerFn(generateTMHProfile);
  const callVoice = useServerFn(generateDialogueVoice);
  const callVisual = useServerFn(generateVisualPrompt);
  const callPressure = useServerFn(runMoralPressureTest);
  const callArc = useServerFn(analyzeCharacterArc);
  const callDialogue = useServerFn(testDialogue);
  const callContradict = useServerFn(findContradictions);
  const callSuggest = useServerFn(suggestSceneUse);
  const callPortrait = useServerFn(generatePortrait);
  const callVoiceList = useServerFn(listElevenLabsVoices);

  const { data: character } = useQuery({
    queryKey: ["character", characterId],
    enabled: !!characterId && open,
    refetchOnMount: "always",
    queryFn: async (): Promise<any> => (await supabase.from("characters").select("*").eq("id", characterId!).single()).data,
  });

  const voicesQ = useQuery({
    queryKey: ["elevenlabs-voices"],
    enabled: open,
    queryFn: () => callVoiceList(),
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const [local, setLocal] = useState<any>(null);
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [pressureOut, setPressureOut] = useState<string>("");
  const [dialogueOut, setDialogueOut] = useState<string>("");
  const [dialogueScenario, setDialogueScenario] = useState("");
  const [contradictionsOut, setContradictionsOut] = useState<string>("");
  const [sceneSuggestOut, setSceneSuggestOut] = useState<string>("");

  useEffect(() => { setLocal(character ?? null); }, [character]);

  const set = (patch: any) => setLocal((l: any) => ({ ...l, ...patch }));

  const save = useMutation({
    mutationFn: async (patch: any) =>
      callUpsert({ data: { id: characterId!, project_id: projectId, patch } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["character", characterId] });
      qc.invalidateQueries({ queryKey: ["characters", projectId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Save failed"),
  });

  const autosave = useAutosave<any>({
    local,
    remote: character,
    enabled: !!characterId && !!character,
    onSave: async (patch) => {
      await callUpsert({ data: { id: characterId!, project_id: projectId, patch } });
      qc.invalidateQueries({ queryKey: ["character", characterId] });
      qc.invalidateQueries({ queryKey: ["characters", projectId] });
    },
  });

  const runAi = async (key: string, fn: () => Promise<any>) => {
    setAiBusy(key);
    try {
      const out = await fn();
      if (out?.demo) toast.info("Demo output (connect AI for live generation)");
      else toast.success("Generated");
      qc.invalidateQueries({ queryKey: ["character", characterId] });
      qc.invalidateQueries({ queryKey: ["characters", projectId] });
      return out;
    } catch (e: any) {
      toast.error(e?.message ?? "AI failed");
    } finally { setAiBusy(null); }
  };

  const pct = useMemo(() => completenessPct(local ?? character), [local, character]);

  if (!characterId) return null;

  return (
    <Dialog open={open} onOpenChange={async (o) => { if (!o) await autosave.flush(); onOpenChange(o); }}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-hidden p-0 flex flex-col">
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-border/60">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full overflow-hidden bg-secondary flex items-center justify-center shrink-0 border border-border">
              {local?.portrait_url ? (
                <img src={local.portrait_url} alt={local?.name} className="h-full w-full object-cover" />
              ) : (
                <span className="font-display text-xl">{(local?.name ?? "?").slice(0, 1).toUpperCase()}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="font-display text-2xl truncate">{local?.name ?? "Character"}</DialogTitle>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {local?.role && <Badge variant="outline" className="text-[10px]">{local.role}</Badge>}
                {local?.group_name && <Badge variant="secondary" className="text-[10px]">{local.group_name}</Badge>}
                <TMHBadge level={local?.tmh_baseline} />
                <span className="text-[11px] text-muted-foreground">Profile {pct}% complete</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <SaveStatus status={autosave.status} lastSavedAt={autosave.lastSavedAt} onRetry={() => void autosave.saveNow()} />
              <Button size="sm" variant="outline" disabled={!!aiBusy} onClick={() => runAi("full", () => callFull({ data: { characterId } }))}>
                {aiBusy === "full" ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5" />}
                Generate Full
              </Button>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="overview" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="mx-6 mt-3 grid grid-cols-9 h-auto">
            <TabsTrigger value="overview" className="text-[11px]">Overview</TabsTrigger>
            <TabsTrigger value="backstory" className="text-[11px]"><BookOpen className="h-3 w-3 mr-1" />Backstory</TabsTrigger>
            <TabsTrigger value="personality" className="text-[11px]"><Brain className="h-3 w-3 mr-1" />Personality</TabsTrigger>
            <TabsTrigger value="tmh" className="text-[11px]">TMH</TabsTrigger>
            <TabsTrigger value="voice" className="text-[11px]"><Mic2 className="h-3 w-3 mr-1" />Voice</TabsTrigger>
            <TabsTrigger value="visual" className="text-[11px]"><Eye className="h-3 w-3 mr-1" />Visual</TabsTrigger>
            <TabsTrigger value="relationships" className="text-[11px]"><Users className="h-3 w-3 mr-1" />Rel.</TabsTrigger>
            <TabsTrigger value="arc" className="text-[11px]"><Activity className="h-3 w-3 mr-1" />Arc</TabsTrigger>
            <TabsTrigger value="scenes" className="text-[11px]"><FileText className="h-3 w-3 mr-1" />Scenes</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            {!local ? (
              <div className="flex items-center justify-center py-20"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : (
              <>
                {/* OVERVIEW */}
                <TabsContent value="overview" className="space-y-3 mt-0">
                  <div className="grid grid-cols-2 gap-3">
                    <TextField label="Name *" value={local.name} onChange={(v: string) => set({ name: v })} />
                    <TextField label="Alias" value={local.alias} onChange={(v: string) => set({ alias: v })} />
                    <TextField label="Role" value={local.role} onChange={(v: string) => set({ role: v })} />
                    <div>
                      <Label className="text-xs">Group</Label>
                      <Select value={local.group_name ?? "Main Cast"} onValueChange={(v) => { set({ group_name: v }); save.mutate({ group_name: v }); }}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {GROUPS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <TextField label="Character type" value={local.character_type} onChange={(v: string) => set({ character_type: v })} placeholder="e.g. Protagonist, Foil…" />
                    <TextField label="Age" value={local.age} onChange={(v: string) => set({ age: v })} />
                    <TextField label="Occupation" value={local.occupation} onChange={(v: string) => set({ occupation: v })} />
                    <TextField label="Status" value={local.status} onChange={(v: string) => set({ status: v })} placeholder="alive, missing…" />
                  </div>
                  <TextField label="One-sentence summary" value={local.summary} onChange={(v: string) => set({ summary: v })} multiline rows={2} />
                  <div className="grid grid-cols-2 gap-3">
                    <TextField label="External want" value={local.external_goal} onChange={(v: string) => set({ external_goal: v })} multiline />
                    <TextField label="Internal need" value={local.internal_need} onChange={(v: string) => set({ internal_need: v })} multiline />
                    <TextField label="Core wound" value={local.wound} onChange={(v: string) => set({ wound: v })} multiline />
                    <TextField label="Core lie" value={local.core_lie} onChange={(v: string) => set({ core_lie: v })} multiline />
                    <TextField label="Core fear" value={local.fear} onChange={(v: string) => set({ fear: v })} multiline />
                    <TextField label="Core secret" value={local.secret} onChange={(v: string) => set({ secret: v })} multiline />
                    <TextField label="Core contradiction" value={local.contradiction} onChange={(v: string) => set({ contradiction: v })} multiline />
                    <TextField label="Archetype" value={local.archetype} onChange={(v: string) => set({ archetype: v })} />
                  </div>
                  <SaveBar onSave={() => save.mutate(local)} pending={save.isPending} />
                </TabsContent>

                {/* BACKSTORY */}
                <TabsContent value="backstory" className="space-y-3 mt-0">
                  <AiBar label="Generate Backstory" busy={aiBusy === "back"} onClick={() => runAi("back", () => callBack({ data: { characterId } }))} />
                  {["childhood","defining_wound","formative_relationship","biggest_loss","biggest_shame","life_before_story","lies_about","never_says_aloud"].map((k) => (
                    <TextField key={k} label={prettyLabel(k)} value={local[k]} onChange={(v: string) => set({ [k]: v })} multiline rows={2} />
                  ))}
                  <SaveBar onSave={() => save.mutate(local)} pending={save.isPending} />
                </TabsContent>

                {/* PERSONALITY */}
                <TabsContent value="personality" className="space-y-3 mt-0">
                  <div className="grid grid-cols-2 gap-3">
                    {["temperament","strengths","flaws","habits","conflict_style","fear_response","trust_triggers","betrayal_triggers","humor_style"].map((k) => (
                      <TextField key={k} label={prettyLabel(k)} value={local[k]} onChange={(v: string) => set({ [k]: v })} multiline rows={2} />
                    ))}
                  </div>
                  <SaveBar onSave={() => save.mutate(local)} pending={save.isPending} />
                </TabsContent>

                {/* TMH */}
                <TabsContent value="tmh" className="space-y-4 mt-0">
                  <TMHInfoPanel />
                  <AiBar label="Generate TMH Profile" busy={aiBusy === "tmh"} onClick={() => runAi("tmh", () => callTMH({ data: { characterId } }))} />
                  <div className="grid grid-cols-2 gap-4">
                    {(["tmh_baseline","tmh_stress","tmh_aspirational","tmh_shadow"] as const).map((k) => (
                      <div key={k} className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs">{prettyLabel(k)}</Label>
                          <TMHBadge level={local[k]} />
                        </div>
                        <Slider min={1} max={9} step={1} value={[local[k] ?? 5]}
                          onValueChange={(v) => set({ [k]: v[0] })}
                          onValueCommit={(v) => save.mutate({ [k]: v[0] })}
                        />
                        <p className="text-[10px] text-muted-foreground">{tmhLabel(local[k])}</p>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {["moral_wound","moral_blind_spot","core_temptation","core_virtue","core_vice","moral_test","what_they_justify","would_never_do","might_do_under_pressure","redemption_path","corruption_path"].map((k) => (
                      <TextField key={k} label={prettyLabel(k)} value={local[k]} onChange={(v: string) => set({ [k]: v })} multiline rows={2} />
                    ))}
                  </div>
                  <SaveBar onSave={() => save.mutate(local)} pending={save.isPending} />

                  <Card className="p-3 bg-secondary/30 border-dashed">
                    <div className="flex items-center gap-2 mb-2 text-xs font-semibold"><AlertTriangle className="h-3.5 w-3.5 text-accent" />Run Moral Pressure Test</div>
                    <Button size="sm" variant="outline" disabled={!!aiBusy} onClick={async () => {
                      const r = await runAi("pressure", () => callPressure({ data: { characterId } }));
                      if (r?.text) setPressureOut(r.text);
                    }}>{aiBusy === "pressure" ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5" />}Run pressure scenarios</Button>
                    {pressureOut && <pre className="text-xs mt-3 whitespace-pre-wrap font-sans text-muted-foreground">{pressureOut}</pre>}
                  </Card>
                </TabsContent>

                {/* VOICE */}
                <TabsContent value="voice" className="space-y-3 mt-0">
                  <AiBar label="Generate Dialogue Voice" busy={aiBusy === "voice"} onClick={() => runAi("voice", () => callVoice({ data: { characterId } }))} />

                  <Card className="p-3">
                    <Label className="text-xs flex items-center gap-1.5"><Volume2 className="h-3.5 w-3.5 text-primary" />ElevenLabs voice</Label>
                    <div className="text-[10px] text-muted-foreground mb-2">Reused by the Table Read.</div>
                    <Select
                      value={local.elevenlabs_voice_id ?? ""}
                      onValueChange={(v) => { set({ elevenlabs_voice_id: v }); save.mutate({ elevenlabs_voice_id: v }); }}
                    >
                      <SelectTrigger><SelectValue placeholder={voicesQ.isLoading ? "Loading voices…" : "Pick a voice"} /></SelectTrigger>
                      <SelectContent>
                        {(voicesQ.data?.voices ?? []).map((v) => (
                          <SelectItem key={v.voice_id} value={v.voice_id}>{v.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Card>

                  <div className="grid grid-cols-2 gap-3">
                    {["voice_summary","vocabulary_level","sentence_rhythm","directness_level","emotional_openness","favorite_phrases","forbidden_phrases","how_they_lie","how_they_apologize","how_they_threaten","subtext_pattern","silence_pattern","voice_archetype","voice_style","speech_patterns"].map((k) => (
                      <TextField key={k} label={prettyLabel(k)} value={local[k]} onChange={(v: string) => set({ [k]: v })} multiline rows={2} />
                    ))}
                  </div>
                  <SaveBar onSave={() => save.mutate(local)} pending={save.isPending} />

                  <Card className="p-3 bg-secondary/30 border-dashed">
                    <div className="flex items-center gap-2 mb-2 text-xs font-semibold"><MessageSquareQuote className="h-3.5 w-3.5 text-accent" />Test dialogue</div>
                    <Textarea placeholder="Scenario — e.g. 'They are caught in a lie by someone they love.'" value={dialogueScenario} onChange={(e) => setDialogueScenario(e.target.value)} rows={2} />
                    <Button size="sm" variant="outline" className="mt-2" disabled={!dialogueScenario || !!aiBusy} onClick={async () => {
                      const r = await runAi("dia", () => callDialogue({ data: { characterId, scenario: dialogueScenario } }));
                      if (r?.text) setDialogueOut(r.text);
                    }}>{aiBusy === "dia" ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5" />}Generate</Button>
                    {dialogueOut && <pre className="text-xs mt-3 whitespace-pre-wrap font-mono text-muted-foreground">{dialogueOut}</pre>}
                  </Card>
                </TabsContent>

                {/* VISUAL */}
                <TabsContent value="visual" className="space-y-3 mt-0">
                  <div className="grid grid-cols-[180px_1fr] gap-4">
                    <div className="aspect-[3/4] rounded-lg overflow-hidden bg-secondary border border-border flex items-center justify-center">
                      {local.portrait_url ? (
                        <img src={local.portrait_url} alt={local.name} className="w-full h-full object-cover" />
                      ) : (
                        <ImagePlus className="h-8 w-8 text-muted-foreground" />
                      )}
                    </div>
                    <div className="space-y-2">
                      <AiBar label="Generate Visual Prompt" busy={aiBusy === "vis"} onClick={() => runAi("vis", () => callVisual({ data: { characterId } }))} />
                      <Button size="sm" className="w-full" disabled={!!aiBusy} onClick={() => runAi("portrait", () => callPortrait({ data: { characterId } }))}>
                        {aiBusy === "portrait" ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5 mr-1.5" />}
                        Generate Portrait
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {["visual_description","costume_notes","color_palette","signature_props","visual_symbol","movement_style"].map((k) => (
                      <TextField key={k} label={prettyLabel(k)} value={local[k]} onChange={(v: string) => set({ [k]: v })} multiline rows={2} />
                    ))}
                  </div>
                  <TextField label="Image prompt" value={local.image_prompt} onChange={(v: string) => set({ image_prompt: v })} multiline rows={4} />
                  <SaveBar onSave={() => save.mutate(local)} pending={save.isPending} />
                </TabsContent>

                {/* RELATIONSHIPS */}
                <TabsContent value="relationships" className="mt-0">
                  <RelationshipsTab projectId={projectId} characterId={characterId} />
                </TabsContent>

                {/* ARC */}
                <TabsContent value="arc" className="space-y-4 mt-0">
                  <CharacterArcSection projectId={projectId} characterId={characterId} />

                  <AiBar label="Analyze Character Arc" busy={aiBusy === "arc"} onClick={() => runAi("arc", () => callArc({ data: { characterId } }))} />
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground pt-2">Arc notes (on character)</div>
                  <div className="grid grid-cols-2 gap-3">
                    {["starting_belief","ending_belief","starting_behavior","ending_behavior","act1_state","act2_pressure","midpoint_shift","dark_night_state","climax_choice","final_image","character_arc"].map((k) => (
                      <TextField key={k} label={prettyLabel(k)} value={local[k]} onChange={(v: string) => set({ [k]: v })} multiline rows={2} />
                    ))}
                  </div>
                  <SaveBar onSave={() => save.mutate(local)} pending={save.isPending} />

                  <Card className="p-3 bg-secondary/30 border-dashed">
                    <div className="flex items-center gap-2 mb-2 text-xs font-semibold"><Search className="h-3.5 w-3.5 text-accent" />Find contradictions</div>
                    <Button size="sm" variant="outline" disabled={!!aiBusy} onClick={async () => {
                      const r = await runAi("contradict", () => callContradict({ data: { characterId } }));
                      if (r?.text) setContradictionsOut(r.text);
                    }}>{aiBusy === "contradict" ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5" />}Audit profile</Button>
                    {contradictionsOut && <pre className="text-xs mt-3 whitespace-pre-wrap font-sans text-muted-foreground">{contradictionsOut}</pre>}
                  </Card>
                </TabsContent>

                {/* SCENES */}
                <TabsContent value="scenes" className="mt-0">
                  <SceneUsageTab projectId={projectId} characterId={characterId} />
                  <Card className="p-3 bg-secondary/30 border-dashed mt-3">
                    <div className="flex items-center gap-2 mb-2 text-xs font-semibold"><Lightbulb className="h-3.5 w-3.5 text-accent" />Suggest scene use</div>
                    <Button size="sm" variant="outline" disabled={!!aiBusy} onClick={async () => {
                      const r = await runAi("suggest", () => callSuggest({ data: { characterId } }));
                      if (r?.text) setSceneSuggestOut(r.text);
                    }}>{aiBusy === "suggest" ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5" />}Suggest</Button>
                    {sceneSuggestOut && <pre className="text-xs mt-3 whitespace-pre-wrap font-sans text-muted-foreground">{sceneSuggestOut}</pre>}
                  </Card>
                </TabsContent>
              </>
            )}
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function prettyLabel(k: string): string {
  return k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function SaveBar({ onSave, pending }: { onSave: () => void; pending: boolean }) {
  return (
    <div className="flex justify-end pt-2">
      <Button size="sm" onClick={onSave} disabled={pending}>
        {pending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
        Save
      </Button>
    </div>
  );
}

function AiBar({ label, busy, onClick }: { label: string; busy: boolean; onClick: () => void }) {
  return (
    <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onClick} className="w-full">
      {busy ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5" />}{label}
    </Button>
  );
}
