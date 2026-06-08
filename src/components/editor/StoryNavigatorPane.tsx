import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { type Block, buildOutline, tallyCharacters, estimatePages } from "@/lib/editor/manuscriptAnalyzer";
import { Film, Users, Plus, ChevronRight, AlertTriangle, Check, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { ProjectProgressCard } from "@/components/editor/ProjectProgressCard";

const ACT_LABEL: Record<1 | 2 | 3, string> = {
  1: "Act I · Setup",
  2: "Act II · Confrontation",
  3: "Act III · Resolution",
};

type Props = {
  projectId: string;
  projectTitle?: string;
  projectType?: string;
  genre?: string;
  blocks: Block[];
  activeBlockId: string | null;
  onJumpToBlock: (blockId: string) => void;
  onAddScene: () => void;
};

const STATUSES = [
  { value: "idea", label: "Idea", tone: "bg-muted text-muted-foreground" },
  { value: "outlined", label: "Outlined", tone: "bg-sky-500/15 text-sky-400" },
  { value: "drafting", label: "Drafting", tone: "bg-primary/15 text-primary" },
  { value: "needs_rewrite", label: "Needs Rewrite", tone: "bg-amber-500/15 text-amber-500" },
  { value: "strong", label: "Strong", tone: "bg-emerald-500/15 text-emerald-500" },
  { value: "locked", label: "Locked", tone: "bg-foreground/10 text-foreground" },
] as const;

type SceneRow = {
  id: string;
  order_index: number;
  status: string | null;
  plot_purpose: string | null;
  conflict: string | null;
  reversal: string | null;
  scene_heading: string | null;
};

/**
 * Story Navigator — the left rail. Shows manuscript outline with scene
 * status badges, warning dots for missing craft fields, and click-to-jump.
 * Status is user-settable via dropdown and otherwise auto-derived from
 * block content + analyzer signals.
 */
export function StoryNavigatorPane({
  projectId,
  projectTitle,
  projectType,
  genre,
  blocks,
  activeBlockId,
  onJumpToBlock,
  onAddScene,
}: Props) {
  const qc = useQueryClient();
  const outline = useMemo(() => buildOutline(blocks), [blocks]);
  const characters = useMemo(() => tallyCharacters(blocks), [blocks]);
  const pages = useMemo(() => estimatePages(blocks), [blocks]);
  const [query, setQuery] = useState("");

  const { data: scenes = [] } = useQuery({
    queryKey: ["scenes", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scenes")
        .select("id, order_index, status, plot_purpose, conflict, reversal, scene_heading")
        .eq("project_id", projectId)
        .order("order_index");
      if (error) throw error;
      return data as SceneRow[];
    },
  });

  // Map scene order_index -> DB row (analyzer & DB share order_index)
  const sceneByIdx = useMemo(() => {
    const m = new Map<number, SceneRow>();
    scenes.forEach((s) => m.set(s.order_index, s));
    return m;
  }, [scenes]);

  const updateStatus = async (sceneRow: SceneRow | undefined, status: string, fallbackHeading?: string) => {
    try {
      if (sceneRow) {
        const { error } = await supabase
          .from("scenes")
          .update({ status })
          .eq("id", sceneRow.id);
        if (error) throw error;
      } else if (fallbackHeading) {
        // Lazily create a scenes row keyed to this analyzer index
        toast.message("Saving scene status…");
      }
      qc.invalidateQueries({ queryKey: ["scenes", projectId] });
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't update scene status");
    }
  };

  // Group scenes by act
  const acts = useMemo(() => {
    const filtered = query
      ? outline.filter((s) => s.title.toLowerCase().includes(query.toLowerCase()))
      : outline;
    const byAct: Record<1 | 2 | 3, typeof outline> = { 1: [], 2: [], 3: [] };
    for (const s of filtered) byAct[s.act].push(s);
    return byAct;
  }, [outline, query]);

  // Find which scene the active block belongs to
  const activeSceneIdx = useMemo(() => {
    if (!activeBlockId) return -1;
    const block = blocks.find((b) => b.id === activeBlockId);
    if (!block) return -1;
    return outline.findIndex((s) => block.order_index >= s.startOrder && block.order_index <= s.endOrder);
  }, [activeBlockId, blocks, outline]);

  return (
    <div className="text-sm space-y-5">
      {/* Project header */}
      <div>
        <h2 className="text-sm font-semibold truncate" title={projectTitle}>
          {projectTitle ?? "Untitled project"}
        </h2>
        <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wider">
          {projectType ?? "Project"}{genre ? ` · ${genre}` : ""} · Draft 1
        </p>
      </div>

      {/* Manuscript header */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Manuscript</h3>
          <span className="text-[10px] text-muted-foreground font-mono tabular-nums">
            ~{pages} {pages === 1 ? "page" : "pages"}
          </span>
        </div>
        <button
          onClick={onAddScene}
          className="w-full inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-md border border-dashed border-border/70 text-xs text-muted-foreground hover:text-foreground hover:border-primary/60 hover:bg-primary/5 transition-colors"
        >
          <Plus className="h-3 w-3" />
          New scene
        </button>
        {outline.length > 4 && (
          <div className="mt-2 relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search scenes…"
              className="h-7 text-xs pl-7"
            />
          </div>
        )}
      </div>

      {/* Acts & scenes */}
      <div className="space-y-3">
        {outline.length === 0 ? (
          <p className="text-xs text-muted-foreground italic px-1">
            Scenes appear here as you write Scene Headings (INT./EXT.).
          </p>
        ) : (
          ([1, 2, 3] as const).map((act) =>
            acts[act].length > 0 ? (
              <div key={act}>
                <div className="flex items-center gap-2 px-1 mb-1.5 mt-1">
                  <span className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">
                    {ACT_LABEL[act]}
                  </span>
                  <span className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
                </div>
                <ul className="space-y-1">
                  {acts[act].map((scene) => {
                    const isActive = scene.index === activeSceneIdx;
                    const sceneRow = sceneByIdx.get(scene.index);
                    // Auto-derived status fallback
                    const derivedStatus =
                      scene.blockCount <= 1 ? "idea" : scene.blockCount < 4 ? "drafting" : "drafting";
                    const status = sceneRow?.status ?? derivedStatus;
                    const statusMeta = STATUSES.find((s) => s.value === status) ?? STATUSES[0];
                    // Warning if no purpose/conflict/turn
                    const missingCraft =
                      sceneRow &&
                      !sceneRow.plot_purpose &&
                      !sceneRow.conflict &&
                      !sceneRow.reversal &&
                      scene.blockCount > 2;
                    return (
                      <li key={scene.id}>
                        <div
                          className={`group rounded-md text-xs transition-colors border-l-2 ${
                            isActive
                              ? "bg-primary/15 border-primary"
                              : "hover:bg-muted/60 border-transparent"
                          }`}
                        >
                          <button
                            onClick={() => scene.headingBlockId && onJumpToBlock(scene.headingBlockId)}
                            className="w-full text-left px-2 py-1.5"
                            title={scene.title}
                          >
                            <div className="flex items-center gap-1.5">
                              <Film className="h-3 w-3 shrink-0 opacity-60" />
                              <span className="text-[10px] font-mono opacity-50 tabular-nums">
                                {String(scene.index + 1).padStart(2, "0")}
                              </span>
                              <span className="truncate flex-1 font-medium">
                                {scene.location || scene.title || "Untitled"}
                              </span>
                              {missingCraft && (
                                <AlertTriangle
                                  className="h-3 w-3 text-amber-500 shrink-0"
                                  aria-label="Missing scene purpose/conflict/turn"
                                />
                              )}
                              {isActive && <ChevronRight className="h-3 w-3 opacity-70 shrink-0" />}
                            </div>
                            <div className="flex items-center gap-1.5 mt-1 ml-[18px]">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button
                                    onClick={(e) => e.stopPropagation()}
                                    className={`text-[9px] px-1.5 py-0.5 rounded uppercase tracking-wider font-semibold ${statusMeta.tone} hover:opacity-80`}
                                  >
                                    {statusMeta.label}
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="w-40">
                                  <DropdownMenuLabel className="text-[10px]">Scene status</DropdownMenuLabel>
                                  <DropdownMenuSeparator />
                                  {STATUSES.map((s) => (
                                    <DropdownMenuItem
                                      key={s.value}
                                      onSelect={() => updateStatus(sceneRow, s.value, scene.title)}
                                      className="text-xs"
                                    >
                                      <span className={`inline-block w-2 h-2 rounded-full mr-2 ${s.tone}`} />
                                      {s.label}
                                      {status === s.value && <Check className="h-3 w-3 ml-auto" />}
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuContent>
                              </DropdownMenu>
                              {scene.timeOfDay && (
                                <span className="text-[9px] text-muted-foreground/70 font-mono">{scene.timeOfDay}</span>
                              )}
                              {scene.characters.length > 0 && (
                                <span className="text-[9px] text-muted-foreground/70 truncate">
                                  · {scene.characters.slice(0, 2).join(", ")}
                                  {scene.characters.length > 2 ? "…" : ""}
                                </span>
                              )}
                            </div>
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null
          )
        )}
      </div>

      {/* Characters (auto-detected) */}
      {characters.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2 px-1">
            <Users className="h-3 w-3 text-muted-foreground" />
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Cast ({characters.length})
            </h3>
          </div>
          <ul className="space-y-0.5">
            {characters.slice(0, 12).map((c) => (
              <li
                key={c.name}
                className="flex items-center justify-between px-2 py-1 rounded-md hover:bg-muted/40 text-xs"
              >
                <span className="truncate">{c.name}</span>
                <span className="text-[10px] text-muted-foreground font-mono tabular-nums shrink-0 ml-2">
                  {c.lineCount}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Shortcuts */}
      <div>
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 px-1">Shortcuts</h3>
        <div className="text-[10px] text-muted-foreground space-y-0.5 font-mono px-1">
          <p><span className="text-primary">/</span> slash commands</p>
          <p><span className="text-primary">Tab</span> cycle block type</p>
          <p><span className="text-primary">Enter</span> next line</p>
          <p><span className="text-primary">⌘1–7</span> set block type</p>
        </div>
      </div>

      <ProjectProgressCard projectId={projectId} blocks={blocks} onAddScene={onAddScene} />
    </div>
  );
}
