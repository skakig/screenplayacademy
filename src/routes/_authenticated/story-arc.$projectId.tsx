import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { ProjectNav } from "@/components/ProjectNav";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { upsertStoryArc } from "@/lib/arc.functions";

export const Route = createFileRoute("/_authenticated/story-arc/$projectId")({
  head: () => ({ meta: [{ title: "Story Arc — SceneSmith AI" }] }),
  component: StoryArcPage,
  errorComponent: ({ error, reset }) => (
    <div className="p-8 text-center text-sm text-muted-foreground">
      {error?.message} <button onClick={reset} className="text-primary underline ml-2">Retry</button>
    </div>
  ),
});

const STRUCTURES = [
  "Three-Act Feature", "Five-Act TV", "Save the Cat", "Hero's Journey",
  "Short Film", "TV Pilot", "Comic Issue", "Audio Drama",
];
const ARC_TYPES = ["Transformation", "Fall", "Flat / Tested", "Redemption", "Corruption", "Tragedy", "Coming of Age"];

function StoryArcPage() {
  const { projectId } = Route.useParams();
  const qc = useQueryClient();
  const save = useServerFn(upsertStoryArc);

  const { data: project } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => (await supabase.from("projects").select("*").eq("id", projectId).single()).data,
  });

  const { data: arc } = useQuery({
    queryKey: ["story-arc", projectId],
    queryFn: async () => (await supabase.from("story_arcs").select("*").eq("project_id", projectId).maybeSingle()).data,
  });

  const persist = useMutation({
    mutationFn: async (patch: Record<string, any>) => {
      await save({ data: { project_id: projectId, patch } });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["story-arc", projectId] }),
  });

  return (
    <AppShell>
      <ProjectNav projectId={projectId} title={project?.title} />
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <header>
          <h1 className="font-display text-3xl font-bold tracking-tight">Story Arc</h1>
          <p className="text-sm text-muted-foreground mt-1">The skeleton of your screenplay. Track structure, theme, and the turning points that hold the whole story together.</p>
        </header>

        <Card className="p-6 space-y-4 bg-card/40">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Arc Type" type="select" options={ARC_TYPES} value={arc?.arc_type} onSave={(v) => persist.mutate({ arc_type: v })} />
            <Field label="Structure Model" type="select" options={STRUCTURES} value={arc?.structure_model} onSave={(v) => persist.mutate({ structure_model: v })} />
          </div>
          <Field label="Central Dramatic Question" type="text" value={arc?.central_question} onSave={(v) => persist.mutate({ central_question: v })}
            placeholder="Will the detective expose the truth even if it destroys his family?" />
          <Field label="Theme" type="text" value={arc?.theme} onSave={(v) => persist.mutate({ theme: v })}
            placeholder="Truth vs. protection" />
        </Card>

        <Card className="p-6 space-y-4 bg-card/40">
          <h2 className="font-display text-lg font-semibold">Turning Points</h2>
          <Field label="Opening State" type="textarea" value={arc?.opening_state} onSave={(v) => persist.mutate({ opening_state: v })}
            placeholder="Where do we find the world, and the protagonist, when the story begins?" />
          <Field label="Midpoint Shift" type="textarea" value={arc?.midpoint_shift} onSave={(v) => persist.mutate({ midpoint_shift: v })}
            placeholder="The pivot that flips the story's premise." />
          <Field label="Darkest Moment" type="textarea" value={arc?.darkest_moment} onSave={(v) => persist.mutate({ darkest_moment: v })}
            placeholder="All is lost. The lie wins." />
          <Field label="Climax Choice" type="textarea" value={arc?.climax_choice} onSave={(v) => persist.mutate({ climax_choice: v })}
            placeholder="The irreversible decision that proves who they've become." />
          <Field label="Final State" type="textarea" value={arc?.final_state} onSave={(v) => persist.mutate({ final_state: v })}
            placeholder="The new world. The image we leave the audience with." />
        </Card>
      </div>
    </AppShell>
  );
}

function Field({
  label, type, value, options, placeholder, onSave,
}: {
  label: string;
  type: "text" | "textarea" | "select";
  value?: string | null;
  options?: string[];
  placeholder?: string;
  onSave: (v: string) => void;
}) {
  const [v, setV] = useState<string>(value ?? "");
  useEffect(() => setV(value ?? ""), [value]);
  const commit = () => { if (v !== (value ?? "")) onSave(v); };
  return (
    <div>
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      {type === "textarea" ? (
        <Textarea value={v} onChange={(e) => setV(e.target.value)} onBlur={commit} placeholder={placeholder} rows={3} className="mt-1.5" />
      ) : type === "select" ? (
        <Select value={v} onValueChange={(nv) => { setV(nv); onSave(nv); }}>
          <SelectTrigger className="mt-1.5"><SelectValue placeholder="—" /></SelectTrigger>
          <SelectContent>{(options || []).map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
        </Select>
      ) : (
        <Input value={v} onChange={(e) => setV(e.target.value)} onBlur={commit} placeholder={placeholder} className="mt-1.5" />
      )}
    </div>
  );
}
