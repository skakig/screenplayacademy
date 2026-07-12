// Pass 2 — Detected Characters Inbox
// Single drawer that replaces CastCleanupPanel + DetectedSpeakersPanel.
// Tabs: New speakers · Possible duplicates · Cleanup
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Inbox, UserPlus, EyeOff, Undo2, RefreshCw, AlertTriangle, Scale, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import {
  syncCharacterCandidates, setCandidateStatus, acceptCandidate,
} from "@/lib/characters/candidates.functions";
import {
  proposeCharacterMerges, mergeCharacters, rememberKeepSeparate,
} from "@/lib/characters/identity.functions";
import { detectCleanupCandidates } from "@/lib/characters/cleanup";
import { completenessPct } from "./tmh";
import { bulkDeleteCharacters, restoreCharacters } from "@/lib/characters.functions";

type Candidate = {
  id: string;
  detected_name: string;
  normalized_name: string;
  status: "pending" | "accepted" | "ignored" | "rejected";
  dialogue_line_count: number;
  scene_count: number;
  candidate_type: string;
  confidence: number;
  last_seen_at: string;
};

export function CharacterInboxDrawer({
  projectId,
  open,
  onOpenChange,
  characters,
  relCounts,
  sceneCounts,
}: {
  projectId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  characters: any[];
  relCounts: Record<string, number>;
  sceneCounts: Record<string, number>;
}) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"new" | "duplicates" | "cleanup">("new");
  const [query, setQuery] = useState("");

  const callSync = useServerFn(syncCharacterCandidates);
  const callSetStatus = useServerFn(setCandidateStatus);
  const callAccept = useServerFn(acceptCandidate);
  const callPropose = useServerFn(proposeCharacterMerges);
  const callMerge = useServerFn(mergeCharacters);
  const callKeepSep = useServerFn(rememberKeepSeparate);
  const callBulkDel = useServerFn(bulkDeleteCharacters);
  const callRestore = useServerFn(restoreCharacters);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["character-candidates", projectId] });
    qc.invalidateQueries({ queryKey: ["characters", projectId] });
    qc.invalidateQueries({ queryKey: ["merge-proposals", projectId] });
    qc.invalidateQueries({ queryKey: ["relationship-counts", projectId] });
    qc.invalidateQueries({ queryKey: ["scene-counts", projectId] });
  };

  const { data: candidates = [], isFetching: candLoading } = useQuery<Candidate[]>({
    queryKey: ["character-candidates", projectId],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase
        .from("character_candidates")
        .select("id,detected_name,normalized_name,status,dialogue_line_count,scene_count,candidate_type,confidence,last_seen_at")
        .eq("project_id", projectId)
        .order("dialogue_line_count", { ascending: false });
      return (data ?? []) as Candidate[];
    },
  });

  const sync = useMutation({
    mutationFn: async () => callSync({ data: { projectId } }),
    onSuccess: (r) => {
      invalidate();
      toast.success(`Scan complete: ${r.inserted} new, ${r.updated} refreshed`);
    },
    onError: (e: any) => toast.error(e?.message ?? "Scan failed"),
  });

  // Auto-scan on first open per session
  useEffect(() => {
    if (open && !sync.isPending && candidates.length === 0 && !candLoading) {
      sync.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const pending = useMemo(
    () => candidates.filter((c) => c.status === "pending" && (!query || c.detected_name.toLowerCase().includes(query.toLowerCase()))),
    [candidates, query],
  );
  const ignored = useMemo(() => candidates.filter((c) => c.status === "ignored"), [candidates]);

  const accept = useMutation({
    mutationFn: async (c: Candidate) => callAccept({ data: { candidateId: c.id } }),
    onSuccess: (_r, c) => { invalidate(); toast.success(`${c.detected_name} promoted to cast`); },
    onError: (e: any) => toast.error(e?.message ?? "Promote failed"),
  });
  const setStatus = useMutation({
    mutationFn: async (v: { id: string; status: "pending" | "ignored" | "rejected" }) =>
      callSetStatus({ data: { candidateId: v.id, status: v.status } }),
    onSuccess: () => invalidate(),
    onError: (e: any) => toast.error(e?.message ?? "Update failed"),
  });

  // Merge proposals (Pass 1 engine, shadow mode)
  const { data: proposals = [], isFetching: propLoading, refetch: refetchProposals } = useQuery<any[]>({
    queryKey: ["merge-proposals", projectId],
    enabled: open && tab === "duplicates",
    queryFn: async () => {
      const r = await callPropose({ data: { projectId } });
      return (r?.proposals ?? []) as any[];
    },
  });

  const doMerge = useMutation({
    mutationFn: async (v: { keepId: string; mergeId: string; keepName: string }) =>
      callMerge({
        data: {
          projectId,
          primaryId: v.keepId,
          mergedIds: [v.mergeId],
          chosenValues: {},
          survivingName: v.keepName,
        },
      }),
    onSuccess: () => { invalidate(); toast.success("Merged"); },
    onError: (e: any) => toast.error(e?.message ?? "Merge failed"),
  });
  const keepSep = useMutation({
    mutationFn: async (v: { a: string; b: string }) =>
      callKeepSep({ data: { projectId, characterIdA: v.a, characterIdB: v.b } }),
    onSuccess: () => { refetchProposals(); toast.success("Marked as separate"); },
    onError: (e: any) => toast.error(e?.message ?? "Update failed"),
  });

  // Cleanup candidates (from existing helper — inbox surface, no page clutter)
  const cleanupFlat = useMemo(
    () => detectCleanupCandidates(characters, {
      relCounts, sceneCounts, completeness: (r) => completenessPct(r),
    }),
    [characters, relCounts, sceneCounts],
  );
  const cleanup = useMemo(() => {
    const structural = cleanupFlat.filter((c) => c.reason === "structural");
    const lowSignal = cleanupFlat.filter((c) => c.reason === "low_signal");
    const groups: { key: string; label: string; items: typeof cleanupFlat }[] = [];
    if (structural.length) groups.push({ key: "structural", label: "Structural junk", items: structural });
    if (lowSignal.length) groups.push({ key: "low_signal", label: "Low signal (empty stubs)", items: lowSignal });
    return groups;
  }, [cleanupFlat]);
  const [selectedCleanup, setSelectedCleanup] = useState<Set<string>>(new Set());
  const toggleCleanup = (id: string) =>
    setSelectedCleanup((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const bulkDel = useMutation({
    mutationFn: async (ids: string[]) => callBulkDel({ data: { ids } }),
    onSuccess: (r: any) => {
      invalidate();
      setSelectedCleanup(new Set());
      const n = r?.deleted ?? 0;
      toast.success(`Removed ${n} character${n === 1 ? "" : "s"}`, {
        duration: 10000,
        action: { label: "Undo", onClick: () =>
          callRestore({ data: { snapshot: r?.snapshot } }).then(() => { invalidate(); toast.success("Restored"); }),
        },
      });
    },
    onError: (e: any) => toast.error(e?.message ?? "Delete failed"),
  });

  const dupeCount = proposals.length;
  const cleanupCount = cleanup.reduce((n, g) => n + g.items.length, 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Inbox className="h-5 w-5" /> Detected Characters Inbox
          </SheetTitle>
          <SheetDescription>
            Review speakers pulled from your script before they join your cast. Nothing here is written to your Characters list until you promote it.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => sync.mutate()} disabled={sync.isPending}>
            {sync.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
            Rescan script
          </Button>
          <Input placeholder="Filter…" value={query} onChange={(e) => setQuery(e.target.value)} className="h-8" />
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="mt-4">
          <TabsList className="grid grid-cols-3">
            <TabsTrigger value="new">
              New <Badge variant="outline" className="ml-2 text-[10px]">{pending.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="duplicates">
              Duplicates <Badge variant="outline" className="ml-2 text-[10px]">{dupeCount}</Badge>
            </TabsTrigger>
            <TabsTrigger value="cleanup">
              Cleanup <Badge variant="outline" className="ml-2 text-[10px]">{cleanupCount}</Badge>
            </TabsTrigger>
          </TabsList>

          {/* NEW SPEAKERS */}
          <TabsContent value="new" className="mt-3 space-y-2">
            {pending.length === 0 ? (
              <p className="text-xs text-muted-foreground italic py-6 text-center">
                No new speakers detected. Rescan after you add more dialogue.
              </p>
            ) : pending.map((c) => (
              <div key={c.id} className="flex items-center gap-2 rounded-md border border-border/60 px-3 py-2">
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-xs truncate">{c.detected_name}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {c.dialogue_line_count} line{c.dialogue_line_count === 1 ? "" : "s"} · {c.scene_count} scene{c.scene_count === 1 ? "" : "s"}
                  </div>
                </div>
                <Button size="sm" variant="outline" className="h-7" onClick={() => accept.mutate(c)} disabled={accept.isPending}>
                  <UserPlus className="h-3 w-3 mr-1" />Promote
                </Button>
                <Button size="sm" variant="ghost" className="h-7" onClick={() => setStatus.mutate({ id: c.id, status: "ignored" })}>
                  <EyeOff className="h-3 w-3" />
                </Button>
              </div>
            ))}
            {ignored.length > 0 && (
              <div className="pt-3 border-t border-border/40">
                <p className="text-[11px] text-muted-foreground mb-2">Ignored ({ignored.length})</p>
                <div className="space-y-1">
                  {ignored.slice(0, 10).map((c) => (
                    <div key={c.id} className="flex items-center gap-2 text-xs">
                      <span className="font-mono flex-1 truncate opacity-60">{c.detected_name}</span>
                      <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => setStatus.mutate({ id: c.id, status: "pending" })}>
                        <Undo2 className="h-3 w-3 mr-1" />Restore
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          {/* DUPLICATES */}
          <TabsContent value="duplicates" className="mt-3 space-y-2">
            {propLoading ? (
              <p className="text-xs text-muted-foreground italic py-6 text-center">Scanning…</p>
            ) : proposals.length === 0 ? (
              <p className="text-xs text-muted-foreground italic py-6 text-center">
                No likely duplicates. The identity engine will flag near-matches here.
              </p>
            ) : proposals.map((p: any) => (
              <Card key={`${p.aId}-${p.bId}`} className="p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <Scale className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="text-sm">
                      <span className="font-medium">{p.aName}</span>
                      <span className="text-muted-foreground mx-1.5">↔</span>
                      <span className="font-medium">{p.bName}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      similarity {(p.score * 100).toFixed(0)}% · {p.reasons?.join(" · ")}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 justify-end">
                  <Button size="sm" variant="ghost" onClick={() => keepSep.mutate({ a: p.aId, b: p.bId })}>
                    Keep separate
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => doMerge.mutate({ keepId: p.bId, mergeId: p.aId, keepName: p.bName })}>
                    Keep {truncate(p.bName)}
                  </Button>
                  <Button size="sm" onClick={() => doMerge.mutate({ keepId: p.aId, mergeId: p.bId, keepName: p.aName })}>
                    Keep {truncate(p.aName)}
                  </Button>
                </div>
              </Card>
            ))}
          </TabsContent>

          {/* CLEANUP */}
          <TabsContent value="cleanup" className="mt-3 space-y-3">
            {cleanupCount === 0 ? (
              <p className="text-xs text-muted-foreground italic py-6 text-center">Nothing to clean up. Your cast is tidy.</p>
            ) : cleanup.map((group) => (
              <div key={group.key}>
                <div className="flex items-center gap-2 mb-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                  <p className="text-xs font-medium">{group.label}</p>
                  <Badge variant="outline" className="text-[10px]">{group.items.length}</Badge>
                </div>
                <div className="space-y-1">
                  {group.items.map((c: any) => (
                    <label key={c.id} className="flex items-center gap-2 rounded-md border border-border/60 px-2 py-1.5 text-xs cursor-pointer">
                      <Checkbox
                        checked={selectedCleanup.has(c.id)}
                        onCheckedChange={() => toggleCleanup(c.id)}
                      />
                      <span className="flex-1 truncate">{c.name || <em className="text-muted-foreground">Unnamed</em>}</span>
                      <span className="text-muted-foreground text-[10px]">
                        {(sceneCounts[c.id] ?? 0)} sc · {(relCounts[c.id] ?? 0)} rel
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
            {selectedCleanup.size > 0 && (
              <div className="sticky bottom-0 bg-background pt-3 border-t border-border/60 flex items-center gap-2">
                <span className="text-xs text-muted-foreground flex-1">
                  {selectedCleanup.size} selected
                </span>
                <Button size="sm" variant="outline" onClick={() => setSelectedCleanup(new Set())}>Clear</Button>
                <Button size="sm" variant="destructive" onClick={() => bulkDel.mutate([...selectedCleanup])} disabled={bulkDel.isPending}>
                  Remove selected
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function truncate(s: string, n = 14): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
