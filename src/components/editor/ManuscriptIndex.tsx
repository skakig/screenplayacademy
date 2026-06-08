import { useMemo } from "react";
import { type Block, buildOutline, tallyCharacters, estimatePages } from "@/lib/editor/manuscriptAnalyzer";
import { Film, Users, Plus, ChevronRight } from "lucide-react";

type Props = {
  blocks: Block[];
  activeBlockId: string | null;
  onJumpToBlock: (blockId: string) => void;
  onAddScene: () => void;
};

export function ManuscriptIndex({ blocks, activeBlockId, onJumpToBlock, onAddScene }: Props) {
  const outline = useMemo(() => buildOutline(blocks), [blocks]);
  const characters = useMemo(() => tallyCharacters(blocks), [blocks]);
  const pages = useMemo(() => estimatePages(blocks), [blocks]);

  // Group scenes by act
  const acts = useMemo(() => {
    const byAct: Record<1 | 2 | 3, typeof outline> = { 1: [], 2: [], 3: [] };
    for (const s of outline) byAct[s.act].push(s);
    return byAct;
  }, [outline]);

  // Find which scene the active block belongs to
  const activeSceneIdx = useMemo(() => {
    if (!activeBlockId) return -1;
    const block = blocks.find((b) => b.id === activeBlockId);
    if (!block) return -1;
    return outline.findIndex((s) => block.order_index >= s.startOrder && block.order_index <= s.endOrder);
  }, [activeBlockId, blocks, outline]);

  return (
    <div className="text-sm space-y-5">
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
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 px-1 mb-1">
                  Act {act === 1 ? "I" : act === 2 ? "II" : "III"}
                </div>
                <ul className="space-y-0.5">
                  {acts[act].map((scene) => {
                    const isActive = scene.index === activeSceneIdx;
                    return (
                      <li key={scene.id}>
                        <button
                          onClick={() => scene.headingBlockId && onJumpToBlock(scene.headingBlockId)}
                          className={`w-full text-left px-2 py-1.5 rounded-md text-xs transition-colors group ${
                            isActive
                              ? "bg-primary/15 text-primary border-l-2 border-primary"
                              : "hover:bg-muted/60 text-foreground/80 hover:text-foreground border-l-2 border-transparent"
                          }`}
                          title={scene.title}
                        >
                          <div className="flex items-center gap-1.5">
                            <Film className="h-3 w-3 shrink-0 opacity-60" />
                            <span className="text-[10px] font-mono opacity-50 tabular-nums">
                              {String(scene.index + 1).padStart(2, "0")}
                            </span>
                            <span className="truncate flex-1">
                              {scene.location || scene.title || "Untitled"}
                            </span>
                            {isActive && <ChevronRight className="h-3 w-3 opacity-70 shrink-0" />}
                          </div>
                          {scene.timeOfDay && (
                            <div className="text-[9px] text-muted-foreground/70 ml-[18px] mt-0.5">
                              {scene.timeOfDay} · {scene.blockCount} block{scene.blockCount === 1 ? "" : "s"}
                            </div>
                          )}
                        </button>
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
    </div>
  );
}
