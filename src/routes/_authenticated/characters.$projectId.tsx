// Characters Rebuild — Pass 3 (Cast landing).
// See docs/CHARACTERS_REBUILD.md.
import { createFileRoute, Link, useSearch, useNavigate } from "@tanstack/react-router";
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
  Plus, User, Trash2, ChevronRight, Users, Search, MoreVertical, PencilLine,
  CheckSquare, X, Scale, Star, Inbox, AlertCircle, Bookmark, Zap, Target,
  ArrowRight, FileText, Heart, Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { completenessPct } from "@/components/characters/tmh";
import { CharacterProfileDialog } from "@/components/characters/CharacterProfileDialog";
import { CharacterInboxDrawer } from "@/components/characters/CharacterInboxDrawer";
import { upsertCharacter, deleteCharacter, bulkDeleteCharacters, restoreCharacters } from "@/lib/characters.functions";
import { MergeReviewDialog } from "@/components/characters/MergeReviewDialog";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";

export const Route = createFileRoute("/_authenticated/characters/$projectId")({
  head: () => ({ meta: [{ title: "Characters — SceneSmith Studio" }] }),
  validateSearch: (s: Record<string, unknown>) => ({ merge: s.merge === "1" || s.merge === 1 ? "1" : undefined }),
  component: () => (<RouteReadinessGate to="/characters/$projectId"><CharactersPage /></RouteReadinessGate>),
  errorComponent: RouteErrorBoundary,
});

type ImportanceKey = "lead" | "supporting" | "minor" | "background";
type StoryFunctionKey =
  | "protagonist" | "antagonist" | "mentor" | "ally" | "love_interest" | "comic_relief" | "custom";

const IMPORTANCE: { key: ImportanceKey; label: string }[] = [
  { key: "lead", label: "Lead" },
  { key: "supporting", label: "Supporting" },
  { key: "minor", label: "Minor" },
  { key: "background", label: "Background" },
];

const STORY_FUNCTIONS: { key: StoryFunctionKey; label: string }[] = [
  { key: "protagonist", label: "Protagonist" },
  { key: "antagonist", label: "Antagonist" },
  { key: "mentor", label: "Mentor" },
  { key: "ally", label: "Ally" },
  { key: "love_interest", label: "Love Interest" },
  { key: "comic_relief", label: "Comic Relief" },
  { key: "custom", label: "Custom" },
];

