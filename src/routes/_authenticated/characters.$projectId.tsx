// DEPRECATED — route body replaced at Characters Rebuild Pass 3.
// Do not add features here. See docs/CHARACTERS_REBUILD.md.
import { createFileRoute, Link } from "@tanstack/react-router";
import { RouteReadinessGate } from "@/components/RouteReadinessGate";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { ProjectNav } from "@/components/ProjectNav";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus, User, Sparkles, Trash2, Mic, Image as ImageIcon, KeyRound, AlertTriangle,
  ChevronRight, FileText, Users, Search, MoreVertical, PencilLine, CheckSquare, X, Scale, Star, Inbox,
} from "lucide-react";
import { toast } from "sonner";
import { TMHBadge } from "@/components/characters/TMHBadge";
import { GROUPS, completenessPct, tmhLabel } from "@/components/characters/tmh";
import { CharacterProfileDialog } from "@/components/characters/CharacterProfileDialog";
import { CharacterInboxDrawer } from "@/components/characters/CharacterInboxDrawer";
import { upsertCharacter, deleteCharacter, bulkDeleteCharacters, restoreCharacters } from "@/lib/characters.functions";
import { MergeReviewDialog } from "@/components/characters/MergeReviewDialog";
import { useSearch } from "@tanstack/react-router";

import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";

export const Route = createFileRoute("/_authenticated/characters/$projectId")({
  head: () => ({ meta: [{ title: "Characters — SceneSmith Studio" }] }),
  validateSearch: (s: Record<string, unknown>) => ({ merge: s.merge === "1" || s.merge === 1 ? "1" : undefined }),
  component: () => (<RouteReadinessGate to="/characters/$projectId"><CharactersPage /></RouteReadinessGate>),
  errorComponent: RouteErrorBoundary,
});

