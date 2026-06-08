import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { ProjectNav } from "@/components/ProjectNav";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArcStatusBadge } from "@/components/arc/ArcStatusBadge";
import { TMHBadge } from "@/components/characters/TMHBadge";
import { diagnoseProject } from "@/lib/arc.functions";
import { StoryPulsePanel } from "@/components/storypulse/StoryPulsePanel";
import { AlertTriangle, ArrowRight, Loader2, Activity } from "lucide-react";

export const Route = createFileRoute("/_authenticated/arc-timeline/$projectId")({
  head: () => ({ meta: [{ title: "Arc Timeline — SceneSmith AI" }] }),
  component: ArcTimelinePage,
  errorComponent: ({ error, reset }) => (
    <div className="p-8 text-center">
      <p className="text-sm text-muted-foreground mb-2">{error?.message ?? "Failed to load timeline"}</p>
      <Button size="sm" onClick={reset}>Try again</Button>
    </div>
  ),
});

const FILTERS = ["All", "Weak", "No Turn", "No Character Movement", "No Stakes Change", "High Moral Pressure"];

function ArcTimelinePage() {
  const { projectId } = Route.useParams();
  const callDiagnose = useServerFn(diagnoseProject);
  const [filter, setFilter] = useState("All");
  const [trackChar, setTrackChar] = useState<string | "">("");
  const [diag, setDiag] = useState<{ warnings: any[] } | null>(null);
  const [diagLoading, setDiagLoading] = useState(false);

  const { data: project } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => (await supabase.from("projects").select("*").eq("id", projectId).single()).data,
  });

  const { data: scenes = [] } = useQuery({
    queryKey: ["scenes", projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from("scenes").select("*").eq("project_id", projectId).order("order_index");
      if (error) throw error;
      return data;
    },
  });

  const { data: beats = [] } = useQuery({
    queryKey: ["scene-arcs", projectId],
    queryFn: async () => {
      const { data } = await supabase.from("scene_arc_beats").select("*").eq("project_id", projectId);
      return data || [];
    },
  });

  const { data: characters = [] } = useQuery({
    queryKey: ["characters-lite", projectId],
    queryFn: async () => (await supabase.from("characters").select("id, name, role").eq("project_id", projectId).order("name")).data || [],
  });

  const { data: charStates = [] } = useQuery({
    queryKey: ["char-arc-states-all", projectId],
    queryFn: async () => (await supabase.from("character_scene_arc_states").select("*").eq("project_id", projectId)).data || [],
  });

  const beatMap = useMemo(() => new Map(beats.map((b: any) => [b.scene_id, b])), [beats]);
  const stateMap = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const s of charStates) {
      const arr = m.get(s.scene_id) || [];
      arr.push(s);
      m.set(s.scene_id, arr);
    }
    return m;
  }, [charStates]);

  const filtered = useMemo(() => {
    return scenes.filter((s: any) => {
      const b: any = beatMap.get(s.id);
      const states = stateMap.get(s.id) || [];
      if (trackChar && !states.some((st: any) => st.character_id === trackChar)) return false;
      if (filter === "All") return true;
      if (filter === "Weak") return (b?.scene_strength_score ?? 0) < 50;
      if (filter === "No Turn") return !b?.scene_turn;
      if (filter === "No Character Movement") return states.every((st: any) => !st.arc_movement || st.arc_movement === "No Change");
      if (filter === "No Stakes Change") return !b?.stakes_change;
      if (filter === "High Moral Pressure") return (b?.moral_pressure || "").length > 10;
      return true;
    });
  }, [scenes, beatMap, stateMap, filter, trackChar]);

  const runDiag = async () => {
    setDiagLoading(true);
    try {
      const r = await callDiagnose({ data: { project_id: projectId } });
      setDiag(r);
    } finally {
      setDiagLoading(false);
    }
  };

  return (
    <AppShell>
      <ProjectNav projectId={projectId} title={project?.title} />
      <div className="max-w-[1600px] mx-auto p-6 space-y-6">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">StoryPulse — Arc Timeline</h1>
            <p className="text-sm text-muted-foreground mt-1">See your whole story as a tactical map. Every scene must do real dramatic work.</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-[200px] text-xs h-8"><SelectValue /></SelectTrigger>
              <SelectContent>{FILTERS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={trackChar} onValueChange={(v) => setTrackChar(v === "_none" ? "" : v)}>
              <SelectTrigger className="w-[200px] text-xs h-8"><SelectValue placeholder="Character Track…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">All scenes</SelectItem>
                {characters.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={runDiag} disabled={diagLoading}>
              {diagLoading ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> : <Activity className="h-3 w-3 mr-1.5" />}
              Diagnose
            </Button>
          </div>
        </div>

        {diag && (
          <Card className="p-4 border-amber-500/30 bg-amber-500/5">
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5"><AlertTriangle className="h-4 w-4 text-amber-400" /> Diagnosis</h3>
            {diag.warnings.length === 0 ? (
              <p className="text-xs text-emerald-300">No warnings. Your arcs look healthy.</p>
            ) : (
              <ul className="text-xs space-y-1.5">
                {diag.warnings.map((w, i) => (
                  <li key={i} className="text-muted-foreground"><span className="text-amber-300 font-mono mr-2">{w.kind}</span>{w.message}</li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {filtered.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            No scenes match this filter.{" "}
            <Link to="/scenes/$projectId" params={{ projectId }} className="text-primary underline">Create scenes →</Link>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filtered.map((s: any, i: number) => {
              const b: any = beatMap.get(s.id);
              const states = stateMap.get(s.id) || [];
              const trackState = trackChar ? states.find((st: any) => st.character_id === trackChar) : null;
              return (
                <Card key={s.id} className="p-3 bg-card/40 border-border/60 hover:border-primary/40 transition-colors flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[10px] font-mono text-muted-foreground">SCENE {String(i + 1).padStart(2, "0")}{b?.act ? ` · ${b.act}` : ""}</div>
                      <div className="text-xs font-semibold uppercase tracking-wider truncate">{s.scene_heading || s.title || "Untitled"}</div>
                    </div>
                    <ArcStatusBadge status={b?.arc_status} score={b?.scene_strength_score} />
                  </div>
                  {b?.story_beat && <Badge variant="outline" className="text-[10px] w-fit">{b.story_beat}</Badge>}
                  {b?.scene_purpose && <p className="text-[11px] text-foreground/80 line-clamp-2"><span className="text-muted-foreground">Purpose:</span> {b.scene_purpose}</p>}
                  {b?.scene_turn && <p className="text-[11px] text-foreground/80 line-clamp-2"><span className="text-muted-foreground">Turn:</span> {b.scene_turn}</p>}
                  {b?.stakes_change && <p className="text-[11px] text-foreground/70 line-clamp-1"><span className="text-muted-foreground">Stakes:</span> {b.stakes_change}</p>}
                  {trackChar ? (
                    trackState ? (
                      <div className="mt-1 rounded bg-primary/5 border border-primary/20 p-2 text-[10px] space-y-1">
                        <div className="flex items-center gap-1.5">
                          <TMHBadge level={trackState.tmh_start_level} />
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          <TMHBadge level={trackState.tmh_end_level} />
                          {trackState.arc_movement && <span className="ml-auto text-primary">{trackState.arc_movement}</span>}
                        </div>
                        {trackState.goal_in_scene && <p className="text-muted-foreground line-clamp-1">Goal: {trackState.goal_in_scene}</p>}
                        {trackState.cost && <p className="text-muted-foreground line-clamp-1">Cost: {trackState.cost}</p>}
                      </div>
                    ) : <p className="text-[10px] text-muted-foreground">Not in scene</p>
                  ) : (
                    states.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {states.slice(0, 4).map((st: any) => {
                          const c = characters.find((c: any) => c.id === st.character_id);
                          return <Badge key={st.id} variant="outline" className="text-[10px]">{c?.name || "?"} {st.tmh_start_level && st.tmh_end_level ? `· L${st.tmh_start_level}→L${st.tmh_end_level}` : ""}</Badge>;
                        })}
                        {states.length > 4 && <Badge variant="outline" className="text-[10px]">+{states.length - 4}</Badge>}
                      </div>
                    )
                  )}
                  <div className="mt-auto pt-1">
                    <Link to="/editor/$projectId" params={{ projectId }} className="text-[10px] text-primary hover:underline">Open in editor →</Link>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
