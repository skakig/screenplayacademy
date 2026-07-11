import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { ProjectNav } from "@/components/ProjectNav";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, LayoutGrid, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { SceneCleanupPanel } from "@/components/scenes/SceneCleanupPanel";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";

export const Route = createFileRoute("/_authenticated/scenes/$projectId")({
  head: () => ({ meta: [{ title: "Scene Board — SceneSmith Studio" }] }),
  component: ScenesPage,
  errorComponent: RouteErrorBoundary,
});

const STATUSES = ["idea", "drafting", "needs_rewrite", "locked"];

function ScenesPage() {
  const { projectId } = Route.useParams();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

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

  const save = useMutation({
    mutationFn: async (s: any) => {
      if (s.id) {
        const { id, ...rest } = s;
        const { error } = await supabase.from("scenes").update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("scenes").insert({ ...s, project_id: projectId, order_index: scenes.length });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["scenes", projectId] }); setOpen(false); setEditing(null); toast.success("Saved"); },
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("scenes").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scenes", projectId] }),
  });

  return (
    <AppShell>
      <ProjectNav projectId={projectId} title={project?.title} />
      <div className="max-w-[1400px] mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Scenes</h1>
            <p className="text-sm text-muted-foreground mt-1">Plan beat by beat before you write.</p>
          </div>
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditing({ title: "", status: "idea" })}><Plus className="h-4 w-4 mr-2" />New Scene</Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editing?.id ? "Edit Scene" : "New Scene"}</DialogTitle></DialogHeader>
              {editing && (
                <div className="space-y-3">
                  <div><Label>Title</Label><Input value={editing.title ?? ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} placeholder="The confrontation" /></div>
                  <div><Label>Scene heading</Label><Input value={editing.scene_heading ?? ""} onChange={(e) => setEditing({ ...editing, scene_heading: e.target.value })} placeholder="INT. KITCHEN - NIGHT" /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Location</Label><Input value={editing.location ?? ""} onChange={(e) => setEditing({ ...editing, location: e.target.value })} /></div>
                    <div><Label>Time of day</Label><Input value={editing.time_of_day ?? ""} onChange={(e) => setEditing({ ...editing, time_of_day: e.target.value })} /></div>
                  </div>
                  <div><Label>Emotional purpose</Label><Textarea rows={2} value={editing.emotional_purpose ?? ""} onChange={(e) => setEditing({ ...editing, emotional_purpose: e.target.value })} /></div>
                  <div><Label>Plot purpose</Label><Textarea rows={2} value={editing.plot_purpose ?? ""} onChange={(e) => setEditing({ ...editing, plot_purpose: e.target.value })} /></div>
                  <div><Label>Conflict</Label><Textarea rows={2} value={editing.conflict ?? ""} onChange={(e) => setEditing({ ...editing, conflict: e.target.value })} /></div>
                  <div><Label>Turn / reversal</Label><Textarea rows={2} value={editing.reversal ?? ""} onChange={(e) => setEditing({ ...editing, reversal: e.target.value })} /></div>
                  <div>
                    <Label>Status</Label>
                    <Select value={editing.status} onValueChange={(v) => setEditing({ ...editing, status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <Button className="w-full" disabled={save.isPending} onClick={() => save.mutate(editing)}>{save.isPending ? "Saving..." : "Save"}</Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
        <SceneCleanupPanel projectId={projectId} />


        {scenes.length === 0 ? (
          <Card className="p-12 text-center border-dashed">
            <LayoutGrid className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No scenes yet. Start outlining your story.</p>
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {scenes.map((s, i) => (
              <Card key={s.id} className="p-5 hover:border-primary/50 transition group">
                <div className="flex items-start justify-between mb-2">
                  <Badge variant="secondary" className="text-[10px]">#{i + 1}</Badge>
                  <div className="flex items-center gap-1">
                    <Badge variant="outline" className="text-[10px]">{s.status}</Badge>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => del.mutate(s.id)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </div>
                <div className="cursor-pointer" onClick={() => { setEditing(s); setOpen(true); }}>
                  {s.scene_heading && <p className="font-mono text-xs text-primary uppercase">{s.scene_heading}</p>}
                  <h3 className="font-display text-lg font-semibold mt-1">{s.title || "Untitled scene"}</h3>
                  {s.plot_purpose && <p className="text-xs text-muted-foreground mt-2 line-clamp-2"><span className="text-foreground/70">Plot:</span> {s.plot_purpose}</p>}
                  {s.conflict && <p className="text-xs text-muted-foreground mt-1 line-clamp-2"><span className="text-foreground/70">Conflict:</span> {s.conflict}</p>}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