function CharactersPage() {
  const { projectId } = Route.useParams();
  const search = useSearch({ from: "/_authenticated/characters/$projectId" }) as { merge?: string };
  const mergeDebug = search.merge === "1";
  const [mergeOpen, setMergeOpen] = useState(false);
  const [inboxOpen, setInboxOpen] = useState(false);
  const qc = useQueryClient();

  const { data: pendingCandidateCount = 0 } = useQuery<number>({
    queryKey: ["character-candidate-count", projectId],
    queryFn: async () => {
      const { count } = await supabase
        .from("character_candidates")
        .select("id", { count: "exact", head: true })
        .eq("project_id", projectId)
        .eq("status", "pending");
      return count ?? 0;
    },
    refetchInterval: 30000,
  });
  const callUpsert = useServerFn(upsertCharacter);
  const callDel = useServerFn(deleteCharacter);
  const callBulk = useServerFn(bulkDeleteCharacters);
  const callRestore = useServerFn(restoreCharacters);

  const { data: project } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => (await supabase.from("projects").select("*").eq("id", projectId).single()).data,
  });

  const { data: characters = [] } = useQuery<any[]>({
    queryKey: ["characters", projectId],
    queryFn: async (): Promise<any[]> => (await supabase.from("characters").select("*").eq("project_id", projectId).is("quarantined_at", null).order("created_at")).data ?? [],
  });

  const { data: relCounts = {} } = useQuery<Record<string, number>>({
    queryKey: ["relationship-counts", projectId],
    queryFn: async () => {
      const { data } = await supabase.from("character_relationships").select("character_id").eq("project_id", projectId);
      const m: Record<string, number> = {};
      for (const r of (data ?? []) as any[]) m[r.character_id] = (m[r.character_id] ?? 0) + 1;
      return m;
    },
  });

  const { data: sceneCounts = {} } = useQuery<Record<string, number>>({
    queryKey: ["scene-counts", projectId],
    queryFn: async () => {
      const { data } = await supabase.from("character_scene_states").select("character_id").eq("project_id", projectId);
      const m: Record<string, number> = {};
      for (const r of (data ?? []) as any[]) m[r.character_id] = (m[r.character_id] ?? 0) + 1;
      return m;
    },
  });

  const [group, setGroup] = useState<string>("All");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogPillar, setDialogPillar] = useState<string | null>(null);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<null | { ids: string[]; label: string }>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["characters", projectId] });
    qc.invalidateQueries({ queryKey: ["relationship-counts", projectId] });
    qc.invalidateQueries({ queryKey: ["scene-counts", projectId] });
  };

  const counts = useMemo(() => {
    const m: Record<string, number> = { All: characters.length };
    for (const g of GROUPS) m[g] = 0;
    for (const c of characters) m[c.group_name ?? "Main Cast"] = (m[c.group_name ?? "Main Cast"] ?? 0) + 1;
    return m;
  }, [characters]);

  const arcStatus = useMemo(() => {
    let resolved = 0, developing = 0, seed = 0;
    for (const c of characters) {
      const pct = completenessPct(c);
      if (pct >= 75) resolved++;
      else if (pct >= 25) developing++;
      else seed++;
    }
    return { resolved, developing, seed };
  }, [characters]);


  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return characters.filter((c) => {
      if (group !== "All" && (c.group_name ?? "Main Cast") !== group) return false;
      if (q && !`${c.name} ${c.role ?? ""} ${c.archetype ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [characters, group, query]);

  const selected = filtered.find((c) => c.id === selectedId) ?? characters.find((c) => c.id === selectedId);

  const create = useMutation({
    mutationFn: async () => callUpsert({ data: { project_id: projectId, patch: { name: "New Character", group_name: group === "All" ? "Main Cast" : group } } }),
    onSuccess: (row: any) => {
      invalidate();
      setSelectedId(row.id);
      setDialogOpen(true);
    },
    onError: (e: any) => toast.error(e.message),
  });
  const restore = useMutation({
    mutationFn: async (snapshot: any) => callRestore({ data: { snapshot } }),
    onSuccess: () => { invalidate(); toast.success("Restored"); },
    onError: (e: any) => toast.error(e?.message ?? "Restore failed"),
  });
  const showUndoToast = (label: string, snapshot: any) => {
    toast.success(`Deleted ${label}`, {
      duration: 10000,
      action: { label: "Undo", onClick: () => restore.mutate(snapshot) },
    });
  };
  const del = useMutation({
    mutationFn: async (id: string) => callDel({ data: { id } }),
    onSuccess: (r: any, id) => {
      invalidate();
      setConfirm(null);
      const name = characters.find((c) => c.id === id)?.name || "character";
      showUndoToast(name, r?.snapshot);
    },
    onError: (e: any) => toast.error(e?.message ?? "Delete failed"),
  });
  const bulkDel = useMutation({
    mutationFn: async (ids: string[]) => callBulk({ data: { ids } }),
    onSuccess: (r: any) => {
      invalidate();
      setBulkSelected(new Set());
      setBulkMode(false);
      setConfirm(null);
      const n = r?.deleted ?? 0;
      showUndoToast(`${n} character${n === 1 ? "" : "s"}`, r?.snapshot);
    },
    onError: (e: any) => toast.error(e?.message ?? "Delete failed"),
  });
  const renameOne = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) =>
      callUpsert({ data: { id, project_id: projectId, patch: { name } } }),
    onSuccess: () => { invalidate(); toast.success("Renamed"); },
    onError: (e: any) => toast.error(e?.message ?? "Rename failed"),
  });

  const toggleBulk = (id: string) => setBulkSelected((prev) => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });

  return (
    <AppShell>
      <ProjectNav projectId={projectId} title={project?.title} />
      <div className="max-w-[1600px] mx-auto px-4 py-6">
        {/* Pass 3 — Ensemble Wall header */}
        <div className="mb-6 rounded-2xl border border-border/60 bg-card/40 backdrop-blur-sm">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-6 py-4 sm:flex sm:flex-wrap sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <h1 className="font-display text-2xl font-semibold text-primary truncate">Cast &amp; Characters</h1>
              <div className="hidden sm:block h-4 w-px bg-border/60" />
              <div className="hidden sm:flex gap-1 text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
                <span className="text-primary/80 truncate max-w-[160px]">{project?.title ?? "Untitled"}</span>
                <span>/</span>
                <span>{characters.length} in ensemble</span>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Filter ensemble…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-8 h-9 w-48 focus:w-64 transition-all bg-secondary/40"
                />
              </div>
              <Button variant="outline" size="sm" onClick={() => setInboxOpen(true)}>
                <Inbox className="h-4 w-4 mr-2" />
                Inbox
                {pendingCandidateCount > 0 && (
                  <Badge className="ml-2 text-[10px]" variant="secondary">{pendingCandidateCount}</Badge>
                )}
              </Button>
              <Button
                variant={bulkMode ? "secondary" : "outline"}
                size="sm"
                onClick={() => { setBulkMode((b) => !b); setBulkSelected(new Set()); }}
              >
                <CheckSquare className="h-4 w-4 mr-2" />{bulkMode ? "Exit select" : "Select"}
              </Button>
              <Button onClick={() => create.mutate()} disabled={create.isPending}>
                <Plus className="h-4 w-4 mr-2" />New Character
              </Button>
              {mergeDebug && (
                <Button variant="outline" size="sm" onClick={() => setMergeOpen(true)}>
                  <Scale className="h-4 w-4 mr-2" />Merge review
                </Button>
              )}
            </div>
          </div>
        </div>

        <MergeReviewDialog projectId={projectId} open={mergeOpen} onOpenChange={setMergeOpen} />

        {/* Pass 2: unified inbox drawer replaces cleanup + detection panels */}
        <CharacterInboxDrawer
          projectId={projectId}
          open={inboxOpen}
          onOpenChange={setInboxOpen}
          characters={characters}
          relCounts={relCounts}
          sceneCounts={sceneCounts}
        />


        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr_320px] gap-4">
          {/* SIDEBAR — Ensemble groups + arc-status legend */}
          <aside className="space-y-6">
            <div>
              <h3 className="text-[10px] font-bold tracking-[0.2em] text-muted-foreground uppercase mb-3 px-3">Ensemble</h3>
              <div className="space-y-1">
                <SideItem label="All Cast" count={counts.All ?? 0} active={group === "All"} onClick={() => setGroup("All")} />
                {GROUPS.map((g) => (
                  <SideItem key={g} label={g} count={counts[g] ?? 0} active={group === g} onClick={() => setGroup(g)} />
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-[10px] font-bold tracking-[0.2em] text-muted-foreground uppercase mb-3 px-3">Arc Status</h3>
              <div className="space-y-2.5 px-3">
                <ArcLegend tone="emerald" label="Resolved" count={arcStatus.resolved} />
                <ArcLegend tone="amber" label="Developing" count={arcStatus.developing} />
                <ArcLegend tone="muted" label="Seed" count={arcStatus.seed} />
              </div>
            </div>
          </aside>

          {/* MAIN */}
          <main className="space-y-5">
            <section>
              <div className="flex items-baseline gap-2 mb-4">
                <h2 className="font-display text-lg">{group === "All" ? "All Cast" : group}</h2>
                <Badge variant="outline" className="text-[10px]">{filtered.length}</Badge>
              </div>


              {filtered.length === 0 ? (
                <Card className="p-12 text-center border-dashed">
                  <User className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <h3 className="font-semibold mb-1">
                    {characters.length === 0 ? "No characters yet" : `No characters in ${group}`}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
                    {characters.length === 0
                      ? "Characters unlock Truth Check, Table Read voices, and the Story Spine. Add one manually or auto-import speakers already named in your script below."
                      : "Add a character to this group, or switch to All to see everyone."}
                  </p>
                  <div className="flex items-center gap-2 justify-center flex-wrap">
                    <Button size="sm" onClick={() => create.mutate()}><Plus className="h-3.5 w-3.5 mr-1.5" />Add character</Button>
                    <Button size="sm" variant="outline" asChild>
                      <Link to="/editor/$projectId" params={{ projectId }}>Write in editor</Link>
                    </Button>
                  </div>
                </Card>
              ) : (
                <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {filtered.map((c) => (
                    <CharacterCard
                      key={c.id}
                      c={c}
                      rels={relCounts[c.id] ?? 0}
                      scenes={sceneCounts[c.id] ?? 0}
                      selected={c.id === selectedId}
                      bulkMode={bulkMode}
                      bulkSelected={bulkSelected.has(c.id)}
                      onBulkToggle={() => toggleBulk(c.id)}
                      onSelect={() => setSelectedId(c.id)}
                      onOpen={() => { setSelectedId(c.id); setDialogOpen(true); }}
                      onRename={() => {
                        const next = window.prompt("Rename character", c.name || "");
                        if (next && next.trim() && next !== c.name) renameOne.mutate({ id: c.id, name: next.trim() });
                      }}
                      onDelete={() => setConfirm({ ids: [c.id], label: c.name || "character" })}
                    />
                  ))}
                </div>
              )}
            </section>

          </main>


          {/* INSPECTOR */}
          <aside className="space-y-3">
            <Inspector
              c={selected}
              onOpen={() => { if (selected) { setDialogPillar(null); setDialogOpen(true); } }}
              onTruthCheck={() => { if (selected) { setDialogPillar("psychology"); setDialogOpen(true); } }}
            />
          </aside>
        </div>
      </div>

      {/* Bulk action bar */}
      {bulkMode && bulkSelected.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 rounded-full border bg-background/95 backdrop-blur px-4 py-2 shadow-lg flex items-center gap-3">
          <span className="text-sm">{bulkSelected.size} selected</span>
          <Button size="sm" variant="ghost" onClick={() => setBulkSelected(new Set())}><X className="h-3.5 w-3.5 mr-1" />Clear</Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => setConfirm({ ids: [...bulkSelected], label: `${bulkSelected.size} characters` })}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" />Delete
          </Button>
        </div>
      )}

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {confirm?.label}?</AlertDialogTitle>
            <AlertDialogDescription>
              Removes the character{confirm?.ids.length && confirm.ids.length > 1 ? "s" : ""}, relationships, and scene-state notes. Screenplay text is not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (!confirm) return;
                if (confirm.ids.length === 1) del.mutate(confirm.ids[0]);
                else bulkDel.mutate(confirm.ids);
              }}
              disabled={del.isPending || bulkDel.isPending}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CharacterProfileDialog
        projectId={projectId}
        characterId={selectedId}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initialPillar={dialogPillar}
      />
    </AppShell>
  );
}

function SideItem({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={[
        "w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition",
        active ? "bg-secondary text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50",
      ].join(" ")}
    >
      <span className="truncate">{label}</span>
      <span className="text-[10px] tabular-nums">{count}</span>
    </button>
  );
}

function ArcLegend({ tone, label, count }: { tone: "emerald" | "amber" | "muted"; label: string; count: number }) {
  const dot =
    tone === "emerald" ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" :
    tone === "amber" ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" :
    "bg-muted-foreground/40";
  return (
    <div className="flex items-center gap-3">
      <div className={`w-2 h-2 rounded-full ${dot}`} />
      <span className="text-xs text-muted-foreground tabular-nums">{label} <span className="text-foreground/70">({count})</span></span>
    </div>
  );
}

function CharacterCard({
  c, rels, scenes, selected, bulkMode, bulkSelected, onBulkToggle, onSelect, onOpen, onRename, onDelete,
}: any) {
  const pct = completenessPct(c);
  const hasSecret = !!(c.secret || c.never_says_aloud || c.core_lie);
  const hasVoice = !!c.elevenlabs_voice_id;
  const hasPortrait = !!c.portrait_url;
  const warning = c.tmh_baseline && c.tmh_stress && Math.abs(c.tmh_baseline - c.tmh_stress) > 4;
  const provenance = c.canonical_name ? "canonical" : "inferred";
  const initials = (c.name ?? "?").split(/\s+/).map((s: string) => s[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
  const status = pct >= 75 ? "Resolved" : pct >= 25 ? "Developing" : "Seed";
  const statusTone = pct >= 75 ? "text-emerald-500" : pct >= 25 ? "text-amber-500" : "text-muted-foreground";
  const statusDot = pct >= 75 ? "bg-emerald-500" : pct >= 25 ? "bg-amber-500 animate-pulse" : "bg-muted-foreground/40";

  return (
    <div
      className={[
        "group bg-card border rounded-xl overflow-hidden flex flex-col cursor-pointer transition-all duration-500",
        selected ? "border-primary/60 shadow-lg shadow-primary/10" : "border-border/60 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5",
      ].join(" ")}
      onClick={() => (bulkMode ? onBulkToggle() : onSelect())}
    >
      {/* Media area */}
      <div className="h-40 bg-secondary/40 relative overflow-hidden">
        {hasPortrait ? (
          <img
            src={c.portrait_url}
            alt={c.name}
            className="w-full h-full object-cover opacity-70 grayscale-[40%] group-hover:grayscale-0 group-hover:scale-105 transition-all duration-700"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="font-display text-6xl text-muted-foreground/20 select-none">{initials || "?"}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent pointer-events-none" />

        {bulkMode && (
          <div className="absolute top-3 left-3 z-10" onClick={(e) => e.stopPropagation()}>
            <Checkbox checked={bulkSelected} onCheckedChange={onBulkToggle} aria-label={`Select ${c.name}`} />
          </div>
        )}

        <div className={`absolute top-3 ${bulkMode ? "left-10" : "left-3"} flex gap-1.5`}>
          {c.importance && <ImportanceChip level={c.importance} />}
          {c.story_function && (
            <span className="px-2 py-0.5 bg-background/70 backdrop-blur-md border border-border/60 text-foreground/80 text-[9px] font-semibold uppercase tracking-wider rounded">
              {c.story_function}
            </span>
          )}
        </div>

        <div className="absolute top-3 right-3 flex items-center gap-1.5">
          <span
            title={provenance === "canonical" ? "Canonical (confirmed)" : "Inferred from script"}
            className={`w-6 h-6 flex items-center justify-center rounded-full text-[10px] font-black border ${
              provenance === "canonical"
                ? "bg-primary/20 text-primary border-primary/30"
                : "bg-blue-500/10 text-blue-400 border-blue-500/20"
            }`}
          >
            {provenance === "canonical" ? "C" : "I"}
          </span>
          {!bulkMode && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Character menu"
                  className="h-6 w-6 bg-background/70 backdrop-blur-md hover:bg-background/90"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem onSelect={() => onOpen()}><Sparkles className="h-3.5 w-3.5 mr-2" />Open profile</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onRename()}><PencilLine className="h-3.5 w-3.5 mr-2" />Rename</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => onDelete()} className="text-destructive focus:text-destructive">
                  <Trash2 className="h-3.5 w-3.5 mr-2" />Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3 flex-1 flex flex-col">
        <div className="min-w-0">
          <h3 className="font-display text-lg font-semibold truncate group-hover:text-primary transition-colors">
            {c.name || "Untitled"}
          </h3>
          <p className="text-[10px] text-primary/70 mt-0.5 uppercase tracking-widest font-semibold truncate">
            {c.role || c.archetype || "Archetype: unknown"}
          </p>
        </div>

        {/* Metric strip */}
        <div className="grid grid-cols-2 gap-px bg-border/60 rounded overflow-hidden">
          <div className="bg-card p-2 text-center">
            <span className="block text-[9px] text-muted-foreground uppercase tracking-tighter">Scenes</span>
            <span className="text-sm font-semibold tabular-nums">{scenes}</span>
          </div>
          <div className="bg-card p-2 text-center">
            <span className="block text-[9px] text-muted-foreground uppercase tracking-tighter">Arc</span>
            <span className="text-sm font-semibold tabular-nums">{pct}%</span>
          </div>
        </div>

        <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1">
          <div className="flex items-center gap-1.5">
            <Users className="w-3 h-3" />
            <span>{rels} rel{rels === 1 ? "" : "s"}</span>
          </div>
          <span className={`flex items-center gap-1.5 font-medium ${statusTone}`}>
            <span className={`w-1 h-1 rounded-full ${statusDot}`} />
            {status}
          </span>
        </div>

        {/* Signal icons + Open */}
        <div className="mt-auto pt-3 border-t border-border/40 flex items-center gap-2">
          <IconChip on={hasVoice} icon={Mic} title="Voice assigned" />
          <IconChip on={hasPortrait} icon={ImageIcon} title="Portrait generated" />
          <IconChip on={hasSecret} icon={KeyRound} title="Has a secret" />
          <IconChip on={!!warning} icon={AlertTriangle} title="TMH gap — check continuity" tone="warn" />
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto h-7 px-2 text-[10px] text-primary hover:bg-primary/10"
            onClick={(e) => { e.stopPropagation(); onOpen(); }}
          >
            Open <ChevronRight className="h-3 w-3 ml-0.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}


function IconChip({ on, icon: Icon, title, tone }: { on: boolean; icon: any; title: string; tone?: "warn" }) {
  return (
    <span
      title={title}
      className={[
        "h-5 w-5 rounded flex items-center justify-center border",
        on
          ? tone === "warn"
            ? "border-destructive/40 text-destructive bg-destructive/10"
            : "border-primary/40 text-primary bg-primary/10"
          : "border-border/50 text-muted-foreground/40 bg-secondary/30",
      ].join(" ")}
    >
      <Icon className="h-3 w-3" />
    </span>
  );
}

function ImportanceChip({ level }: { level: string }) {
  const map: Record<string, { label: string; cls: string; stars: number }> = {
    lead:       { label: "Lead",       cls: "bg-primary/15 text-primary border-primary/40",       stars: 3 },
    supporting: { label: "Supporting", cls: "bg-accent/15 text-accent border-accent/40",         stars: 2 },
    bit:        { label: "Bit",        cls: "bg-secondary text-foreground/80 border-border/60",  stars: 1 },
    background: { label: "Background", cls: "bg-secondary/50 text-muted-foreground border-border/50", stars: 0 },
  };
  const cfg = map[level] ?? map.supporting;
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full border inline-flex items-center gap-1 ${cfg.cls}`} title={`Story importance: ${cfg.label}`}>
      {cfg.stars > 0 && <Star className="h-2.5 w-2.5 fill-current" />}
      {cfg.label}
    </span>
  );
}

