import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, ChevronDown, ChevronRight, Trash2, PencilLine, Check } from "lucide-react";
import { toast } from "sonner";
import { detectCleanupCandidates, type CleanupCandidate } from "@/lib/characters/cleanup";
import { completenessPct } from "./tmh";
import { bulkDeleteCharacters, upsertCharacter } from "@/lib/characters.functions";

export function CastCleanupPanel({
  projectId,
  characters,
  relCounts,
  sceneCounts,
}: {
  projectId: string;
  characters: any[];
  relCounts: Record<string, number>;
  sceneCounts: Record<string, number>;
}) {
  const qc = useQueryClient();
  const callBulk = useServerFn(bulkDeleteCharacters);
  const callUpsert = useServerFn(upsertCharacter);
  const [open, setOpen] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState<null | { ids: string[]; label: string }>(null);
  const [renaming, setRenaming] = useState<Record<string, string>>({});

  const candidates = useMemo(
    () => detectCleanupCandidates(characters, {
      relCounts, sceneCounts, completeness: (r) => completenessPct(r),
    }),
    [characters, relCounts, sceneCounts],
  );

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["characters", projectId] });
    qc.invalidateQueries({ queryKey: ["relationship-counts", projectId] });
    qc.invalidateQueries({ queryKey: ["scene-counts", projectId] });
  };

  const bulkDel = useMutation({
    mutationFn: async (ids: string[]) => callBulk({ data: { ids } }),
    onSuccess: (r: any) => {
      invalidate();
      setSelected(new Set());
      setConfirming(null);
      toast.success(`Removed ${r?.deleted ?? "selected"} character${r?.deleted === 1 ? "" : "s"}`);
    },
    onError: (e: any) => toast.error(e?.message ?? "Delete failed"),
  });

  const rename = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) =>
      callUpsert({ data: { id, project_id: projectId, patch: { name } } }),
    onSuccess: (_r, v) => {
      invalidate();
      setRenaming((prev) => { const next = { ...prev }; delete next[v.id]; return next; });
      toast.success("Renamed");
    },
    onError: (e: any) => toast.error(e?.message ?? "Rename failed"),
  });

  if (candidates.length === 0) return null;

  const highCount = candidates.filter((c) => c.confidence === "high").length;
  const toggle = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const selectAll = (which: "all" | "high") => {
    const ids = which === "high"
      ? candidates.filter((c) => c.confidence === "high").map((c) => c.id)
      : candidates.map((c) => c.id);
    setSelected(new Set(ids));
  };

  return (
    <Card className="border-amber-500/40 bg-amber-500/[0.03]">
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
        onClick={() => setOpen((o) => !o)}
        type="button"
      >
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        <span className="text-sm font-medium">Review Detected Cast</span>
        <Badge variant="outline" className="text-[10px]">{candidates.length} to review</Badge>
        {highCount > 0 && (
          <Badge className="text-[10px] bg-amber-500/20 text-amber-600 border-amber-500/40" variant="outline">
            {highCount} high-confidence
          </Badge>
        )}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            These saved characters look like scene headings, transitions, or empty stubs from parsing. Keep, rename, or delete them. Screenplay text is never touched.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => selectAll("high")}>Select high-confidence</Button>
            <Button size="sm" variant="outline" onClick={() => selectAll("all")}>Select all</Button>
            <Button size="sm" variant="outline" onClick={() => setSelected(new Set())} disabled={selected.size === 0}>Clear</Button>
            <div className="flex-1" />
            <Button
              size="sm"
              variant="destructive"
              disabled={selected.size === 0 || bulkDel.isPending}
              onClick={() => setConfirming({ ids: [...selected], label: `${selected.size} selected` })}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />Delete selected ({selected.size})
            </Button>
          </div>

          <div className="rounded-md border border-border/60 divide-y divide-border/40">
            {candidates.map((c) => (
              <Row
                key={c.id}
                c={c}
                selected={selected.has(c.id)}
                onToggle={() => toggle(c.id)}
                renaming={renaming[c.id]}
                onRenameStart={() => setRenaming((p) => ({ ...p, [c.id]: c.name }))}
                onRenameChange={(v) => setRenaming((p) => ({ ...p, [c.id]: v }))}
                onRenameCancel={() =>
                  setRenaming((p) => { const n = { ...p }; delete n[c.id]; return n; })
                }
                onRenameSave={() => {
                  const name = (renaming[c.id] ?? "").trim();
                  if (!name) return toast.error("Name cannot be empty");
                  rename.mutate({ id: c.id, name });
                }}
                onDelete={() => setConfirming({ ids: [c.id], label: c.name })}
              />
            ))}
          </div>
        </div>
      )}

      <AlertDialog open={!!confirming} onOpenChange={(o) => !o && setConfirming(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {confirming?.label}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the character{confirming?.ids.length && confirming.ids.length > 1 ? "s" : ""}, their relationships, and scene-state notes. Your screenplay text is not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); if (confirming) bulkDel.mutate(confirming.ids); }}
              disabled={bulkDel.isPending}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function Row({
  c, selected, onToggle, renaming, onRenameStart, onRenameChange, onRenameCancel, onRenameSave, onDelete,
}: {
  c: CleanupCandidate;
  selected: boolean;
  onToggle: () => void;
  renaming: string | undefined;
  onRenameStart: () => void;
  onRenameChange: (v: string) => void;
  onRenameCancel: () => void;
  onRenameSave: () => void;
  onDelete: () => void;
}) {
  const isRenaming = renaming !== undefined;
  return (
    <div className="flex items-center gap-3 px-3 py-2">
      <Checkbox checked={selected} onCheckedChange={onToggle} aria-label={`Select ${c.name}`} />
      <div className="flex-1 min-w-0">
        {isRenaming ? (
          <Input
            autoFocus
            value={renaming}
            onChange={(e) => onRenameChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") onRenameSave(); if (e.key === "Escape") onRenameCancel(); }}
            className="h-8"
          />
        ) : (
          <div className="font-mono text-xs truncate">{c.name}</div>
        )}
        <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-2">
          <Badge variant="outline" className={
            "text-[9px] " + (c.confidence === "high" ? "text-amber-600 border-amber-500/40" : "text-muted-foreground")
          }>
            {c.confidence === "high" ? "structural" : "empty stub"}
          </Badge>
          <span>{c.relCount} rel · {c.sceneCount} scene</span>
        </div>
      </div>
      {isRenaming ? (
        <>
          <Button size="sm" variant="ghost" onClick={onRenameSave}><Check className="h-3.5 w-3.5" /></Button>
          <Button size="sm" variant="ghost" onClick={onRenameCancel}>Cancel</Button>
        </>
      ) : (
        <>
          <Button size="sm" variant="ghost" onClick={onRenameStart}>
            <PencilLine className="h-3.5 w-3.5 mr-1" />Rename
          </Button>
          <Button size="sm" variant="ghost" className="text-destructive" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5 mr-1" />Delete
          </Button>
        </>
      )}
    </div>
  );
}
