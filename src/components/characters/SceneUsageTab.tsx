import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { TMHBadge } from "./TMHBadge";
import { tmhLabel } from "./tmh";
import { upsertSceneState } from "@/lib/characters.functions";

export function SceneUsageTab({ projectId, characterId }: { projectId: string; characterId: string }) {
  const qc = useQueryClient();
  const callUpsert = useServerFn(upsertSceneState);

  const { data: scenes = [] } = useQuery({
    queryKey: ["scenes", projectId],
    queryFn: async () => (await supabase.from("scenes").select("*").eq("project_id", projectId).order("order_index")).data ?? [],
  });
  const { data: states = [] } = useQuery({
    queryKey: ["scene-states", characterId],
    queryFn: async () => (await supabase.from("character_scene_states").select("*").eq("character_id", characterId)).data ?? [],
  });

  const byScene = new Map((states as any[]).map((s) => [s.scene_id, s]));

  if ((scenes as any[]).length === 0) {
    return <p className="text-xs text-muted-foreground italic">Add scenes to track this character's per-scene state.</p>;
  }

  return (
    <div className="space-y-3">
      {(scenes as any[]).map((scene) => (
        <SceneRow
          key={scene.id}
          scene={scene}
          existing={byScene.get(scene.id)}
          onSave={async (patch) => {
            await callUpsert({ data: { id: byScene.get(scene.id)?.id, project_id: projectId, character_id: characterId, scene_id: scene.id, patch } });
            toast.success("Saved");
            qc.invalidateQueries({ queryKey: ["scene-states", characterId] });
          }}
        />
      ))}
    </div>
  );
}

function SceneRow({ scene, existing, onSave }: any) {
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState<any>(existing ?? {});
  const [busy, setBusy] = useState(false);

  return (
    <Card className="p-3">
      <button type="button" className="w-full text-left" onClick={() => setOpen(!open)}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">{scene.title || scene.scene_heading || "Untitled scene"}</div>
            {scene.plot_purpose && <div className="text-[11px] text-muted-foreground truncate">{scene.plot_purpose}</div>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {existing?.tmh_level && <TMHBadge level={existing.tmh_level} size="xs" />}
            {existing?.emotional_state && <span className="text-[10px] text-muted-foreground">{existing.emotional_state}</span>}
          </div>
        </div>
      </button>
      {open && (
        <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-border/60">
          {["emotional_state","goal_in_scene","fear_in_scene","tactic","moral_pressure","relationship_shift","secret_status"].map((k) => (
            <div key={k}>
              <Label className="text-xs capitalize">{k.replace(/_/g, " ")}</Label>
              <Input value={local[k] ?? ""} onChange={(e) => setLocal({ ...local, [k]: e.target.value })} />
            </div>
          ))}
          <div className="col-span-2">
            <Label className="text-xs">Continuity notes</Label>
            <Textarea value={local.continuity_notes ?? ""} rows={2} onChange={(e) => setLocal({ ...local, continuity_notes: e.target.value })} />
          </div>
          <div className="col-span-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">TMH level in scene</Label>
              <span className="text-xs text-muted-foreground">{tmhLabel(local.tmh_level)}</span>
            </div>
            <Slider min={1} max={9} step={1} value={[local.tmh_level ?? 5]} onValueChange={(v) => setLocal({ ...local, tmh_level: v[0] })} />
          </div>
          <div className="col-span-2 flex justify-end">
            <Button size="sm" disabled={busy} onClick={async () => { setBusy(true); try { await onSave(local); } finally { setBusy(false); } }}>
              {busy ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}Save scene state
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
