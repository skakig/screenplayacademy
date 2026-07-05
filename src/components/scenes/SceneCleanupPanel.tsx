import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RefreshCw, Trash2, ExternalLink, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { buildOutline, looksLikeStructuralLine, type Block } from "@/lib/editor/manuscriptAnalyzer";
import { syncManuscriptScenes } from "@/lib/editor/sceneSync.functions";

/**
 * Because scene sync does not delete stale scenes and the schema has no
 * `metadata.source` column, we infer auto-detected scenes by matching a
 * scene row's (order_index, scene_heading) to a scene_heading block in the
 * current manuscript. Deep-links open the editor at that block id when we
 * have one.
 */
export function SceneCleanupPanel({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const callSync = useServerFn(syncManuscriptScenes);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<null | { ids: string[]; label: string; hasManual: boolean }>(null);

  const { data: scenes = [] } = useQuery<any[]>({
    queryKey: ["scenes", projectId],
    queryFn: async () => {
      const { data } = await supabase.from("scenes").select("*").eq("project_id", projectId).order("order_index");
      return data ?? [];
    },
  });

  const { data: blocks = [] } = useQuery<Block[]>({
    queryKey: ["script-blocks-for-scene-cleanup", projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from("script_blocks")
        .select("id,block_type,content,order_index,metadata")
        .eq("project_id", projectId)
        .order("order_index");
      return (data ?? []) as Block[];
    },
  });

  const analysis = useMemo(() => {
    const outline = buildOutline(blocks);
    const headingByOrder = new Map<number, { title: string; blockId: string | null }>();
    outline.forEach((s, i) => headingByOrder.set(i, { title: s.title, blockId: s.headingBlockId }));
    // A scene row is inferred-auto when its (order_index, scene_heading) match manuscript outline OR its heading is structural nonsense.
    return scenes.map((s: any) => {
      const outlineMatch = headingByOrder.get(s.order_index);
      const matchesManuscript = !!outlineMatch && outlineMatch.title.trim() === (s.scene_heading || "").trim();
      const looksJunk = !s.scene_heading || looksLikeStructuralLine(s.scene_heading) === false && (s.scene_heading?.length ?? 0) < 3;
      return {
        row: s,
        inferredAuto: matchesManuscript,
        blockId: outlineMatch?.blockId ?? null,
        junk: looksJunk,
      };
    });
  }, [scenes, blocks]);

  const autoRows = analysis.filter((a) => a.inferredAuto);
  const manualRows = analysis.filter((a) => !a.inferredAuto);

  const del = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("scenes").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scenes", projectId] });
      setSelected(new Set());
      setConfirm(null);
      toast.success("Removed");
    },
    onError: (e: any) => toast.error(e?.message ?? "Delete failed"),
  });

  const resync = useMutation({
    mutationFn: async () => {
      const outline = buildOutline(blocks).filter((s) => s.headingBlockId).map((s) => ({
        heading: s.title, location: s.location ?? "", time_of_day: s.timeOfDay ?? "", order_index: s.index,
      }));
      return callSync({ data: { projectId, scenes: outline } });
    },
    onSuccess: (r: any) => {
      qc.invalidateQueries({ queryKey: ["scenes", projectId] });
      toast.success(`Resynced. ${r?.created ?? 0} new, ${r?.updated ?? 0} updated.`);
    },
    onError: (e: any) => toast.error(e?.message ?? "Resync failed"),
  });

  const toggle = (id: string) => setSelected((prev) => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });

  const openInEditor = (blockId: string | null) => {
    if (!blockId) return toast.info("No source line — this scene isn't linked to a manuscript block.");
    navigate({ to: "/editor/$projectId", params: { projectId }, search: { block: blockId } as any });
  };

  const bulkDeleteSelected = () => {
    const ids = [...selected];
    if (!ids.length) return;
    const rows = analysis.filter((a) => ids.includes(a.row.id));
    const hasManual = rows.some((r) => !r.inferredAuto);
    setConfirm({ ids, label: `${ids.length} scene${ids.length === 1 ? "" : "s"}`, hasManual });
  };

  return (
    <Card className="p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <Wand2 className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-display text-lg">Review Auto-Detected Scenes</h2>
        <Badge variant="outline" className="text-[10px]">{autoRows.length} auto</Badge>
        <Badge variant="outline" className="text-[10px]">{manualRows.length} manual</Badge>
        <div className="flex-1" />
        <Button size="sm" variant="outline" onClick={() => resync.mutate()} disabled={resync.isPending}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${resync.isPending ? "animate-spin" : ""}`} />
          Resync from manuscript
        </Button>
        <Button size="sm" variant="destructive" disabled={selected.size === 0} onClick={bulkDeleteSelected}>
          <Trash2 className="h-3.5 w-3.5 mr-1.5" />Delete selected ({selected.size})
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Scenes with a matching manuscript heading are marked auto. Manual scenes require confirmation to delete.
      </p>
      <div className="rounded-md border border-border/60 divide-y divide-border/40 max-h-[420px] overflow-auto">
        {analysis.map((a) => (
          <div key={a.row.id} className="flex items-center gap-3 px-3 py-2">
            <Checkbox checked={selected.has(a.row.id)} onCheckedChange={() => toggle(a.row.id)} aria-label={`Select ${a.row.title || a.row.scene_heading || "scene"}`} />
            <div className="flex-1 min-w-0">
              <div className="text-sm truncate font-medium">{a.row.title || a.row.scene_heading || "Untitled"}</div>
              <div className="text-[10px] text-muted-foreground truncate">
                #{a.row.order_index} · {a.row.scene_heading || "—"}
              </div>
            </div>
            <Badge variant="outline" className={
              "text-[10px] " + (a.inferredAuto ? "text-muted-foreground" : "text-primary border-primary/40")
            }>
              {a.inferredAuto ? "auto" : "manual"}
            </Badge>
            <Button size="sm" variant="ghost" disabled={!a.blockId} onClick={() => openInEditor(a.blockId)}>
              <ExternalLink className="h-3.5 w-3.5 mr-1" />Open
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive"
              onClick={() => setConfirm({ ids: [a.row.id], label: a.row.title || a.row.scene_heading || "scene", hasManual: !a.inferredAuto })}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {confirm?.label}?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.hasManual
                ? "Includes manual scene notes. This can't be undone. Your screenplay text is not affected."
                : "This removes the scene note. Your screenplay text is not affected."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); if (confirm) del.mutate(confirm.ids); }} disabled={del.isPending}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
