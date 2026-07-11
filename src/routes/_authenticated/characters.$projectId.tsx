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
  ChevronRight, FileText, Users, Search, MoreVertical, PencilLine, CheckSquare, X, Scale, Star,
} from "lucide-react";
import { toast } from "sonner";
import { TMHBadge } from "@/components/characters/TMHBadge";
import { GROUPS, completenessPct, tmhLabel } from "@/components/characters/tmh";
import { CharacterProfileDialog } from "@/components/characters/CharacterProfileDialog";
import { CastCleanupPanel } from "@/components/characters/CastCleanupPanel";
import { DetectedSpeakersPanel } from "@/components/characters/DetectedSpeakersPanel";
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
  const qc = useQueryClient();
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
        <div className="flex items-baseline justify-between mb-5 flex-wrap gap-3">
          <div>
            <h1 className="font-display text-3xl">Characters</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Build your cast and protect character truth.</p>
          </div>
          <div className="flex items-center gap-2">
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
                <Scale className="h-4 w-4 mr-2" />Merge review (debug)
              </Button>
            )}
          </div>
        </div>
        <MergeReviewDialog projectId={projectId} open={mergeOpen} onOpenChange={setMergeOpen} />

        {/* CLEANUP */}
        <div className="mb-4">
          <CastCleanupPanel
            projectId={projectId}
            characters={characters}
            relCounts={relCounts}
            sceneCounts={sceneCounts}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr_320px] gap-4">
          {/* SIDEBAR */}
          <aside className="space-y-1">
            <SideItem label="All" count={counts.All ?? 0} active={group === "All"} onClick={() => setGroup("All")} />
            <div className="h-px bg-border/60 my-2" />
            {GROUPS.map((g) => (
              <SideItem key={g} label={g} count={counts[g] ?? 0} active={group === g} onClick={() => setGroup(g)} />
            ))}
          </aside>

          {/* MAIN */}
          <main className="space-y-5">
            <section>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="font-display text-lg">Cast</h2>
                <Badge variant="outline" className="text-[10px]">{filtered.length}</Badge>
              </div>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input placeholder="Search by name, role, archetype…" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-8 h-9" />
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

            <section>
              <DetectedSpeakersPanel projectId={projectId} existingNames={characters.map((c) => c.name || "")} />
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

function CharacterCard({
  c, rels, scenes, selected, bulkMode, bulkSelected, onBulkToggle, onSelect, onOpen, onRename, onDelete,
}: any) {
  const pct = completenessPct(c);
  const hasSecret = !!(c.secret || c.never_says_aloud || c.core_lie);
  const hasVoice = !!c.elevenlabs_voice_id;
  const hasPortrait = !!c.portrait_url;
  const arcArrow = (c.tmh_aspirational ?? 0) > (c.tmh_baseline ?? 0) ? "↑" : (c.tmh_shadow ?? 0) > (c.tmh_baseline ?? 0) ? "↓" : "→";
  const warning = c.tmh_baseline && c.tmh_stress && Math.abs(c.tmh_baseline - c.tmh_stress) > 4;

  return (
    <div
      className={["cine-card rounded-xl p-4 group cursor-pointer relative", selected ? "selected" : ""].join(" ")}
      onClick={() => (bulkMode ? onBulkToggle() : onSelect())}
    >
      {bulkMode && (
        <div className="absolute top-3 left-3 z-10" onClick={(e) => e.stopPropagation()}>
          <Checkbox checked={bulkSelected} onCheckedChange={onBulkToggle} aria-label={`Select ${c.name}`} />
        </div>
      )}
      <div className={["flex items-start gap-3", bulkMode ? "pl-8" : ""].join(" ")}>
        <div className="h-14 w-14 rounded-full overflow-hidden bg-secondary border border-border/70 flex items-center justify-center shrink-0">
          {c.portrait_url ? (
            <img src={c.portrait_url} alt={c.name} className="h-full w-full object-cover" />
          ) : (
            <span className="font-display text-lg text-muted-foreground">{(c.name ?? "?").slice(0, 1).toUpperCase()}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-display text-lg font-semibold truncate group-hover:text-primary transition">{c.name || "Untitled"}</h3>
          <p className="text-[11px] text-muted-foreground truncate">{c.role || "—"}{c.archetype ? ` · ${c.archetype}` : ""}</p>
        </div>
        {!bulkMode && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Character menu"
                className="h-9 w-9 shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-4 w-4" />
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

      {c.summary && <p className="text-xs text-muted-foreground mt-3 line-clamp-2">{c.summary}</p>}

      <div className="flex flex-wrap items-center gap-1.5 mt-3">
        {c.importance && <ImportanceChip level={c.importance} />}
        {c.story_function && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary/60 border border-border/60 text-foreground/80">{c.story_function}</span>}
        <TMHBadge level={c.tmh_baseline} />
        {c.tmh_stress && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-destructive/15 text-destructive border border-destructive/30">
            stress {tmhLabel(c.tmh_stress)}
          </span>
        )}
        <span className="text-[10px] text-muted-foreground" title="Arc direction">arc {arcArrow}</span>
      </div>

      <div className="flex items-center gap-2 mt-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><FileText className="h-3 w-3" />{scenes}</span>
        <span className="flex items-center gap-1"><Users className="h-3 w-3" />{rels}</span>
        {c.voice_summary && <span className="truncate max-w-[80px]" title={c.voice_summary}>· {c.voice_summary.split(/[.,]/)[0]}</span>}
        <span className="ml-auto tabular-nums">{pct}%</span>
      </div>

      <div className="flex items-center gap-1 mt-2">
        <IconChip on={hasVoice} icon={Mic} title="Voice assigned" />
        <IconChip on={hasPortrait} icon={ImageIcon} title="Portrait generated" />
        <IconChip on={hasSecret} icon={KeyRound} title="Has a secret" />
        <IconChip on={!!warning} icon={AlertTriangle} title="TMH gap — check continuity" tone="warn" />
      </div>

      <div className="grid grid-cols-1 gap-2 mt-3">
        <Button size="sm" variant="outline" className="h-8 text-[11px]" onClick={(e) => { e.stopPropagation(); onOpen(); }}>
          Open Profile <ChevronRight className="h-3 w-3 ml-1" />
        </Button>
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
      <Card className="p-5 border-dashed text-center">
        <Sparkles className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
        <p className="text-xs text-muted-foreground">Select a character to inspect.</p>
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
