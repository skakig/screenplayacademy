import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { ProjectNav } from "@/components/ProjectNav";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Image as ImageIcon, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { generateStoryboardPanel } from "@/lib/storyboard.functions";

import { PageFeatureGate } from "@/components/PageFeatureGate";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";

export const Route = createFileRoute("/_authenticated/storyboard/$projectId")({
  head: () => ({ meta: [{ title: "Shot Wall — SceneSmith Studio" }] }),
  component: GatedStoryboard,
  errorComponent: RouteErrorBoundary,
});

function GatedStoryboard() {
  return (
    <PageFeatureGate feature="storyboard">
      <Storyboard />
    </PageFeatureGate>
  );
}


const STYLES = ["Cinematic", "Noir", "Anime", "Storyboard sketch", "Photoreal", "Watercolor", "Comic"];

function Storyboard() {
  const { projectId } = Route.useParams();
  const qc = useQueryClient();
  const callGen = useServerFn(generateStoryboardPanel);

  const { data: project } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => (await supabase.from("projects").select("*").eq("id", projectId).single()).data,
  });
  const { data: scenes = [] } = useQuery({
    queryKey: ["scenes", projectId],
    queryFn: async () => (await supabase.from("scenes").select("*").eq("project_id", projectId).order("order_index")).data ?? [],
  });
  const { data: panels = [] } = useQuery({
    queryKey: ["storyboard", projectId],
    queryFn: async () => (await supabase.from("storyboard_assets").select("*").eq("project_id", projectId).order("created_at", { ascending: false })).data ?? [],
  });

  const [sceneId, setSceneId] = useState<string | undefined>();
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState(STYLES[0]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!sceneId && scenes.length) setSceneId(scenes[0].id);
  }, [scenes, sceneId]);

  useEffect(() => {
    const s = scenes.find((s: any) => s.id === sceneId);
    if (s && !prompt) {
      setPrompt([s.scene_heading, s.location, s.time_of_day, s.emotional_purpose].filter(Boolean).join(", "));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneId]);

  const gen = useMutation({
    mutationFn: async () => callGen({ data: { projectId, sceneId, prompt, style } }),
    onSuccess: (panel: any) => {
      qc.invalidateQueries({ queryKey: ["storyboard", projectId] });
      if (panel?.status === "demo") toast.info("Showing a demo panel — image generation didn't return an image.");
      else toast.success("Panel generated");
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to generate"),
  });

  const run = async () => {
    if (!prompt.trim()) { toast.error("Add a prompt or pick a scene"); return; }
    setLoading(true); try { await gen.mutateAsync(); } finally { setLoading(false); }
  };

  return (
    <AppShell>
      <ProjectNav projectId={projectId} title={project?.title} />
      <div className="max-w-6xl mx-auto px-4 py-8 grid lg:grid-cols-[340px_1fr] gap-6">
        <Card className="p-5 h-fit sticky top-20 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <ImageIcon className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Generate panel</h3>
          </div>
          <div>
            <Label>Scene</Label>
            <Select value={sceneId} onValueChange={setSceneId}>
              <SelectTrigger><SelectValue placeholder="(none)" /></SelectTrigger>
              <SelectContent>
                {scenes.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.title || s.scene_heading || "Untitled"}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Prompt</Label>
            <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={5} placeholder="A lone keeper on a rocky cliff at storm-blue dusk..." />
          </div>
          <div>
            <Label>Visual style</Label>
            <Select value={style} onValueChange={setStyle}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STYLES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button className="w-full" onClick={run} disabled={loading}>
            {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating...</> : <><Sparkles className="h-4 w-4 mr-2" />Generate Panel</>}
          </Button>
        </Card>

        <div>
          {panels.length === 0 ? (
            <Card className="p-12 text-center border-dashed">
              <ImageIcon className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <h3 className="font-semibold mb-1">No panels yet</h3>
              {scenes.length === 0 ? (
                <>
                  <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
                    You need at least one scene to auto-fill shot prompts. Add a scene on the Scene Board, or write a scene heading (INT./EXT.) in the editor.
                  </p>
                  <div className="flex items-center gap-2 justify-center flex-wrap">
                    <Button size="sm" asChild>
                      <Link to="/scenes/$projectId" params={{ projectId }}>Add a scene</Link>
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <Link to="/editor/$projectId" params={{ projectId }}>Open editor</Link>
                    </Button>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Describe a shot on the left and generate your first storyboard panel.</p>
              )}
            </Card>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {panels.map((p: any) => (
                <Card key={p.id} className="overflow-hidden">
                  {p.image_url && <img src={p.image_url} alt={p.prompt} className="w-full aspect-video object-cover" />}
                  <div className="p-3">
                    <p className="text-xs line-clamp-3 text-muted-foreground">{p.prompt}</p>
                    {p.style && <p className="text-[10px] text-primary mt-1">{p.style}</p>}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
