import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { Activity, ArrowRight, Plus, Download, Upload } from "lucide-react";
import type { Block } from "@/lib/editor/manuscriptAnalyzer";
import { buildOutline, estimatePages } from "@/lib/editor/manuscriptAnalyzer";

type Props = {
  projectId: string;
  blocks: Block[];
  onAddScene: () => void;
};

/**
 * Sticky bottom card on the Story Navigator — shows project progress and
 * quick links to Arc, +Scene, import, export.
 */
export function ProjectProgressCard({ projectId, blocks, onAddScene }: Props) {
  const { pct, scenes, pages, withContent } = useMemo(() => {
    const outline = buildOutline(blocks);
    const pages = estimatePages(blocks);
    const withContent = outline.filter((s) => s.blockCount > 2).length;
    const pct = outline.length ? Math.round((withContent / outline.length) * 100) : 0;
    return { pct, scenes: outline.length, pages, withContent };
  }, [blocks]);

  return (
    <div className="mt-4 rounded-lg border border-border/60 bg-card/60 backdrop-blur p-3 space-y-2.5">
      <div className="flex items-center gap-1.5">
        <Activity className="h-3 w-3 text-primary" />
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Project Progress
        </h3>
        <span className="ml-auto text-[10px] font-mono tabular-nums text-foreground/80">{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted/60 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-primary to-primary/60 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="grid grid-cols-3 gap-1 text-[10px] text-muted-foreground">
        <div>
          <p className="font-mono tabular-nums text-foreground/90 text-xs">{withContent}/{scenes}</p>
          <p>scenes</p>
        </div>
        <div>
          <p className="font-mono tabular-nums text-foreground/90 text-xs">~{pages}</p>
          <p>pages</p>
        </div>
        <div>
          <p className="font-mono tabular-nums text-foreground/90 text-xs">Draft 1</p>
          <p>version</p>
        </div>
      </div>
      <Link
        to="/story-arc/$projectId"
        params={{ projectId }}
        className="w-full inline-flex items-center justify-center gap-1.5 text-[11px] px-2 py-1.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-medium"
      >
        View Arc <ArrowRight className="h-3 w-3" />
      </Link>
      <div className="flex items-center gap-1 pt-1 border-t border-border/40">
        <button
          onClick={onAddScene}
          className="flex-1 inline-flex items-center justify-center gap-1 text-[10px] py-1.5 rounded-md hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground"
          title="Add scene"
        >
          <Plus className="h-3 w-3" /> Scene
        </button>
        <Link
          to="/scenes/$projectId"
          params={{ projectId }}
          className="flex-1 inline-flex items-center justify-center gap-1 text-[10px] py-1.5 rounded-md hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground"
          title="Import / manage scenes"
        >
          <Upload className="h-3 w-3" /> Import
        </Link>
        <Link
          to="/pitch/$projectId"
          params={{ projectId }}
          className="flex-1 inline-flex items-center justify-center gap-1 text-[10px] py-1.5 rounded-md hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground"
          title="Export pitch & script"
        >
          <Download className="h-3 w-3" /> Export
        </Link>
      </div>
    </div>
  );
}
