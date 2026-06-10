import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Clapperboard, RotateCcw, Trash2, Camera } from "lucide-react";
import { toast } from "sonner";
import { readDraft, type DraftPayload } from "./draftBackup";
import { formatDistanceToNow } from "date-fns";

type Take = {
  id: string;
  name: string;
  capturedAt: number;
  blockCount: number;
  wordCount: number;
  payload: DraftPayload;
};

const TAKES_PREFIX = "scenesmith.takes.v1.";

function takesKey(projectId: string) {
  return TAKES_PREFIX + projectId;
}

function readTakes(projectId: string): Take[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(takesKey(projectId));
    if (!raw) return [];
    const arr = JSON.parse(raw) as Take[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeTakes(projectId: string, takes: Take[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(takesKey(projectId), JSON.stringify(takes));
  } catch {
    // quota — silent
  }
}

function countWords(payload: DraftPayload): number {
  return payload.blocks.reduce(
    (n, b) => n + ((b.content ?? "").trim().split(/\s+/).filter(Boolean).length),
    0,
  );
}

type Props = {
  projectId: string;
};

export function DraftHistoryPanel({ projectId }: Props) {
  const [takes, setTakes] = useState<Take[]>([]);
  const [name, setName] = useState("");

  const refresh = useCallback(() => setTakes(readTakes(projectId)), [projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const capture = () => {
    const draft = readDraft(projectId);
    if (!draft || draft.blocks.length === 0) {
      toast.error("Nothing to capture yet — write a few lines first.");
      return;
    }
    const take: Take = {
      id: `take-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: name.trim() || `Take ${takes.length + 1}`,
      capturedAt: Date.now(),
      blockCount: draft.blocks.length,
      wordCount: countWords(draft),
      payload: draft,
    };
    const next = [take, ...takes].slice(0, 25);
    writeTakes(projectId, next);
    setTakes(next);
    setName("");
    toast.success(`Slated "${take.name}"`);
  };

  const restore = (take: Take) => {
    if (typeof window === "undefined") return;
    if (!window.confirm(`Roll back to "${take.name}"? Your current draft will be replaced.`)) return;
    try {
      // Snapshot current state first so the rollback itself is reversible.
      const current = readDraft(projectId);
      if (current && current.blocks.length > 0) {
        const safety: Take = {
          id: `take-${Date.now()}-auto`,
          name: `Before rolling back to ${take.name}`,
          capturedAt: Date.now(),
          blockCount: current.blocks.length,
          wordCount: countWords(current),
          payload: current,
        };
        writeTakes(projectId, [safety, ...readTakes(projectId)].slice(0, 25));
      }
      window.localStorage.setItem(
        "scenesmith.draft.v1." + projectId,
        JSON.stringify(take.payload),
      );
      toast.success(`Rolling back to "${take.name}"…`);
      setTimeout(() => window.location.reload(), 350);
    } catch {
      toast.error("Couldn't restore that take.");
    }
  };

  const remove = (take: Take) => {
    const next = takes.filter((t) => t.id !== take.id);
    writeTakes(projectId, next);
    setTakes(next);
  };

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-border/60 bg-card/40 p-3 space-y-2">
        <div className="flex items-center gap-1.5">
          <Clapperboard className="h-3.5 w-3.5 text-primary" />
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
            Slate a new take
          </p>
        </div>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder='Take name (e.g. "Act II reworked")'
          className="h-8 text-xs"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              capture();
            }
          }}
        />
        <Button size="sm" className="w-full h-8 text-xs" onClick={capture}>
          <Camera className="h-3.5 w-3.5 mr-1.5" />
          Capture this take
        </Button>
        <p className="text-[10px] text-muted-foreground leading-snug">
          Snapshots your current draft locally. Up to 25 takes per project.
        </p>
      </div>

      {takes.length === 0 ? (
        <p className="text-xs text-muted-foreground italic px-1">
          No takes yet. Capture your first slate before a big rewrite.
        </p>
      ) : (
        <ScrollArea className="h-[360px] -mr-2 pr-2">
          <ul className="space-y-2">
            {takes.map((t, i) => (
              <li
                key={t.id}
                className="rounded-md border border-border/50 bg-card/30 overflow-hidden"
              >
                <div className="flex items-stretch">
                  <div
                    className="w-9 shrink-0 flex flex-col items-center justify-center bg-primary/10 border-r border-border/50 font-mono text-[10px] text-primary/80 leading-tight py-2"
                    aria-hidden
                  >
                    <span className="text-muted-foreground">TAKE</span>
                    <span className="text-sm font-semibold">
                      {String(takes.length - i).padStart(2, "0")}
                    </span>
                  </div>
                  <div className="flex-1 p-2.5 min-w-0">
                    <p className="text-xs font-medium truncate">{t.name}</p>
                    <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                      {formatDistanceToNow(t.capturedAt, { addSuffix: true })}
                      <span className="mx-1.5 opacity-50">·</span>
                      {t.wordCount.toLocaleString()} words
                      <span className="mx-1.5 opacity-50">·</span>
                      {t.blockCount} lines
                    </p>
                    <div className="flex items-center gap-1 mt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 text-[10px] px-2"
                        onClick={() => restore(t)}
                      >
                        <RotateCcw className="h-3 w-3 mr-1" />
                        Roll back
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 text-[10px] px-2 text-muted-foreground hover:text-foreground"
                        onClick={() => remove(t)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </ScrollArea>
      )}
    </div>
  );
}
