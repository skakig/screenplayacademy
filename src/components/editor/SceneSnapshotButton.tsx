// One-click "Take Snapshot" for the scene the cursor is in.
// Resolves scene_id from the active block's serverId and calls
// captureSceneSnapshot without leaving the editor.
import { useEffect, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { captureSceneSnapshot } from "@/lib/editor/sceneSnapshots.functions";

type Props = {
  projectId: string;
  activeBlockId?: string | null;
  variant?: "outline" | "ghost";
  size?: "sm" | "icon";
  className?: string;
};

export function SceneSnapshotButton({
  projectId,
  activeBlockId,
  variant = "outline",
  size = "sm",
  className,
}: Props) {
  const qc = useQueryClient();
  const capture = useServerFn(captureSceneSnapshot);
  const [sceneId, setSceneId] = useState<string | null>(null);
  const [sceneLabel, setSceneLabel] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!activeBlockId) {
      setSceneId(null);
      setSceneLabel(null);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("script_blocks")
        .select("scene_id, scenes(id, title, scene_heading)")
        .eq("id", activeBlockId)
        .maybeSingle();
      if (cancelled) return;
      const scene = (data as any)?.scenes ?? null;
      setSceneId((data as any)?.scene_id ?? null);
      setSceneLabel(scene?.title ?? scene?.scene_heading ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [activeBlockId]);

  const mut = useMutation({
    mutationFn: () =>
      capture({ data: { project_id: projectId, scene_id: sceneId! } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scene_snapshots", projectId, sceneId] });
      toast.success(
        sceneLabel ? `Snapshot captured — ${sceneLabel}` : "Scene snapshot captured",
      );
    },
    onError: (e: any) => toast.error(e?.message ?? "Couldn't capture snapshot"),
  });

  const disabled = !sceneId || mut.isPending;
  const title = !activeBlockId
    ? "Place your cursor in a scene to take a snapshot"
    : !sceneId
      ? "Cursor isn't inside a saved scene yet"
      : sceneLabel
        ? `Snapshot "${sceneLabel}"`
        : "Take a snapshot of this scene";

  return (
    <Button
      variant={variant}
      size={size}
      onClick={() => mut.mutate()}
      disabled={disabled}
      title={title}
      className={className}
    >
      {mut.isPending ? (
        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
      ) : (
        <Camera className="h-3.5 w-3.5 mr-1.5" />
      )}
      Take Snapshot
    </Button>
  );
}
