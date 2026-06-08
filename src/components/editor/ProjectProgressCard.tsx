import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Activity, ArrowRight, Plus, Download, Upload, Sparkles, CheckCircle2, FileText, Film } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Block } from "@/lib/editor/manuscriptAnalyzer";
import { buildOutline, estimatePages } from "@/lib/editor/manuscriptAnalyzer";

type Props = {
  projectId: string;
  blocks: Block[];
  onAddScene: () => void;
};

type Metric = {
  key: string;
  label: string;
  value: string;
  hint?: string;
  Icon: React.ComponentType<{ className?: string }>;
};

/**
 * Sticky bottom card on the Story Navigator — surfaces accurate, live
 * project metrics: scenes (analyzer + DB cross-check), estimated pages,
 * guided steps completed, and AI assists used.
 */
export function ProjectProgressCard({ projectId, blocks, onAddScene }: Props) {
  // Live analyzer numbers (accurate to the manuscript right now)
  const { scenesTotal, scenesWithContent, pages, pct } = useMemo(() => {
    const outline = buildOutline(blocks);
    const pages = estimatePages(blocks);
    const scenesWithContent = outline.filter((s) => s.blockCount >= 3).length;
    const total = outline.length;
    const pct = total ? Math.round((scenesWithContent / total) * 100) : 0;
    return { scenesTotal: total, scenesWithContent, pages, pct };
  }, [blocks]);

  // Guided steps completion (Story Builder progress)
  const { data: stepCounts } = useQuery({
    queryKey: ["progress:guided-steps", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_guided_steps")
        .select("status")
        .eq("project_id", projectId);
      if (error) throw error;
      const total = data?.length ?? 0;
      const done = data?.filter((r) => r.status === "completed").length ?? 0;
      return { total, done };
    },
    staleTime: 30_000,
  });

  // AI assists used (project lifetime, from session telemetry)
  const { data: aiAssists } = useQuery({
    queryKey: ["progress:ai-assists", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("editor_sessions")
        .select("ai_calls, ai_accepts")
        .eq("project_id", projectId);
      if (error) throw error;
      const calls = (data ?? []).reduce((sum, r) => sum + (r.ai_calls ?? 0), 0);
      const accepts = (data ?? []).reduce((sum, r) => sum + (r.ai_accepts ?? 0), 0);
      return { calls, accepts };
    },
    staleTime: 30_000,
  });

  const stepsTotal = stepCounts?.total ?? 0;
  const stepsDone = stepCounts?.done ?? 0;
  const stepsHint = stepsTotal > 0 ? `${stepsDone}/${stepsTotal}` : "—";

  const metrics: Metric[] = [
    {
      key: "scenes",
      label: "Scenes",
      value: scenesTotal === 0 ? "0" : `${scenesWithContent}/${scenesTotal}`,
      hint: scenesTotal > 0 ? `${scenesWithContent} with content` : "Start your first scene",
      Icon: Film,
    },
    {
      key: "pages",
      label: "Pages",
      value: `~${pages}`,
      hint: "Est. industry format",
      Icon: FileText,
    },
    {
      key: "steps",
      label: "Steps",
      value: stepsHint,
      hint: stepsTotal > 0 ? "Guided builder" : "Not started",
      Icon: CheckCircle2,
    },
    {
      key: "ai",
      label: "AI Assists",
      value: String(aiAssists?.calls ?? 0),
      hint:
        (aiAssists?.calls ?? 0) > 0
          ? `${aiAssists?.accepts ?? 0} accepted`
          : "None used yet",
      Icon: Sparkles,
    },
  ];

  return (
    <div className="mt-4 rounded-lg border border-border/60 bg-card/60 backdrop-blur p-3 space-y-3">
      <div className="flex items-center gap-1.5">
        <Activity className="h-3 w-3 text-primary" />
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Project Progress
        </h3>
        <span className="ml-auto text-[10px] font-mono tabular-nums text-foreground/80">
          {pct}%
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted/60 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-primary to-primary/60 transition-all duration-500"
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Project completion"
        />
      </div>
      <ul className="grid grid-cols-2 gap-1.5">
        {metrics.map((m) => {
          const Icon = m.Icon;
          return (
            <li
              key={m.key}
              className="rounded-md bg-muted/30 border border-border/40 px-2 py-1.5 min-w-0"
              title={m.hint}
            >
              <div className="flex items-center gap-1 text-muted-foreground">
                <Icon className="h-2.5 w-2.5 shrink-0" />
                <span className="text-[9px] uppercase tracking-wider truncate">{m.label}</span>
              </div>
              <p className="text-xs font-mono tabular-nums text-foreground/95 mt-0.5 truncate">
                {m.value}
              </p>
              {m.hint && (
                <p className="text-[9px] text-muted-foreground/80 truncate">{m.hint}</p>
              )}
            </li>
          );
        })}
      </ul>
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
