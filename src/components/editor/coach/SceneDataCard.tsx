import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Save, Target } from "lucide-react";
import { toast } from "sonner";

type Props = { projectId: string; activeSceneIndex: number | null };

type SceneRow = {
  id: string;
  order_index: number;
  plot_purpose: string | null;
  conflict: string | null;
  reversal: string | null;
  emotional_purpose: string | null;
  scene_heading: string | null;
};

const FIELDS: { key: keyof SceneRow; label: string; placeholder: string; rows?: number }[] = [
  { key: "plot_purpose", label: "Purpose", placeholder: "What this scene accomplishes for the story…", rows: 2 },
  { key: "reversal", label: "Turn", placeholder: "The shift that happens — value change…", rows: 2 },
  { key: "conflict", label: "Stakes", placeholder: "What's at risk if the goal fails…", rows: 2 },
  { key: "emotional_purpose", label: "Moral / Theme", placeholder: "The moral pressure or thematic beat…", rows: 2 },
];

/**
 * Editable craft fields for the current scene — Purpose / Turn / Stakes /
 * Moral. Persists to the `scenes` table.
 */
export function SceneDataCard({ projectId, activeSceneIndex }: Props) {
  const qc = useQueryClient();
  const { data: scene, isLoading } = useQuery({
    queryKey: ["scene-by-idx", projectId, activeSceneIndex],
    enabled: activeSceneIndex !== null && activeSceneIndex >= 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scenes")
        .select("id, order_index, plot_purpose, conflict, reversal, emotional_purpose, scene_heading")
        .eq("project_id", projectId)
        .eq("order_index", activeSceneIndex as number)
        .maybeSingle();
      if (error) throw error;
      return data as SceneRow | null;
    },
  });

  const [local, setLocal] = useState<Partial<SceneRow>>({});
  useEffect(() => {
    setLocal(scene ?? {});
  }, [scene?.id]);

  const save = useMutation({
    mutationFn: async () => {
      if (!scene?.id) throw new Error("No scene to save");
      const { error } = await supabase
        .from("scenes")
        .update({
          plot_purpose: local.plot_purpose ?? null,
          conflict: local.conflict ?? null,
          reversal: local.reversal ?? null,
          emotional_purpose: local.emotional_purpose ?? null,
        })
        .eq("id", scene.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scenes", projectId] });
      qc.invalidateQueries({ queryKey: ["scene-by-idx", projectId, activeSceneIndex] });
      toast.success("Scene craft saved");
    },
    onError: (e: any) => toast.error(e?.message ?? "Couldn't save"),
  });

  if (activeSceneIndex === null || activeSceneIndex < 0) {
    return (
      <div className="rounded-lg border border-border/50 bg-card/40 p-3 text-xs text-muted-foreground italic">
        Place your cursor in a scene to edit its craft data.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border/60 bg-card/50 p-3 space-y-2.5">
      <div className="flex items-center gap-1.5">
        <Target className="h-3 w-3 text-primary" />
        <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Scene Craft
        </h4>
        {scene?.scene_heading && (
          <span className="text-[10px] text-muted-foreground/70 truncate font-mono">
            · {scene.scene_heading}
          </span>
        )}
        {isLoading && <Loader2 className="h-3 w-3 ml-auto animate-spin text-muted-foreground" />}
      </div>
      {!scene && !isLoading ? (
        <p className="text-xs text-muted-foreground italic">
          Scene index not synced yet. Keep writing — fields will appear after autosave.
        </p>
      ) : (
        <>
          {FIELDS.map((f) => (
            <div key={f.key} className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground/80">
                {f.label}
              </label>
              {f.rows && f.rows > 1 ? (
                <Textarea
                  value={(local[f.key] as string) ?? ""}
                  onChange={(e) => setLocal((p) => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="text-xs min-h-[44px]"
                />
              ) : (
                <Input
                  value={(local[f.key] as string) ?? ""}
                  onChange={(e) => setLocal((p) => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="text-xs h-7"
                />
              )}
            </div>
          ))}
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending || !scene?.id}
            className="w-full inline-flex items-center justify-center gap-1.5 text-[11px] py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors font-medium"
          >
            {save.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Save className="h-3 w-3" />
            )}
            Save craft
          </button>
        </>
      )}
    </div>
  );
}
