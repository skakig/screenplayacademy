import { createFileRoute } from "@tanstack/react-router";
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

export const Route = createFileRoute("/_authenticated/tableread/$projectId")({
  head: () => ({ meta: [{ title: "Table Read — SceneSmith AI" }] }),
  component: TableRead,
});

function TableRead() {
  const { projectId } = Route.useParams();
  const qc = useQueryClient();
  const callGen = useServerFn(generateTableRead);
  const callRefresh = useServerFn(refreshTableReadUrl);

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

  const run = async () => { setLoading(true); try { await gen.mutateAsync(); } finally { setLoading(false); } };

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
            <Select value={sceneId} onValueChange={setSceneId}>
              <SelectTrigger><SelectValue placeholder="(pick a scene)" /></SelectTrigger>
              <SelectContent>
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
                <Input
                  value={voiceMap[c.id] ?? c.elevenlabs_voice_id ?? ""}
                  onChange={(e) => setVoiceMap({ ...voiceMap, [c.id]: e.target.value })}
                  placeholder="ElevenLabs voice ID"
                  className="h-8 text-xs"
                />
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
              <p className="text-sm text-muted-foreground">Pick a scene, assign voices, and generate your first read.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {audios.map((a: any) => (
                <Card key={a.id} className="p-4">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-medium capitalize">{a.kind} · {a.status}</span>
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
                    <p className="text-xs text-destructive">Generation failed. Try again or simplify the scene.</p>
                  ) : a.status === "generating" ? (
                    <p className="text-xs text-muted-foreground italic flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" />Performing the read…</p>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">Audio will appear here once generation completes.</p>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
