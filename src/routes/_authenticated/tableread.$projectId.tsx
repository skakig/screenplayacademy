import { createFileRoute, Link } from "@tanstack/react-router";
import { RouteReadinessGate } from "@/components/RouteReadinessGate";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { ProjectNav } from "@/components/ProjectNav";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Mic, Loader2, Sparkles, Lock } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { generateTableRead, refreshTableReadUrl } from "@/lib/tableread.functions";
import { listElevenLabsVoices } from "@/lib/elevenlabs-voices.functions";

import { PageFeatureGate } from "@/components/PageFeatureGate";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import { useOpenCharacterBuilder } from "@/hooks/useOpenCharacterBuilder";

export const Route = createFileRoute("/_authenticated/tableread/$projectId")({
  head: () => ({ meta: [{ title: "Table Read — SceneSmith Studio" }] }),
  component: () => (<RouteReadinessGate to="/tableread/$projectId"><GatedTableRead /></RouteReadinessGate>),
  errorComponent: RouteErrorBoundary,
});

function GatedTableRead() {
  return (
    <PageFeatureGate feature="table_read">
      <TableRead />
    </PageFeatureGate>
  );
}


function TableRead() {
  const { projectId } = Route.useParams();
  const qc = useQueryClient();
  const callGen = useServerFn(generateTableRead);
  const callRefresh = useServerFn(refreshTableReadUrl);
  const callVoiceList = useServerFn(listElevenLabsVoices);
  const { openCharacterBuilder, loading: characterLoading } = useOpenCharacterBuilder({ projectId });

  const voicesQ = useQuery({
    queryKey: ["elevenlabs-voices"],
    queryFn: () => callVoiceList(),
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const { data: project } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => (await supabase.from("projects").select("*").eq("id", projectId).single()).data,
  });
  const { data: scenes = [] } = useQuery({
    queryKey: ["scenes", projectId],
    queryFn: async () => (await supabase.from("scenes").select("*").eq("project_id", projectId).order("order_index")).data ?? [],
  });
  const { data: characters = [] } = useQuery({
    queryKey: ["characters", projectId],
    queryFn: async () => (await supabase.from("characters").select("*").eq("project_id", projectId).order("name")).data ?? [],
  });
  const { data: audios = [] } = useQuery({
    queryKey: ["audios", projectId],
    queryFn: async () => (await supabase.from("audio_assets").select("*").eq("project_id", projectId).order("created_at", { ascending: false })).data ?? [],
  });

  const [sceneId, setSceneId] = useState<string | undefined>();
  const [narrator, setNarrator] = useState(true);
  const [sfx, setSfx] = useState(false);
  const [voiceMap, setVoiceMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [latestId, setLatestId] = useState<string | null>(null);

  useEffect(() => { if (!sceneId && scenes.length) setSceneId(scenes[0].id); }, [scenes, sceneId]);

  // Poll audio_assets while any row is still generating (fallback if realtime
  // isn't wired for this project). Poll fast so progress feels live.
  useEffect(() => {
    if (!audios.some((a: any) => a.status === "generating")) return;
    const t = setInterval(() => {
      qc.invalidateQueries({ queryKey: ["audios", projectId] });
    }, 1500);
    return () => clearInterval(t);
  }, [audios, projectId, qc]);

  const gen = useMutation({
    mutationFn: async () => callGen({ data: { projectId, sceneId, voiceMap, narrator, sfx } }),
    onSuccess: (audio: any) => {
      qc.invalidateQueries({ queryKey: ["audios", projectId] });
      qc.invalidateQueries({ queryKey: ["characters", projectId] });
      if (audio?.status === "coming_soon") toast.info(audio.message ?? "Coming soon");
      else if (audio?.status === "ready") { toast.success("Table read ready"); setLatestId(audio.id); }
      else toast.success("Table read queued");
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const run = async () => {
    setLoading(true);
    try { await gen.mutateAsync(); } catch { /* handled in onError */ } finally { setLoading(false); }
  };

  const refresh = async (id: string) => {
    try {
      const { url } = await callRefresh({ data: { audioAssetId: id } });
      qc.setQueryData(["audios", projectId], (old: any[] | undefined) =>
        (old ?? []).map((a) => (a.id === id ? { ...a, audio_url: url } : a)),
      );
    } catch (e: any) { toast.error(e.message ?? "Could not refresh link"); }
  };

  return (
    <AppShell>
      <ProjectNav projectId={projectId} title={project?.title} />
      <div className="max-w-6xl mx-auto px-4 py-8 grid lg:grid-cols-[360px_1fr] gap-6">
        <Card className="p-5 h-fit space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Mic className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Table read</h3>
          </div>
          <div>
            <Label>Scene</Label>
            <Select value={sceneId ?? "__all__"} onValueChange={(v) => setSceneId(v === "__all__" ? undefined : v)}>
              <SelectTrigger><SelectValue placeholder="(pick a scene)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Entire script</SelectItem>
                {scenes.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.title || s.scene_heading || "Untitled"}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Voice assignments</Label>
            {characters.length === 0 && <p className="text-xs text-muted-foreground">Add characters first.</p>}
            {characters.map((c: any) => (
              <div key={c.id} className="grid grid-cols-[1fr_1.4fr] gap-2 items-center">
                <span className="text-xs font-medium truncate">{c.name}</span>
                <Select
                  value={voiceMap[c.id] ?? c.elevenlabs_voice_id ?? ""}
                  onValueChange={(v) => setVoiceMap({ ...voiceMap, [c.id]: v })}
                >
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={voicesQ.isLoading ? "Loading…" : "Auto"} /></SelectTrigger>
                  <SelectContent>
                    {(voicesQ.data?.voices ?? []).map((v) => (
                      <SelectItem key={v.voice_id} value={v.voice_id}>{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Narrator</Label>
            <Switch checked={narrator} onCheckedChange={setNarrator} />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Sound effects (Pro)</Label>
            <Switch checked={sfx} onCheckedChange={setSfx} />
          </div>
          <Button className="w-full" onClick={run} disabled={loading}>
            {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Working...</> : <><Sparkles className="h-4 w-4 mr-2" />Generate Table Read</>}
          </Button>
          <p className="text-[11px] text-muted-foreground flex items-start gap-1.5 mt-2">
            <Lock className="h-3 w-3 mt-0.5 shrink-0" />
            Voices powered by ElevenLabs. Find voice IDs in the <a href="https://elevenlabs.io/voice-library" target="_blank" rel="noreferrer" className="underline">Voice Library</a>. Leave blank to auto-assign.
          </p>
        </Card>

        <div>
          {audios.length === 0 ? (
            <Card className="p-12 text-center border-dashed">
              <Mic className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <h3 className="font-semibold mb-1">No table reads yet</h3>
              {scenes.length === 0 || characters.length === 0 ? (
                <>
                  <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
                    A table read needs {scenes.length === 0 && characters.length === 0 ? "scenes and characters" : scenes.length === 0 ? "at least one scene" : "at least one character"} so we know what to perform and who's speaking.
                  </p>
                  <div className="flex items-center gap-2 justify-center flex-wrap">
                    {scenes.length === 0 && (
                      <Button size="sm" asChild>
                        <Link to="/scenes/$projectId" params={{ projectId }}>Add a scene</Link>
                      </Button>
                    )}
                    {characters.length === 0 && (
                      <Button size="sm" variant={scenes.length === 0 ? "outline" : "default"} onClick={openCharacterBuilder} disabled={characterLoading}>
                        Add characters
                      </Button>
                    )}
                    <Button size="sm" variant="outline" asChild>
                      <Link to="/editor/$projectId" params={{ projectId }}>Open editor</Link>
                    </Button>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Pick a scene, assign voices, and generate your first read.</p>
              )}
            </Card>
          ) : (
            <div className="space-y-3">
              {audios.map((a: any) => {
                const total = a.lines_total ?? 0;
                const done = a.lines_done ?? 0;
                const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
                return (
                <Card key={a.id} className="p-4">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-medium capitalize">{a.kind} · {a.status}{a.status === "generating" && total > 0 ? ` · ${done}/${total} lines` : ""}</span>
                    <span className="text-muted-foreground">{new Date(a.created_at).toLocaleString()}</span>
                  </div>
                  {a.audio_url ? (
                    <>
                      <audio controls src={a.audio_url} className="w-full" autoPlay={a.id === latestId} onError={() => refresh(a.id)} />
                      <div className="mt-2 flex justify-end">
                        <Button variant="ghost" size="sm" className="h-6 text-[11px]" onClick={() => refresh(a.id)}>Refresh link</Button>
                      </div>
                    </>
                  ) : a.status === "failed" ? (
                    <p className="text-xs text-destructive">{a.error_message ?? "Generation failed. Try again or simplify the scene."}</p>
                  ) : a.status === "generating" ? (
                    <div className="space-y-2" aria-live="polite">
                      <div className="h-1.5 rounded bg-muted overflow-hidden">
                        <div className="h-full bg-primary transition-[width] duration-500" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-xs text-muted-foreground italic flex items-center gap-2">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        {a.current_line_label ? `Voicing ${a.current_line_label}…` : "Queuing lines…"}
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">Audio will appear here once generation completes.</p>
                  )}
                </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
