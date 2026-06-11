import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
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
import {
  Clapperboard,
  RotateCcw,
  Trash2,
  Camera,
  Pencil,
  Check,
  X,
  Cloud,
  CloudOff,
  Loader2,
  ArrowLeftRight,
  FileDown,
  Bookmark,
  Upload,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { readDraft, type DraftPayload } from "./draftBackup";
import { formatDistanceToNow, format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { TakeDiffViewer } from "./TakeDiffViewer";
import { downloadPitchKitPdf } from "./pitchKitPdf";
import { ImportWizard } from "@/components/import/ImportWizard";
import { ImportDiagnosticsPanel } from "@/components/import/ImportDiagnosticsPanel";
import { getLatestImportReport } from "@/lib/import/diagnose.functions";
import { useServerFn } from "@tanstack/react-start";

type Take = {
  id: string;
  name: string;
  capturedAt: number;
  blockCount: number;
  wordCount: number;
  payload: DraftPayload;
  serverId?: string;
  syncStatus?: "synced" | "pending" | "error" | "local";
};

const TAKES_PREFIX = "scenesmith.takes.v1.";
const COMPARISONS_PREFIX = "scenesmith.comparisons.v1.";

function takesKey(projectId: string) {
  return TAKES_PREFIX + projectId;
}

type SavedComparison = {
  id: string;
  label: string;
  leftTakeId: string;
  rightTakeId: string;
  savedAt: number;
  serverId?: string;
  syncStatus?: "synced" | "pending" | "error" | "local";
};

function comparisonsKey(projectId: string) {
  return COMPARISONS_PREFIX + projectId;
}

function readComparisons(projectId: string): SavedComparison[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(comparisonsKey(projectId));
    if (!raw) return [];
    const arr = JSON.parse(raw) as SavedComparison[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeComparisons(projectId: string, items: SavedComparison[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(comparisonsKey(projectId), JSON.stringify(items));
  } catch {
    /* quota — silent */
  }
}

function mergeComparisons(local: SavedComparison[], remote: SavedComparison[]): SavedComparison[] {
  const byServer = new Map<string, SavedComparison>();
  const localOnly: SavedComparison[] = [];
  for (const c of local) {
    if (c.serverId) byServer.set(c.serverId, c);
    else localOnly.push(c);
  }
  for (const r of remote) {
    if (r.serverId) byServer.set(r.serverId, { ...r, syncStatus: "synced" });
  }
  const merged = [...byServer.values(), ...localOnly];
  merged.sort((a, b) => b.savedAt - a.savedAt);
  return merged.slice(0, 25);
}

function readTakes(projectId: string): Take[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(takesKey(projectId));
    if (!raw) return [];
    const arr = JSON.parse(raw) as Take[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeTakes(projectId: string, takes: Take[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(takesKey(projectId), JSON.stringify(takes));
  } catch {
    // quota — silent
  }
}

function countWords(payload: DraftPayload): number {
  return payload.blocks.reduce(
    (n, b) => n + ((b.content ?? "").trim().split(/\s+/).filter(Boolean).length),
    0,
  );
}

function mergeTakes(local: Take[], remote: Take[]): Take[] {
  // De-dupe by serverId, then by id; prefer remote payload (latest captured).
  const byServer = new Map<string, Take>();
  const localOnly: Take[] = [];

  for (const t of local) {
    if (t.serverId) byServer.set(t.serverId, t);
    else localOnly.push(t);
  }
  for (const r of remote) {
    if (r.serverId) byServer.set(r.serverId, { ...r, syncStatus: "synced" });
  }

  const merged = [...byServer.values(), ...localOnly];
  merged.sort((a, b) => b.capturedAt - a.capturedAt);
  return merged.slice(0, 25);
}

type Props = {
  projectId: string;
};

type SyncState = "idle" | "syncing" | "offline" | "error";

export function DraftHistoryPanel({ projectId }: Props) {
  const [takes, setTakes] = useState<Take[]>([]);
  const [name, setName] = useState("");
  const [syncState, setSyncState] = useState<SyncState>("idle");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");

  const [pendingRestore, setPendingRestore] = useState<Take | null>(null);
  const [pendingDiscard, setPendingDiscard] = useState<Take | null>(null);
  const [discardConfirmText, setDiscardConfirmText] = useState("");

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [diffOpen, setDiffOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [comparisons, setComparisons] = useState<SavedComparison[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [latestReportId, setLatestReportId] = useState<string | null>(null);
  const [diagOpen, setDiagOpen] = useState(false);
  const latestReport = useServerFn(getLatestImportReport);

  useEffect(() => {
    let cancelled = false;
    latestReport({ data: { projectId } })
      .then((r) => !cancelled && setLatestReportId(r?.id ?? null))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [projectId, latestReport, importOpen]);

  // Load comparisons (local + cloud) and backfill local-only entries once their takes have serverIds.
  useEffect(() => {
    let cancelled = false;
    const local = readComparisons(projectId);
    setComparisons(local);
    (async () => {
      try {
        const { data, error } = await supabase
          .from("draft_take_comparisons")
          .select("id, label, left_take_id, right_take_id, saved_at")
          .eq("project_id", projectId)
          .order("saved_at", { ascending: false })
          .limit(25);
        if (cancelled || error || !data) return;
        const remote: SavedComparison[] = data.map((r: any) => ({
          id: `cmp-srv-${r.id}`,
          serverId: r.id,
          label: r.label,
          leftTakeId: `take-srv-${r.left_take_id}`,
          rightTakeId: `take-srv-${r.right_take_id}`,
          savedAt: new Date(r.saved_at).getTime(),
          syncStatus: "synced",
        }));
        const merged = mergeComparisons(local, remote);
        writeComparisons(projectId, merged);
        if (!cancelled) setComparisons(merged);
      } catch {
        /* offline — keep local */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const pushComparison = useCallback(
    async (cmp: SavedComparison, leftServerId: string, rightServerId: string) => {
      try {
        const { data: userRes } = await supabase.auth.getUser();
        const userId = userRes.user?.id;
        if (!userId) return;
        const { data, error } = await supabase
          .from("draft_take_comparisons")
          .insert({
            project_id: projectId,
            user_id: userId,
            label: cmp.label,
            left_take_id: leftServerId,
            right_take_id: rightServerId,
            saved_at: new Date(cmp.savedAt).toISOString(),
          })
          .select("id")
          .single();
        if (error || !data) {
          setComparisons((prev) => {
            const next = prev.map((c) =>
              c.id === cmp.id ? { ...c, syncStatus: "error" as const } : c,
            );
            writeComparisons(projectId, next);
            return next;
          });
          return;
        }
        setComparisons((prev) => {
          const next = prev.map((c) =>
            c.id === cmp.id ? { ...c, serverId: data.id, syncStatus: "synced" as const } : c,
          );
          writeComparisons(projectId, next);
          return next;
        });
      } catch {
        /* offline — leave pending */
      }
    },
    [projectId],
  );

  // Backfill any local-only comparisons once both referenced takes have a serverId.
  useEffect(() => {
    const pending = comparisons.filter((c) => !c.serverId && c.syncStatus !== "pending");
    if (pending.length === 0) return;
    for (const c of pending) {
      const left = takes.find((t) => t.id === c.leftTakeId);
      const right = takes.find((t) => t.id === c.rightTakeId);
      if (left?.serverId && right?.serverId) {
        void pushComparison(c, left.serverId, right.serverId);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [takes, comparisons, pushComparison]);

  const saveComparison = (label: string) => {
    if (selectedIds.length !== 2) return;
    const [a, b] = selectedIds;
    const entry: SavedComparison = {
      id: `cmp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      label,
      leftTakeId: a,
      rightTakeId: b,
      savedAt: Date.now(),
      syncStatus: "pending",
    };
    const next = [entry, ...comparisons].slice(0, 25);
    writeComparisons(projectId, next);
    setComparisons(next);
    toast.success(`Saved comparison "${label}"`);

    const left = takes.find((t) => t.id === a);
    const right = takes.find((t) => t.id === b);
    if (left?.serverId && right?.serverId) {
      void pushComparison(entry, left.serverId, right.serverId);
    }
  };

  const reopenComparison = (cmp: SavedComparison) => {
    const left = takes.find((t) => t.id === cmp.leftTakeId);
    const right = takes.find((t) => t.id === cmp.rightTakeId);
    if (!left || !right) {
      toast.error("One of the takes in this comparison is no longer available.");
      return;
    }
    setSelectedIds([cmp.leftTakeId, cmp.rightTakeId]);
    setDiffOpen(true);
  };

  const deleteComparison = async (id: string) => {
    const target = comparisons.find((c) => c.id === id);
    const next = comparisons.filter((c) => c.id !== id);
    writeComparisons(projectId, next);
    setComparisons(next);
    if (target?.serverId) {
      const { error } = await supabase
        .from("draft_take_comparisons")
        .delete()
        .eq("id", target.serverId);
      if (error) toast.error("Couldn't sync delete to the cloud.");
    }
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      // keep most recent two
      const next = [...prev, id];
      return next.length > 2 ? next.slice(next.length - 2) : next;
    });
  };

  const exportPdf = async () => {
    if (takes.length === 0) {
      toast.error("No takes to export yet.");
      return;
    }
    setExporting(true);
    try {
      const { data: project } = await supabase
        .from("projects")
        .select("title")
        .eq("id", projectId)
        .maybeSingle();
      const title = project?.title ?? "Untitled project";
      const selected = selectedIds.length > 0 ? selectedIds : takes.slice(0, 3).map((t) => t.id);
      downloadPitchKitPdf(
        {
          projectTitle: title,
          takes: takes.map((t) => ({
            id: t.id,
            name: t.name,
            capturedAt: t.capturedAt,
            blockCount: t.blockCount,
            wordCount: t.wordCount,
            payload: t.payload,
          })),
          selectedTakeIds: selected,
        },
        `${title.replace(/\s+/g, "_")}-revisions.pdf`,
      );
      toast.success("Revisions PDF downloaded");
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't export PDF");
    } finally {
      setExporting(false);
    }
  };

  // Initial load + cloud sync
  useEffect(() => {
    let cancelled = false;
    const local = readTakes(projectId);
    setTakes(local);

    (async () => {
      setSyncState("syncing");
      try {
        const { data, error } = await supabase
          .from("draft_takes")
          .select("id, name, captured_at, block_count, word_count, payload")
          .eq("project_id", projectId)
          .order("captured_at", { ascending: false })
          .limit(25);
        if (cancelled) return;
        if (error) {
          setSyncState("offline");
          return;
        }
        const remote: Take[] = (data ?? []).map((r: any) => ({
          id: `take-srv-${r.id}`,
          serverId: r.id,
          name: r.name,
          capturedAt: new Date(r.captured_at).getTime(),
          blockCount: r.block_count ?? 0,
          wordCount: r.word_count ?? 0,
          payload: r.payload,
          syncStatus: "synced",
        }));
        const merged = mergeTakes(local, remote);
        writeTakes(projectId, merged);
        setTakes(merged);
        setSyncState("idle");

        // Backfill: push any local-only takes to cloud
        const localOnly = merged.filter((t) => !t.serverId);
        for (const t of localOnly) {
          await pushTake(t);
        }
      } catch {
        if (!cancelled) setSyncState("offline");
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const pushTake = useCallback(
    async (take: Take): Promise<Take> => {
      try {
        const { data: userRes } = await supabase.auth.getUser();
        const userId = userRes.user?.id;
        if (!userId) return { ...take, syncStatus: "local" };
        const { data, error } = await supabase
          .from("draft_takes")
          .insert({
            project_id: projectId,
            user_id: userId,
            name: take.name,
            captured_at: new Date(take.capturedAt).toISOString(),
            block_count: take.blockCount,
            word_count: take.wordCount,
            payload: take.payload as any,
          })
          .select("id")
          .single();
        if (error || !data) {
          const updated = { ...take, syncStatus: "error" as const };
          setTakes((prev) => {
            const next = prev.map((t) => (t.id === take.id ? updated : t));
            writeTakes(projectId, next);
            return next;
          });
          return updated;
        }
        const updated: Take = { ...take, serverId: data.id, syncStatus: "synced" };
        setTakes((prev) => {
          const next = prev.map((t) => (t.id === take.id ? updated : t));
          writeTakes(projectId, next);
          return next;
        });
        return updated;
      } catch {
        return { ...take, syncStatus: "error" };
      }
    },
    [projectId],
  );

  const capture = async () => {
    const draft = readDraft(projectId);
    if (!draft || draft.blocks.length === 0) {
      toast.error("Nothing to capture yet — write a few lines first.");
      return;
    }
    const take: Take = {
      id: `take-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: name.trim() || `Take ${takes.length + 1}`,
      capturedAt: Date.now(),
      blockCount: draft.blocks.length,
      wordCount: countWords(draft),
      payload: draft,
      syncStatus: "pending",
    };
    const next = [take, ...takes].slice(0, 25);
    writeTakes(projectId, next);
    setTakes(next);
    setName("");
    toast.success(`Slated "${take.name}"`);
    await pushTake(take);
  };

  const startRename = (take: Take) => {
    setEditingId(take.id);
    setEditingValue(take.name);
  };

  const commitRename = async () => {
    if (!editingId) return;
    const trimmed = editingValue.trim();
    if (!trimmed) {
      setEditingId(null);
      return;
    }
    const target = takes.find((t) => t.id === editingId);
    const next = takes.map((t) => (t.id === editingId ? { ...t, name: trimmed } : t));
    writeTakes(projectId, next);
    setTakes(next);
    setEditingId(null);
    setEditingValue("");

    if (target?.serverId) {
      const { error } = await supabase
        .from("draft_takes")
        .update({ name: trimmed })
        .eq("id", target.serverId);
      if (error) toast.error("Couldn't sync rename to the cloud.");
    }
  };

  const cancelRename = () => {
    setEditingId(null);
    setEditingValue("");
  };

  const performRestore = (take: Take) => {
    if (typeof window === "undefined") return;
    try {
      const current = readDraft(projectId);
      if (current && current.blocks.length > 0) {
        const safety: Take = {
          id: `take-${Date.now()}-auto`,
          name: `Before rolling back to ${take.name}`,
          capturedAt: Date.now(),
          blockCount: current.blocks.length,
          wordCount: countWords(current),
          payload: current,
          syncStatus: "pending",
        };
        writeTakes(projectId, [safety, ...readTakes(projectId)].slice(0, 25));
        // Fire-and-forget cloud sync of safety slate
        void pushTake(safety);
      }
      window.localStorage.setItem(
        "scenesmith.draft.v1." + projectId,
        JSON.stringify(take.payload),
      );
      toast.success(`Rolling back to "${take.name}"…`);
      setTimeout(() => window.location.reload(), 350);
    } catch {
      toast.error("Couldn't restore that take.");
    }
  };

  const performDiscard = async (take: Take) => {
    const next = takes.filter((t) => t.id !== take.id);
    writeTakes(projectId, next);
    setTakes(next);
    toast.success(`Discarded "${take.name}"`);

    if (take.serverId) {
      const { error } = await supabase
        .from("draft_takes")
        .delete()
        .eq("id", take.serverId);
      if (error) toast.error("Couldn't sync delete to the cloud.");
    }
  };

  const discardPhrase = useMemo(() => pendingDiscard?.name ?? "", [pendingDiscard]);
  const discardMatches =
    discardConfirmText.trim() === discardPhrase.trim() && discardPhrase.length > 0;

  const syncLabel =
    syncState === "syncing"
      ? "Syncing…"
      : syncState === "offline"
        ? "Offline — local only"
        : syncState === "error"
          ? "Sync error"
          : "Synced across devices";

  const SyncIcon =
    syncState === "syncing" ? Loader2 : syncState === "offline" ? CloudOff : Cloud;

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-border/60 bg-card/40 p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Clapperboard className="h-3.5 w-3.5 text-primary" />
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
              Slate a new take
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setImportOpen(true)}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition"
              title="Import an existing screenplay"
            >
              <Upload className="h-3 w-3" />
              <span className="hidden sm:inline">Import</span>
            </button>
            {latestReportId && (
              <button
                type="button"
                onClick={() => setDiagOpen(true)}
                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition"
                title="View last AI import review"
              >
                <Sparkles className="h-3 w-3" />
                <span className="hidden sm:inline">AI review</span>
              </button>
            )}
            <div
              className="flex items-center gap-1 text-[10px] text-muted-foreground"
              title={syncLabel}
            >
              <SyncIcon
                className={`h-3 w-3 ${syncState === "syncing" ? "animate-spin" : ""} ${
                  syncState === "offline" ? "text-amber-500" : ""
                }`}
              />
              <span className="hidden sm:inline">{syncLabel}</span>
            </div>
          </div>
        </div>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder='Take label (e.g. "Act II reworked")'
          className="h-8 text-xs"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              capture();
            }
          }}
        />
        <Button size="sm" className="w-full h-8 text-xs" onClick={capture}>
          <Camera className="h-3.5 w-3.5 mr-1.5" />
          Capture this take
        </Button>
        <p className="text-[10px] text-muted-foreground leading-snug">
          Snapshots your current draft and syncs to the cloud. Up to 25 takes per project.
        </p>
      </div>

      {takes.length > 0 && (
        <div className="flex items-center gap-1.5 px-0.5">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[11px] px-2 flex-1"
            disabled={selectedIds.length !== 2}
            onClick={() => setDiffOpen(true)}
            title={
              selectedIds.length === 2
                ? "Compare the two selected takes"
                : "Tick two takes to compare"
            }
          >
            <ArrowLeftRight className="h-3 w-3 mr-1.5" />
            Compare ({selectedIds.length}/2)
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[11px] px-2 flex-1"
            disabled={exporting}
            onClick={exportPdf}
            title={
              selectedIds.length > 0
                ? `Export PDF with ${selectedIds.length} selected take(s) + timeline`
                : "Export PDF with timeline + 3 most recent takes"
            }
          >
            {exporting ? (
              <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
            ) : (
              <FileDown className="h-3 w-3 mr-1.5" />
            )}
            Export PDF
          </Button>
        </div>
      )}

      {comparisons.length > 0 && (
        <div className="rounded-md border border-border/50 bg-card/30 p-2 space-y-1.5">
          <div className="flex items-center gap-1.5 px-0.5">
            <Bookmark className="h-3 w-3 text-primary" />
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
              Saved comparisons
            </p>
          </div>
          <ul className="space-y-1">
            {comparisons.map((c) => {
              const missing =
                !takes.find((t) => t.id === c.leftTakeId) ||
                !takes.find((t) => t.id === c.rightTakeId);
              return (
                <li
                  key={c.id}
                  className="flex items-center gap-1 rounded border border-border/40 bg-background/40 px-2 py-1"
                >
                  <button
                    type="button"
                    onClick={() => reopenComparison(c)}
                    disabled={missing}
                    className="flex-1 min-w-0 text-left disabled:opacity-50"
                    title={
                      missing
                        ? "A referenced take is no longer available"
                        : "Reopen comparison"
                    }
                  >
                    <p className="text-xs font-medium truncate flex items-center gap-1">
                      {c.label}
                      {(c.syncStatus ?? (c.serverId ? "synced" : "local")) === "pending" && (
                        <Loader2 className="h-2.5 w-2.5 text-muted-foreground animate-spin" aria-label="Syncing" />
                      )}
                      {c.syncStatus === "error" && (
                        <CloudOff className="h-2.5 w-2.5 text-amber-500" aria-label="Sync failed" />
                      )}
                      {c.serverId && (
                        <Cloud className="h-2.5 w-2.5 text-muted-foreground/60" aria-label="Synced" />
                      )}
                    </p>
                    <p className="text-[10px] text-muted-foreground font-mono">
                      {format(c.savedAt, "MMM d · HH:mm")}
                      {missing && (
                        <span className="ml-1.5 text-amber-500">· take missing</span>
                      )}
                    </p>
                  </button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => deleteComparison(c.id)}
                    aria-label="Delete saved comparison"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      )}


      {takes.length === 0 ? (
        <p className="text-xs text-muted-foreground italic px-1">
          No takes yet. Capture your first slate before a big rewrite.
        </p>
      ) : (
        <ScrollArea className="h-[360px] -mr-2 pr-2">
          <ul className="space-y-2">
            {takes.map((t, i) => {
              const isEditing = editingId === t.id;
              const status = t.syncStatus ?? (t.serverId ? "synced" : "local");
              return (
                <li
                  key={t.id}
                  className="rounded-md border border-border/50 bg-card/30 overflow-hidden"
                >
                  <div className="flex items-stretch">
                    <div className="w-7 shrink-0 flex items-start justify-center bg-card/40 border-r border-border/40 pt-3">
                      <Checkbox
                        checked={selectedIds.includes(t.id)}
                        onCheckedChange={() => toggleSelected(t.id)}
                        aria-label={`Select ${t.name}`}
                        className="h-3.5 w-3.5"
                      />
                    </div>
                    <div
                      className="w-9 shrink-0 flex flex-col items-center justify-center bg-primary/10 border-r border-border/50 font-mono text-[10px] text-primary/80 leading-tight py-2"
                      aria-hidden
                    >
                      <span className="text-muted-foreground">TAKE</span>
                      <span className="text-sm font-semibold">
                        {String(takes.length - i).padStart(2, "0")}
                      </span>
                    </div>
                    <div className="flex-1 p-2.5 min-w-0">
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <Input
                            autoFocus
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                commitRename();
                              } else if (e.key === "Escape") {
                                e.preventDefault();
                                cancelRename();
                              }
                            }}
                            className="h-6 text-xs px-2"
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            onClick={commitRename}
                            aria-label="Save label"
                          >
                            <Check className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            onClick={cancelRename}
                            aria-label="Cancel"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 group">
                          <p className="text-xs font-medium truncate flex-1">{t.name}</p>
                          {status === "pending" && (
                            <Loader2
                              className="h-2.5 w-2.5 text-muted-foreground animate-spin"
                              aria-label="Syncing"
                            />
                          )}
                          {status === "error" && (
                            <CloudOff
                              className="h-2.5 w-2.5 text-amber-500"
                              aria-label="Sync failed — saved locally"
                            />
                          )}
                          {status === "synced" && (
                            <Cloud
                              className="h-2.5 w-2.5 text-muted-foreground/60"
                              aria-label="Synced"
                            />
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => startRename(t)}
                            aria-label="Rename take"
                            title="Rename"
                          >
                            <Pencil className="h-2.5 w-2.5" />
                          </Button>
                        </div>
                      )}
                      <p
                        className="text-[10px] text-muted-foreground font-mono mt-0.5"
                        title={new Date(t.capturedAt).toLocaleString()}
                      >
                        {format(t.capturedAt, "MMM d, yyyy · HH:mm")}
                      </p>
                      <p className="text-[10px] text-muted-foreground/80 font-mono">
                        {formatDistanceToNow(t.capturedAt, { addSuffix: true })}
                        <span className="mx-1.5 opacity-50">·</span>
                        {t.wordCount.toLocaleString()} words
                        <span className="mx-1.5 opacity-50">·</span>
                        {t.blockCount} lines
                      </p>
                      <div className="flex items-center gap-1 mt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-[10px] px-2"
                          onClick={() => setPendingRestore(t)}
                        >
                          <RotateCcw className="h-3 w-3 mr-1" />
                          Roll back
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-[10px] px-2 text-muted-foreground hover:text-destructive"
                          onClick={() => {
                            setPendingDiscard(t);
                            setDiscardConfirmText("");
                          }}
                          aria-label={`Discard ${t.name}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </ScrollArea>
      )}

      {/* Restore confirmation */}
      <AlertDialog
        open={pendingRestore !== null}
        onOpenChange={(open) => !open && setPendingRestore(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Roll back to this take?</AlertDialogTitle>
            <AlertDialogDescription>
              Your current draft will be replaced with{" "}
              <strong className="text-foreground">"{pendingRestore?.name}"</strong>{" "}
              ({pendingRestore?.wordCount.toLocaleString()} words,{" "}
              {pendingRestore?.blockCount} lines).
              <br />
              <span className="text-xs text-muted-foreground mt-2 block">
                Don't worry — we'll auto-slate your current draft first so you can roll
                forward again.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingRestore) performRestore(pendingRestore);
                setPendingRestore(null);
              }}
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              Roll back
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Discard confirmation (type-to-confirm) */}
      <AlertDialog
        open={pendingDiscard !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDiscard(null);
            setDiscardConfirmText("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard this take?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the snapshot{" "}
              <strong className="text-foreground">"{discardPhrase}"</strong> from this
              device and the cloud. Your current draft is not affected, but you won't be
              able to roll back to this take afterward.
              <br />
              <span className="block mt-3 text-xs text-foreground">
                Type the take name to confirm:
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={discardConfirmText}
            onChange={(e) => setDiscardConfirmText(e.target.value)}
            placeholder={discardPhrase}
            className="h-8 text-xs font-mono"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && discardMatches && pendingDiscard) {
                e.preventDefault();
                performDiscard(pendingDiscard);
                setPendingDiscard(null);
                setDiscardConfirmText("");
              }
            }}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={!discardMatches}
              onClick={() => {
                if (pendingDiscard && discardMatches) {
                  performDiscard(pendingDiscard);
                  setPendingDiscard(null);
                  setDiscardConfirmText("");
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Discard take
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <TakeDiffViewer
        open={diffOpen}
        onOpenChange={setDiffOpen}
        left={
          selectedIds.length === 2
            ? (() => {
                const t = takes.find((x) => x.id === selectedIds[0]);
                return t ? { id: t.id, name: t.name, capturedAt: t.capturedAt, payload: t.payload } : null;
              })()
            : null
        }
        right={
          selectedIds.length === 2
            ? (() => {
                const t = takes.find((x) => x.id === selectedIds[1]);
                return t ? { id: t.id, name: t.name, capturedAt: t.capturedAt, payload: t.payload } : null;
              })()
            : null
        }
        onSave={saveComparison}
      />

      <ImportWizard
        open={importOpen}
        onOpenChange={setImportOpen}
        projectId={projectId}
      />
    </div>
  );
}
