import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ChevronDown, ChevronRight, Check, Circle, Sparkles, Users, GitBranch, Layers, Film, ArrowRight } from "lucide-react";
import type { Block } from "@/lib/editor/manuscriptAnalyzer";
import { buildOutline, tallyCharacters } from "@/lib/editor/manuscriptAnalyzer";

type Props = {
  projectId: string;
  blocks: Block[];
  onOpenStoryBuilder: () => void;
};

type Section = {
  key: string;
  title: string;
  Icon: React.ComponentType<{ className?: string }>;
  done: boolean;
  hint: string;
  body: React.ReactNode;
};

export function StoryBuilderPanel({ projectId, blocks, onOpenStoryBuilder }: Props) {
  const [openKey, setOpenKey] = useState<string | null>("foundation");

  const { data: project } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from("projects")
        .select("logline, genre, title")
        .eq("id", projectId)
        .maybeSingle();
      return data;
    },
  });

  const characters = useMemo(() => tallyCharacters(blocks), [blocks]);
  const outline = useMemo(() => buildOutline(blocks), [blocks]);

  const sections: Section[] = [
    {
      key: "foundation",
      title: "Foundation",
      Icon: Sparkles,
      done: !!project?.logline,
      hint: project?.logline ? "Logline ready" : "Add logline & genre",
      body: (
        <div className="space-y-2 text-xs">
          {project?.logline ? (
            <p className="text-foreground/85 leading-snug italic">"{project.logline}"</p>
          ) : (
            <p className="text-muted-foreground italic">No logline yet. Open Story Builder for an AI-drafted spine.</p>
          )}
          <p className="text-muted-foreground">
            <span className="uppercase tracking-wider text-[10px]">Genre</span> · {project?.genre ?? "—"}
          </p>
          <button
            onClick={onOpenStoryBuilder}
            className="w-full inline-flex items-center justify-center gap-1.5 text-[11px] py-1.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-medium"
          >
            <Sparkles className="h-3 w-3" /> AI draft my spine
          </button>
        </div>
      ),
    },
    {
      key: "characters",
      title: "Characters",
      Icon: Users,
      done: characters.length > 0,
      hint: `${characters.length} detected`,
      body: (
        <div className="space-y-2 text-xs">
          {characters.length === 0 ? (
            <p className="text-muted-foreground italic">Characters appear here as you write dialogue.</p>
          ) : (
            <ul className="space-y-1">
              {characters.slice(0, 6).map((c) => (
                <li key={c.name} className="flex items-center justify-between px-2 py-1 rounded bg-muted/30">
                  <span className="font-medium">{c.name}</span>
                  <span className="text-[10px] text-muted-foreground font-mono">{c.lineCount} lines</span>
                </li>
              ))}
            </ul>
          )}
          <Link
            to="/characters/$projectId"
            params={{ projectId }}
            className="w-full inline-flex items-center justify-center gap-1.5 text-[11px] py-1.5 rounded-md bg-card/60 border border-border/60 hover:bg-card transition-colors text-foreground/85"
          >
            Open Character Intelligence <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      ),
    },
    {
      key: "arc",
      title: "Three-Act Arc",
      Icon: GitBranch,
      done: outline.length >= 3,
      hint: `${outline.length} scenes mapped`,
      body: (
        <div className="space-y-1.5 text-xs">
          {(["SETUP", "CONFRONTATION", "RESOLUTION"] as const).map((label, i) => {
            const act = (i + 1) as 1 | 2 | 3;
            const count = outline.filter((s) => s.act === act).length;
            return (
              <div
                key={label}
                className="flex items-center justify-between px-2 py-1.5 rounded-md border border-border/40 bg-card/40"
              >
                <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                  Act {act === 1 ? "I" : act === 2 ? "II" : "III"} · {label}
                </span>
                <span className="text-[10px] font-mono text-foreground/80">
                  {count} {count === 1 ? "scene" : "scenes"}
                </span>
              </div>
            );
          })}
          <Link
            to="/story-arc/$projectId"
            params={{ projectId }}
            className="w-full inline-flex items-center justify-center gap-1.5 text-[11px] py-1.5 rounded-md bg-card/60 border border-border/60 hover:bg-card transition-colors text-foreground/85"
          >
            Open Arc Engine <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      ),
    },
    {
      key: "scenes",
      title: "Scene Builder",
      Icon: Layers,
      done: outline.length > 0,
      hint: `${outline.length} so far`,
      body: (
        <div className="space-y-1 text-xs max-h-40 overflow-auto">
          {outline.length === 0 ? (
            <p className="text-muted-foreground italic">Write INT. or EXT. to start your first scene.</p>
          ) : (
            outline.slice(0, 8).map((s) => (
              <div key={s.id} className="flex items-center gap-1.5 px-2 py-1 rounded bg-muted/20 text-foreground/85">
                <Film className="h-3 w-3 opacity-50 shrink-0" />
                <span className="text-[10px] font-mono opacity-60">{String(s.index + 1).padStart(2, "0")}</span>
                <span className="truncate">{s.location || s.title || "Untitled"}</span>
              </div>
            ))
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-2">
      {sections.map((s) => {
        const isOpen = openKey === s.key;
        const Icon = s.Icon;
        return (
          <div
            key={s.key}
            className="rounded-lg border border-border/50 bg-card/40 overflow-hidden"
          >
            <button
              onClick={() => setOpenKey(isOpen ? null : s.key)}
              className="w-full px-3 py-2 flex items-center gap-2 hover:bg-muted/40 transition-colors"
            >
              {s.done ? (
                <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              ) : (
                <Circle className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
              )}
              <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="text-xs font-semibold flex-1 text-left">{s.title}</span>
              <span className="text-[10px] text-muted-foreground">{s.hint}</span>
              {isOpen ? (
                <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
              ) : (
                <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
              )}
            </button>
            {isOpen && <div className="px-3 pb-3 pt-1 border-t border-border/40 bg-background/20">{s.body}</div>}
          </div>
        );
      })}
    </div>
  );
}