function CharactersPage() {
  const { projectId } = Route.useParams();
  const navigate = useNavigate();
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

  const { data: detectedCount = 0 } = useQuery<number>({
    queryKey: ["character-candidate-total", projectId],
    queryFn: async () => {
      const { count } = await supabase
        .from("character_candidates")
        .select("id", { count: "exact", head: true })
        .eq("project_id", projectId);
      return count ?? 0;
    },
    refetchInterval: 60000,
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
    queryFn: async (): Promise<any[]> =>
      (await supabase.from("characters").select("*").eq("project_id", projectId).is("quarantined_at", null).order("created_at")).data ?? [],
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

  const [importanceFilter, setImportanceFilter] = useState<ImportanceKey | null>(null);
  const [functionFilter, setFunctionFilter] = useState<StoryFunctionKey | null>(null);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<null | { ids: string[]; label: string }>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["characters", projectId] });
    qc.invalidateQueries({ queryKey: ["relationship-counts", projectId] });
    qc.invalidateQueries({ queryKey: ["scene-counts", projectId] });
  };

  const kpis = useMemo(() => {
    let leads = 0, supporting = 0, needReview = 0;
    for (const c of characters) {
      const imp = (c.importance ?? "").toLowerCase();
      if (imp === "lead") leads++;
      else if (imp === "supporting") supporting++;
      if (completenessPct(c) < 25) needReview++;
    }
    return {
      total: characters.length,
      leads,
      supporting,
      needReview: Math.max(needReview, pendingCandidateCount),
      detected: detectedCount,
    };
  }, [characters, pendingCandidateCount, detectedCount]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return characters.filter((c) => {
      if (importanceFilter && (c.importance ?? "").toLowerCase() !== importanceFilter) return false;
      if (functionFilter && (c.story_function ?? "").toLowerCase() !== functionFilter) return false;
      if (q && !`${c.name} ${c.role ?? ""} ${c.archetype ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [characters, importanceFilter, functionFilter, query]);

  const create = useMutation({
    mutationFn: async () => callUpsert({ data: { project_id: projectId, patch: { name: "New Character" } } }),
    onSuccess: (row: any) => {
      invalidate();
      // Pass 4: new characters go straight into the guided builder route.
      navigate({
        to: "/characters/$projectId/build/$characterId",
        params: { projectId, characterId: row.id },
      });
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

  const clearFilters = () => { setImportanceFilter(null); setFunctionFilter(null); setQuery(""); };
  const activeFilters = !!(importanceFilter || functionFilter || query.trim());

  return (
    <AppShell>
      <ProjectNav projectId={projectId} title={project?.title} />
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Header row */}
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 md:flex md:items-center md:justify-between">
          <div className="min-w-0">
            <h1 className="font-display text-3xl sm:text-4xl font-semibold text-foreground">Characters</h1>
            <p className="text-sm text-muted-foreground mt-1">Build your cast and protect character truth.</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {kpis.needReview > 0 && (
              <button
                onClick={() => setInboxOpen(true)}
                className="hidden sm:inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-500 hover:bg-amber-500/20 transition"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                {kpis.needReview} need review
                <ChevronRight className="h-3 w-3" />
              </button>
            )}
            <Button variant="outline" size="sm" onClick={() => setInboxOpen(true)}>
              <Inbox className="h-4 w-4 mr-2" />
              Review Inbox
              {pendingCandidateCount > 0 && (
                <Badge className="ml-2 text-[10px]" variant="secondary">{pendingCandidateCount}</Badge>
              )}
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
        </header>

        {/* KPI strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <KpiCard icon={Users} tone="primary" value={kpis.total} label="Total Characters" />
          <KpiCard icon={Star} tone="primary" value={kpis.leads} label="Leads" />
          <KpiCard icon={Users} tone="emerald" value={kpis.supporting} label="Supporting" />
          <KpiCard
            icon={AlertCircle}
            tone="amber"
            value={kpis.needReview}
            label="Need Review"
            onClick={kpis.needReview > 0 ? () => setInboxOpen(true) : undefined}
          />
          <KpiCard
            icon={Bookmark}
            tone="violet"
            value={kpis.detected}
            label="Detected Items"
            onClick={kpis.detected > 0 ? () => setInboxOpen(true) : undefined}
          />
        </div>

        <MergeReviewDialog projectId={projectId} open={mergeOpen} onOpenChange={setMergeOpen} />

        <CharacterInboxDrawer
          projectId={projectId}
          open={inboxOpen}
          onOpenChange={setInboxOpen}
          characters={characters}
          relCounts={relCounts}
          sceneCounts={sceneCounts}
        />

        {/* Filter bar */}
        <div className="rounded-xl border border-border/60 bg-card/40 backdrop-blur-sm px-4 py-3 space-y-3">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <FilterRow
              label="Importance"
              options={IMPORTANCE.map((i) => ({ key: i.key, label: i.label }))}
              value={importanceFilter}
              onChange={(k) => setImportanceFilter(k as ImportanceKey | null)}
            />
            <FilterRow
              label="Story Function"
              options={STORY_FUNCTIONS.map((f) => ({ key: f.key, label: f.label }))}
              value={functionFilter}
              onChange={(k) => setFunctionFilter(k as StoryFunctionKey | null)}
            />
            <div className="ml-auto flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-8 h-9 w-44 focus:w-64 transition-all bg-secondary/40"
                />
              </div>
              <Button
                variant={bulkMode ? "secondary" : "outline"}
                size="sm"
                onClick={() => { setBulkMode((b) => !b); setBulkSelected(new Set()); }}
              >
                <CheckSquare className="h-4 w-4 mr-2" />{bulkMode ? "Exit select" : "Select"}
              </Button>
              {activeFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="h-3.5 w-3.5 mr-1" />Clear
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Cards */}
        {filtered.length === 0 ? (
          <Card className="p-12 text-center border-dashed">
            <User className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-semibold mb-1">
              {characters.length === 0 ? "No characters yet" : "No characters match these filters"}
            </h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
              {characters.length === 0
                ? "Characters unlock Truth Check, Table Read voices, and the Story Spine. Add one manually or auto-import speakers already named in your script."
                : "Loosen a filter, clear the search, or add a new character."}
            </p>
            <div className="flex items-center gap-2 justify-center flex-wrap">
              <Button size="sm" onClick={() => create.mutate()}><Plus className="h-3.5 w-3.5 mr-1.5" />Add character</Button>
              {characters.length === 0 && (
                <Button size="sm" variant="outline" asChild>
                  <Link to="/editor/$projectId" params={{ projectId }}>Write in editor</Link>
                </Button>
              )}
              {activeFilters && characters.length > 0 && (
                <Button size="sm" variant="outline" onClick={clearFilters}>Clear filters</Button>
              )}
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
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
      />
    </AppShell>
  );
}

function KpiCard({
  icon: Icon, tone, value, label, onClick,
}: {
  icon: any; tone: "primary" | "emerald" | "amber" | "violet";
  value: number; label: string; onClick?: () => void;
}) {
  const toneMap = {
    primary: "text-primary bg-primary/10 border-primary/30",
    emerald: "text-emerald-500 bg-emerald-500/10 border-emerald-500/30",
    amber:   "text-amber-500 bg-amber-500/10 border-amber-500/30",
    violet:  "text-violet-400 bg-violet-500/10 border-violet-500/30",
  } as const;
  const clickable = !!onClick;
  return (
    <Card
      onClick={onClick}
      className={[
        "p-4 flex items-center gap-3 border-border/60 bg-card/50 backdrop-blur-sm transition",
        clickable ? "cursor-pointer hover:border-primary/40 hover:bg-card/70" : "",
      ].join(" ")}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick?.(); } } : undefined}
    >
      <div className={`h-11 w-11 shrink-0 rounded-xl border flex items-center justify-center ${toneMap[tone]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="font-display text-2xl leading-none tabular-nums">{value}</div>
        <div className="text-[11px] text-muted-foreground uppercase tracking-wide mt-1 truncate">{label}</div>
      </div>
    </Card>
  );
}

function FilterRow({
  label, options, value, onChange,
}: {
  label: string;
  options: { key: string; label: string }[];
  value: string | null;
  onChange: (key: string | null) => void;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[10px] font-bold tracking-[0.18em] text-muted-foreground uppercase shrink-0">
        {label}
      </span>
      {options.map((opt) => {
        const active = value === opt.key;
        return (
          <button
            key={opt.key}
            onClick={() => onChange(active ? null : opt.key)}
            className={[
              "text-xs px-3 py-1.5 rounded-full border transition",
              active
                ? "border-primary/60 bg-primary/15 text-primary"
                : "border-border/60 bg-secondary/40 text-foreground/80 hover:border-primary/40 hover:text-primary",
            ].join(" ")}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function CharacterCard({
  c, projectId, rels, scenes, bulkMode, bulkSelected, onBulkToggle, onOpen, onRename, onDelete,
}: any) {
  const pct = completenessPct(c);
  const status = pct >= 75 ? "Strong" : pct >= 40 ? "Developing" : "Needs Work";
  const statusTone =
    pct >= 75 ? "text-emerald-500" :
    pct >= 40 ? "text-amber-500" : "text-rose-400";
  const statusDot =
    pct >= 75 ? "bg-emerald-500" :
    pct >= 40 ? "bg-amber-500" : "bg-rose-400";
  const initials = (c.name ?? "?").split(/\s+/).map((s: string) => s[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
  const want = c.external_goal || c.want;
  const pressure = c.pressure || c.fear || c.core_lie;
  const arcFrom = c.arc_from || c.arc_start;
  const arcTo = c.arc_to || c.arc_end;
  const roleTag = c.story_function || c.role || c.archetype;

  return (
    <div
      className={[
        "group relative bg-card border border-border/60 rounded-2xl overflow-hidden",
        "hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all",
      ].join(" ")}
    >
      <div className="flex gap-4 p-4">
        {/* Portrait */}
        <button
          onClick={() => (bulkMode ? onBulkToggle() : onOpen())}
          className="relative shrink-0 h-40 w-32 rounded-xl overflow-hidden bg-gradient-to-b from-secondary/60 to-secondary/20 border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary/60"
          aria-label={`Open ${c.name || "character"}`}
        >
          {c.portrait_url ? (
            <img src={c.portrait_url} alt={c.name || "Character portrait"} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full flex items-end justify-center pb-4">
              <div className="h-24 w-16 rounded-t-full bg-foreground/10" aria-hidden />
              <span className="absolute inset-0 flex items-center justify-center font-display text-4xl text-muted-foreground/40">
                {initials || "?"}
              </span>
            </div>
          )}
          {bulkMode && (
            <div className="absolute top-2 left-2 z-10" onClick={(e) => e.stopPropagation()}>
              <Checkbox checked={bulkSelected} onCheckedChange={onBulkToggle} aria-label={`Select ${c.name}`} />
            </div>
          )}
        </button>

        {/* Body */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex items-start gap-2">
            <h3
              className="font-display text-xl font-semibold truncate cursor-pointer hover:text-primary transition-colors"
              onClick={onOpen}
              title={c.name}
            >
              {c.name || "Untitled"}
            </h3>
            <div className="ml-auto -mt-1 -mr-1" onClick={(e) => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Character menu" className="h-7 w-7">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={onOpen}><FileText className="h-3.5 w-3.5 mr-2" />Open profile</DropdownMenuItem>
                  <DropdownMenuItem onSelect={onRename}><PencilLine className="h-3.5 w-3.5 mr-2" />Rename</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={onDelete} className="text-destructive focus:text-destructive">
                    <Trash2 className="h-3.5 w-3.5 mr-2" />Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 mt-2">
            {c.importance && <ImportanceChip level={c.importance} />}
            {roleTag && (
              <span className="text-[10px] px-2 py-0.5 rounded-full border border-border/60 bg-secondary/40 text-foreground/80 uppercase tracking-wide font-medium">
                {roleTag}
              </span>
            )}
          </div>

          <dl className="mt-3 space-y-1.5 text-xs">
            {want && (
              <div className="flex gap-2">
                <dt className="w-[64px] shrink-0 text-primary/80 font-bold uppercase tracking-wider text-[9px] pt-0.5 flex items-center gap-1">
                  <Target className="h-2.5 w-2.5" />Want
                </dt>
                <dd className="text-foreground/85 line-clamp-2">{want}</dd>
              </div>
            )}
            {pressure && (
              <div className="flex gap-2">
                <dt className="w-[64px] shrink-0 text-amber-500/90 font-bold uppercase tracking-wider text-[9px] pt-0.5 flex items-center gap-1">
                  <Zap className="h-2.5 w-2.5" />Pressure
                </dt>
                <dd className="text-foreground/85 line-clamp-2">{pressure}</dd>
              </div>
            )}
          </dl>

          {(arcFrom || arcTo) && (
            <div className="mt-3 text-xs text-muted-foreground flex items-center gap-1.5 truncate">
              <span className="text-foreground/70 truncate">{arcFrom || "—"}</span>
              <ArrowRight className="h-3 w-3 shrink-0" />
              <span className="text-foreground/70 truncate">{arcTo || "—"}</span>
            </div>
          )}

          <div className="mt-auto pt-3 flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/40">
            <span className="flex items-center gap-1.5"><FileText className="h-3 w-3" />{scenes} Scene{scenes === 1 ? "" : "s"}</span>
            <span className="flex items-center gap-1.5"><Heart className="h-3 w-3" />{rels} Relationship{rels === 1 ? "" : "s"}</span>
            <span className={`flex items-center gap-1.5 font-medium ${statusTone}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${statusDot}`} />{status}
            </span>
          </div>
        </div>
      </div>

      <button
        onClick={onOpen}
        className="w-full border-t border-border/40 py-2.5 text-xs font-medium text-foreground/80 hover:bg-secondary/40 hover:text-primary transition flex items-center justify-center gap-1"
      >
        Open Character <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function ImportanceChip({ level }: { level: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    lead:        { label: "Lead",        cls: "bg-primary/15 text-primary border-primary/40" },
    supporting:  { label: "Supporting",  cls: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30" },
    minor:       { label: "Minor",       cls: "bg-secondary text-foreground/80 border-border/60" },
    bit:         { label: "Bit",         cls: "bg-secondary text-foreground/80 border-border/60" },
    background:  { label: "Background",  cls: "bg-secondary/50 text-muted-foreground border-border/50" },
    antagonist:  { label: "Antagonist",  cls: "bg-rose-500/10 text-rose-400 border-rose-500/30" },
  };
  const cfg = map[level] ?? { label: level, cls: "bg-secondary text-foreground/80 border-border/60" };
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold uppercase tracking-wide ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}