function Inspector({ c, onOpen, onTruthCheck }: { c: any; onOpen: () => void; onTruthCheck: () => void }) {
  if (!c) {
    return (
      <Card className="p-8 border-dashed text-center flex flex-col items-center">
        <div className="relative mb-6">
          <div className="w-20 h-20 border-2 border-dashed border-border rounded-full flex items-center justify-center">
            <User className="w-8 h-8 text-muted-foreground/30" strokeWidth={1} />
          </div>
          <div className="absolute -bottom-1 -right-1 bg-primary w-5 h-5 rounded-full flex items-center justify-center border-2 border-background">
            <Sparkles className="w-2.5 h-2.5 text-primary-foreground" />
          </div>
        </div>
        <h3 className="font-display text-lg text-foreground/80 mb-2">Select Character</h3>
        <p className="text-xs text-muted-foreground leading-relaxed max-w-[220px]">
          Tap anyone on the wall to inspect their metrics, story function, and evolving relationships.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-full overflow-hidden bg-secondary border border-border flex items-center justify-center">
          {c.portrait_url ? <img src={c.portrait_url} alt={c.name} className="h-full w-full object-cover" /> : <User className="h-5 w-5 text-muted-foreground" />}
        </div>
        <div className="min-w-0">
          <div className="font-display text-lg truncate">{c.name}</div>
          <div className="text-[11px] text-muted-foreground truncate">{c.role || "—"}</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mt-3">
        <Badge variant="secondary" className="text-[10px]">{c.group_name ?? "Main Cast"}</Badge>
        {c.importance && <ImportanceChip level={c.importance} />}
        {c.story_function && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary/60 border border-border/60 text-foreground/80">{c.story_function}</span>}
        <TMHBadge level={c.tmh_baseline} />
      </div>

      {c.summary && <p className="text-xs text-muted-foreground mt-3">{c.summary}</p>}

      <dl className="grid grid-cols-1 gap-2 mt-4 text-[11px]">
        <Row label="Wants" value={c.external_goal} />
        <Row label="Needs" value={c.internal_need} />
        <Row label="Wound" value={c.wound} />
        <Row label="Fear" value={c.fear} />
        <Row label="Secret" value={c.secret} />
        <Row label="Voice" value={c.voice_summary ?? c.voice_style} />
      </dl>

      <div className="grid grid-cols-2 gap-2 mt-4">
        <Button variant="outline" size="sm" onClick={onTruthCheck} title="Would they do this?">
          <Scale className="h-3.5 w-3.5 mr-1.5" />Truth Check
        </Button>
        <Button size="sm" onClick={onOpen}>
          <Sparkles className="h-3.5 w-3.5 mr-1.5" />Open profile
        </Button>
      </div>
    </Card>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-muted-foreground text-[10px] uppercase tracking-wide">{label}</dt>
      <dd className="text-foreground/90">{value}</dd>
    </div>
  );
}
