// Pass B — Scene-level revision UI. Attaches to whatever scene the active
// block belongs to and lets the writer capture, rename, restore, or delete
// per-scene snapshots without leaving the CoachPane.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Camera, RotateCcw, Trash2, Pencil, Check, X, Loader2, Film, ArrowLeftRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import {
  captureSceneSnapshot,
  deleteSceneSnapshot,
  getSceneSnapshot,
  listSceneSnapshots,
  renameSceneSnapshot,
  restoreSceneSnapshot,
  type SceneSnapshotRow,
} from "@/lib/editor/sceneSnapshots.functions";
import { TakeDiffViewer, type TakeSummary } from "@/components/editor/TakeDiffViewer";

type Props = {
  projectId: string;
  activeBlockId?: string | null;
};

export function SceneSnapshotsPanel({ projectId, activeBlockId }: Props) {
  const qc = useQueryClient();
  const capture = useServerFn(captureSceneSnapshot);
  const listFn = useServerFn(listSceneSnapshots);
  const renameFn = useServerFn(renameSceneSnapshot);
  const deleteFn = useServerFn(deleteSceneSnapshot);
  const restoreFn = useServerFn(restoreSceneSnapshot);

  const [sceneId, setSceneId] = useState<string | null>(null);
  const [sceneLabel, setSceneLabel] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [pendingRestore, setPendingRestore] = useState<SceneSnapshotRow | null>(null);
  const [pendingDelete, setPendingDelete] = useState<SceneSnapshotRow | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [diffOpen, setDiffOpen] = useState(false);
  const [diffPair, setDiffPair] = useState<{ left: TakeSummary; right: TakeSummary } | null>(null);
  const [loadingDiff, setLoadingDiff] = useState(false);
  const getSnapshotFn = useServerFn(getSceneSnapshot);

  const toggleCompare = useCallback((id: string) => {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  }, []);

  const openCompare = useCallback(async () => {
    if (compareIds.length !== 2) return;
    setLoadingDiff(true);
    try {
      const [a, b] = await Promise.all(
        compareIds.map((id) => getSnapshotFn({ data: { snapshot_id: id } })),
      );
      // Order chronologically: older on the left, newer on the right.
      const [older, newer] =
        new Date(a.created_at).getTime() <= new Date(b.created_at).getTime()
          ? [a, b]
          : [b, a];
      const toSummary = (s: typeof a): TakeSummary => ({
        id: s.id,
        name: s.label ?? "Untitled snapshot",
        capturedAt: new Date(s.created_at).getTime(),
        payload: {
          savedAt: new Date(s.created_at).getTime(),
          blocks: (s.snapshot?.blocks ?? []).map((b) => ({
            block_type: b.block_type,
            content: b.content,
            order_index: b.order_index,
          })),
        },
      });
      setDiffPair({ left: toSummary(older), right: toSummary(newer) });
      setDiffOpen(true);
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't load snapshots for comparison");
    } finally {
      setLoadingDiff(false);
    }
  }, [compareIds, getSnapshotFn]);

  // Resolve the scene the active block belongs to.
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
    return () => { cancelled = true; };
  }, [activeBlockId]);

  const queryKey = useMemo(
    () => ["scene_snapshots", projectId, sceneId] as const,
    [projectId, sceneId],
  );

  const { data: snapshots = [], isLoading } = useQuery({
    queryKey,
    enabled: Boolean(sceneId),
    queryFn: () => listFn({ data: { project_id: projectId, scene_id: sceneId! } }),
  });

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey });
  }, [qc, queryKey]);

  const captureMut = useMutation({
    mutationFn: () =>
      capture({
        data: {
          project_id: projectId,
          scene_id: sceneId!,
          label: label.trim() || undefined,
        },
      }),
    onSuccess: () => {
      setLabel("");
      invalidate();
      toast.success("Scene snapshot captured");
    },
    onError: (e: any) => toast.error(e?.message ?? "Couldn't capture snapshot"),
  });

  const renameMut = useMutation({
    mutationFn: (v: { id: string; label: string }) =>
      renameFn({ data: { snapshot_id: v.id, label: v.label } }),
    onSuccess: () => {
      setEditingId(null);
      invalidate();
      toast.success("Renamed");
    },
    onError: (e: any) => toast.error(e?.message ?? "Rename failed"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { snapshot_id: id } }),
    onSuccess: () => {
      setPendingDelete(null);
      invalidate();
      toast.success("Snapshot deleted");
    },
    onError: (e: any) => toast.error(e?.message ?? "Delete failed"),
  });

  const restoreMut = useMutation({
    mutationFn: (id: string) =>
      restoreFn({ data: { snapshot_id: id, capture_current: true } }),
    onSuccess: () => {
      setPendingRestore(null);
      invalidate();
      qc.invalidateQueries({ queryKey: ["blocks", projectId] });
      toast.success("Scene restored — a pre-restore snapshot was auto-saved.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Restore failed"),
  });

  if (!activeBlockId || !sceneId) {
    return (
      <div className="rounded-md border border-dashed border-border/50 p-3 text-xs text-muted-foreground">
        Place your cursor in a scene to capture and manage scene snapshots.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Film className="h-3 w-3" />
        <span className="truncate">
          Scene: <strong className="text-foreground">{sceneLabel ?? "Untitled scene"}</strong>
        </span>
      </div>

      <div className="flex gap-2">
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Snapshot label (optional)"
          className="h-8 text-xs"
        />
        <Button
          size="sm"
          className="h-8"
          onClick={() => captureMut.mutate()}
          disabled={captureMut.isPending}
        >
          {captureMut.isPending ? (
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
          ) : (
            <Camera className="h-3.5 w-3.5 mr-1.5" />
          )}
          Snapshot
        </Button>
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {compareIds.length > 0
            ? `${compareIds.length}/2 selected`
            : "Select two to compare"}
        </span>
        <div className="flex items-center gap-1">
          {compareIds.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-[11px] px-2"
              onClick={() => setCompareIds([])}
            >
              Clear
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[11px] px-2"
            disabled={compareIds.length !== 2 || loadingDiff}
            onClick={openCompare}
          >
            {loadingDiff ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <ArrowLeftRight className="h-3 w-3 mr-1" />
            )}
            Compare
          </Button>
        </div>
      </div>

      <ScrollArea className="max-h-[280px] rounded-md border border-border/40">
        {isLoading ? (
          <div className="p-3 text-xs text-muted-foreground">Loading…</div>
        ) : snapshots.length === 0 ? (
          <div className="p-3 text-xs text-muted-foreground italic">
            No snapshots yet for this scene.
          </div>
        ) : (
          <ul className="divide-y divide-border/40">
            {snapshots.map((s) => {
              const checked = compareIds.includes(s.id);
              return (
              <li key={s.id} className="p-2 flex items-start gap-2 text-xs">
                <Checkbox
                  checked={checked}
                  onCheckedChange={() => toggleCompare(s.id)}
                  className="mt-0.5"
                  aria-label={`Select ${s.label ?? "snapshot"} for comparison`}
                />
                <div className="flex-1 min-w-0">
                  {editingId === s.id ? (
                    <div className="flex gap-1">
                      <Input
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        className="h-7 text-xs"
                        autoFocus
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() =>
                          renameMut.mutate({ id: s.id, label: editingValue.trim() })
                        }
                        disabled={!editingValue.trim() || renameMut.isPending}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => setEditingId(null)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="font-medium truncate">
                        {s.label ?? "Untitled snapshot"}
                      </div>
                      <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                        {formatDistanceToNow(new Date(s.created_at), { addSuffix: true })}
                        {" · "}
                        {s.block_count} blocks · {s.word_count} words
                      </div>
                    </>
                  )}
                </div>
                {editingId !== s.id && (
                  <div className="flex items-center gap-0.5">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      title="Rename"
                      onClick={() => {
                        setEditingId(s.id);
                        setEditingValue(s.label ?? "");
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      title="Restore"
                      onClick={() => setPendingRestore(s)}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive"
                      title="Delete"
                      onClick={() => setPendingDelete(s)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </ScrollArea>

      <AlertDialog
        open={!!pendingRestore}
        onOpenChange={(o) => !o && setPendingRestore(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore this scene snapshot?</AlertDialogTitle>
            <AlertDialogDescription>
              This will replace the current blocks in this scene with the snapshot
              contents. A pre-restore snapshot will be captured automatically so you can
              undo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingRestore && restoreMut.mutate(pendingRestore.id)}
            >
              Restore
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete snapshot?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. Restore first if you're not sure.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingDelete && deleteMut.mutate(pendingDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
