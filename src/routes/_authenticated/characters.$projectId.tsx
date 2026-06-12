import { createFileRoute } from "@tanstack/react-router";
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
import { Plus, User, Sparkles, Trash2, Mic, Image as ImageIcon, KeyRound, AlertTriangle, ChevronRight, FileText, Users, Search } from "lucide-react";
import { toast } from "sonner";
import { TMHBadge } from "@/components/characters/TMHBadge";
import { GROUPS, completenessPct, tmhLabel } from "@/components/characters/tmh";
import { CharacterProfileDialog } from "@/components/characters/CharacterProfileDialog";
import { upsertCharacter, deleteCharacter } from "@/lib/characters.functions";

export const Route = createFileRoute("/_authenticated/characters/$projectId")({
  head: () => ({ meta: [{ title: "Your Characters — SceneSmith AI" }] }),
  component: CharactersPage,
});

function CharactersPage() {
  const { projectId } = Route.useParams();
  const qc = useQueryClient();
  const callUpsert = useServerFn(upsertCharacter);
  const callDel = useServerFn(deleteCharacter);

  const { data: project } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => (await supabase.from("projects").select("*").eq("id", projectId).single()).data,
  });

  const { data: characters = [] } = useQuery<any[]>({
    queryKey: ["characters", projectId],
    queryFn: async (): Promise<any[]> => (await supabase.from("characters").select("*").eq("project_id", projectId).order("created_at")).data ?? [],
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
      qc.invalidateQueries({ queryKey: ["characters", projectId] });
      setSelectedId(row.id);
      setDialogOpen(true);
    },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => callDel({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["characters", projectId] }); toast.success("Character removed"); },
  });

  return (
    <AppShell>
      <ProjectNav projectId={projectId} title={project?.title} />
      <div className="max-w-[1600px] mx-auto px-4 py-6">
        <div className="flex items-baseline justify-between mb-5">
          <div>
            <h1 className="font-display text-3xl">Your Characters</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Build a living cast. Pressure reveals character.</p>
          </div>
          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            <Plus className="h-4 w-4 mr-2" />New Character
          </Button>
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

          {/* GRID */}
          <main className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Search by name, role, archetype…" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-8 h-9" />
            </div>

            {filtered.length === 0 ? (
              <Card className="p-12 text-center border-dashed">
                <User className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground mb-3">No characters in this group yet.</p>
                <Button size="sm" variant="outline" onClick={() => create.mutate()}><Plus className="h-3.5 w-3.5 mr-1.5" />Add character</Button>
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
                    onSelect={() => setSelectedId(c.id)}
                    onOpen={() => { setSelectedId(c.id); setDialogOpen(true); }}
                    onDelete={() => del.mutate(c.id)}
                  />
                ))}
              </div>
            )}
          </main>

          {/* INSPECTOR */}
          <aside className="space-y-3">
            <Inspector
              c={selected}
              onOpen={() => selected && setDialogOpen(true)}
            />
          </aside>
        </div>
      </div>

      <CharacterProfileDialog
        projectId={projectId}
        characterId={selectedId}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
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

function CharacterCard({ c, rels, scenes, selected, onSelect, onOpen, onDelete }: any) {
  const pct = completenessPct(c);
  const hasSecret = !!(c.secret || c.never_says_aloud || c.core_lie);
  const hasVoice = !!c.elevenlabs_voice_id;
  const hasPortrait = !!c.portrait_url;
  const arcArrow = (c.tmh_aspirational ?? 0) > (c.tmh_baseline ?? 0) ? "↑" : (c.tmh_shadow ?? 0) > (c.tmh_baseline ?? 0) ? "↓" : "→";
  const warning = c.tmh_baseline && c.tmh_stress && Math.abs(c.tmh_baseline - c.tmh_stress) > 4;

  return (
    <div className={["cine-card rounded-xl p-4 group cursor-pointer", selected ? "selected" : ""].join(" ")} onClick={onSelect}>
      <div className="flex items-start gap-3">
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
        <Button variant="ghost" size="icon" aria-label="Delete character" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {c.summary && <p className="text-xs text-muted-foreground mt-3 line-clamp-2">{c.summary}</p>}

      <div className="flex flex-wrap items-center gap-1.5 mt-3">
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

      <div className="grid grid-cols-2 gap-2 mt-3">
        <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={(e) => { e.stopPropagation(); onOpen(); }}>
          Open Profile <ChevronRight className="h-3 w-3 ml-1" />
        </Button>
        <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={(e) => { e.stopPropagation(); toast.info("Drop this character into any scene from the Editor or Scenes view."); }}>
          Use in Scene
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

function Inspector({ c, onOpen }: { c: any; onOpen: () => void }) {
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

      <Button className="w-full mt-4" onClick={onOpen}>
        <Sparkles className="h-3.5 w-3.5 mr-1.5" />Open full profile
      </Button>
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
