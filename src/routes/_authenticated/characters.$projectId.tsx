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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, User, Sparkles, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { aiAssist } from "@/lib/ai.functions";

export const Route = createFileRoute("/_authenticated/characters/$projectId")({
  head: () => ({ meta: [{ title: "Characters — SceneSmith AI" }] }),
  component: CharactersPage,
});

const FIELDS = [
  { key: "role", label: "Role" }, { key: "age", label: "Age" }, { key: "archetype", label: "Archetype" },
  { key: "external_goal", label: "External goal" }, { key: "internal_need", label: "Internal need" },
  { key: "wound", label: "Wound" }, { key: "secret", label: "Secret" }, { key: "fear", label: "Fear" },
  { key: "contradiction", label: "Contradiction" }, { key: "voice_style", label: "Voice style" },
  { key: "speech_patterns", label: "Speech patterns" }, { key: "visual_description", label: "Visual description" },
  { key: "costume_notes", label: "Costume notes" }, { key: "relationships", label: "Relationships" },
  { key: "character_arc", label: "Character arc" },
] as const;

function CharactersPage() {
  const { projectId } = Route.useParams();
  const qc = useQueryClient();
  const callAi = useServerFn(aiAssist);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const { data: project } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => (await supabase.from("projects").select("*").eq("id", projectId).single()).data,
  });

  const { data: characters = [] } = useQuery({
    queryKey: ["characters", projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from("characters").select("*").eq("project_id", projectId).order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const save = useMutation({
    mutationFn: async (c: any) => {
      if (c.id) {
        const { id, ...rest } = c;
        const { error } = await supabase.from("characters").update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("characters").insert({ ...c, project_id: projectId });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["characters", projectId] }); setOpen(false); setEditing(null); toast.success("Saved"); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("characters").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["characters", projectId] }),
  });

  const generateProfile = async () => {
    if (!editing?.name) { toast.error("Add a character name first"); return; }
    setAiLoading(true);
    try {
      const ctx = `Project: ${project?.title}\nGenre: ${project?.genre ?? ""}\nLogline: ${project?.logline ?? ""}\nCharacter name: ${editing.name}\nRole: ${editing.role ?? ""}`;
      const prompt = `Generate a complete character profile for "${editing.name}". Return JSON with keys: role, age, archetype, external_goal, internal_need, wound, secret, fear, contradiction, voice_style, speech_patterns, visual_description, costume_notes, character_arc. Only JSON.`;
      const res = await callAi({ data: { projectId, tool: "Create character", prompt, context: ctx } });
      const json = res.text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(json);
      setEditing({ ...editing, ...parsed });
      toast.success("Profile generated — review and save");
    } catch (e: any) {
      toast.error(e.message ?? "AI failed");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <AppShell>
      <ProjectNav projectId={projectId} title={project?.title} />
      <div className="max-w-[1400px] mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Characters</h1>
            <p className="text-sm text-muted-foreground mt-1">Build distinctive, contradictory, alive characters.</p>
          </div>
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditing({ name: "" })}><Plus className="h-4 w-4 mr-2" />New Character</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editing?.id ? "Edit Character" : "New Character"}</DialogTitle></DialogHeader>
              {editing && (
                <div className="space-y-3">
                  <div><Label>Name *</Label><Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
                  <Button type="button" variant="outline" size="sm" onClick={generateProfile} disabled={aiLoading} className="w-full">
                    {aiLoading ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Generating...</> : <><Sparkles className="h-3.5 w-3.5 mr-1.5" />Generate full profile with AI</>}
                  </Button>
                  <div className="grid grid-cols-2 gap-3">
                    {FIELDS.map((f) => (
                      <div key={f.key} className={["external_goal","internal_need","wound","visual_description","character_arc","relationships"].includes(f.key) ? "col-span-2" : ""}>
                        <Label>{f.label}</Label>
                        {["external_goal","internal_need","visual_description","character_arc","relationships","speech_patterns"].includes(f.key) ? (
                          <Textarea value={(editing as any)[f.key] ?? ""} onChange={(e) => setEditing({ ...editing, [f.key]: e.target.value })} rows={2} />
                        ) : (
                          <Input value={(editing as any)[f.key] ?? ""} onChange={(e) => setEditing({ ...editing, [f.key]: e.target.value })} />
                        )}
                      </div>
                    ))}
                  </div>
                  <Button className="w-full" disabled={!editing.name || save.isPending} onClick={() => save.mutate(editing)}>
                    {save.isPending ? "Saving..." : "Save"}
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>

        {characters.length === 0 ? (
          <Card className="p-12 text-center border-dashed">
            <User className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No characters yet. Start building your cast.</p>
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {characters.map((c) => (
              <Card key={c.id} className="p-5 hover:border-primary/50 transition group">
                <div className="flex items-start justify-between">
                  <div className="cursor-pointer flex-1" onClick={() => { setEditing(c); setOpen(true); }}>
                    <h3 className="font-display text-xl font-semibold group-hover:text-primary transition">{c.name}</h3>
                    {c.role && <p className="text-xs text-muted-foreground mt-0.5">{c.role}{c.archetype ? ` · ${c.archetype}` : ""}</p>}
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => del.mutate(c.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
                {c.external_goal && <p className="text-xs mt-3"><span className="text-muted-foreground">Wants: </span>{c.external_goal}</p>}
                {c.internal_need && <p className="text-xs mt-1"><span className="text-muted-foreground">Needs: </span>{c.internal_need}</p>}
                {c.wound && <p className="text-xs mt-1"><span className="text-muted-foreground">Wound: </span>{c.wound}</p>}
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
