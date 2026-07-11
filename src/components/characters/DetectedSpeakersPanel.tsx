// DEPRECATED — do not extend. Unmounted at Pass 2, deleted at Pass 3.
// See docs/CHARACTERS_REBUILD.md.
import { useMemo, useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserPlus, EyeOff, Mic } from "lucide-react";
import { toast } from "sonner";
import { tallyCharacters, normalizeCharacterName, type Block } from "@/lib/editor/manuscriptAnalyzer";
import { upsertCharacter } from "@/lib/characters.functions";

const ignoredKey = (projectId: string) => `lovable.editor.dismissedChars.v1:${projectId}`;

function readIgnored(projectId: string): string[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(ignoredKey(projectId)) || "[]"); } catch { return []; }
}
function writeIgnored(projectId: string, list: string[]) {
  try { localStorage.setItem(ignoredKey(projectId), JSON.stringify(list)); } catch { /* ignore */ }
}

export function DetectedSpeakersPanel({
  projectId,
  existingNames,
}: {
  projectId: string;
  existingNames: string[];
}) {
  const qc = useQueryClient();
  const callUpsert = useServerFn(upsertCharacter);
  const [ignored, setIgnored] = useState<string[]>(() => readIgnored(projectId));

  useEffect(() => setIgnored(readIgnored(projectId)), [projectId]);

  const { data: blocks = [] } = useQuery<Block[]>({
    queryKey: ["script-blocks-for-cast", projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from("script_blocks")
        .select("id,block_type,content,order_index,metadata")
        .eq("project_id", projectId)
        .order("order_index");
      return (data ?? []) as Block[];
    },
  });

  const existingSet = useMemo(
    () => new Set(existingNames.map((n) => normalizeCharacterName(n))),
    [existingNames],
  );

  const detected = useMemo(() => {
    const ignoredSet = new Set(ignored);
    return tallyCharacters(blocks).filter(
      (t) => !existingSet.has(t.name) && !ignoredSet.has(t.name),
    );
  }, [blocks, existingSet, ignored]);

  const add = useMutation({
    mutationFn: async (name: string) =>
      callUpsert({ data: { project_id: projectId, patch: { name: titleCase(name) } } }),
    onSuccess: (_r, name) => {
      qc.invalidateQueries({ queryKey: ["characters", projectId] });
      toast.success(`${titleCase(name)} added to cast`);
    },
    onError: (e: any) => toast.error(e?.message ?? "Add failed"),
  });

  const ignore = (name: string) => {
    const next = Array.from(new Set([...ignored, name]));
    writeIgnored(projectId, next);
    setIgnored(next);
  };
  const restoreAll = () => { writeIgnored(projectId, []); setIgnored([]); };

  const ignoredCount = ignored.length;

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-2">
        <Mic className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-display text-lg">Detected Speakers</h2>
        <Badge variant="outline" className="text-[10px]">{detected.length}</Badge>
        <div className="flex-1" />
        {ignoredCount > 0 && (
          <Button size="sm" variant="ghost" onClick={restoreAll} className="text-[11px]">
            Restore {ignoredCount} ignored
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Names spoken in your screenplay that aren't in your cast yet. Add to promote them, or ignore.
      </p>
      {detected.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">No new speakers detected.</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {detected.map((d) => (
            <div key={d.name} className="flex items-center gap-2 rounded-md border border-border/60 px-3 py-2">
              <div className="flex-1 min-w-0">
                <div className="font-mono text-xs truncate">{d.name}</div>
                <div className="text-[10px] text-muted-foreground">{d.lineCount} line{d.lineCount === 1 ? "" : "s"}</div>
              </div>
              <Button size="sm" variant="outline" className="h-7" disabled={add.isPending} onClick={() => add.mutate(d.name)}>
                <UserPlus className="h-3 w-3 mr-1" />Add
              </Button>
              <Button size="sm" variant="ghost" className="h-7" onClick={() => ignore(d.name)}>
                <EyeOff className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function titleCase(s: string): string {
  return s.toLowerCase().split(/\s+/).map((w) => (w ? w[0].toUpperCase() + w.slice(1) : "")).join(" ");
}
