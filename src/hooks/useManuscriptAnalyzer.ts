import { useEffect, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { upsertCharacter, listProjectCharacters } from "@/lib/characters.functions";
import { syncManuscriptScenes } from "@/lib/editor/sceneSync.functions";
import { type Block, buildOutline, tallyCharacters, normalizeCharacterName, isLikelyCharacterName } from "@/lib/editor/manuscriptAnalyzer";

/**
 * Background analyzer: watches script blocks and proposes new characters /
 * keeps the scenes table in sync as the writer types. Debounced 1.5s after
 * the last block change. Stores ack'd suggestions in localStorage so the
 * same toast doesn't re-appear.
 */
export function useManuscriptAnalyzer(opts: {
  projectId: string;
  blocks: Block[];
  existingCharacterNames: string[];
}) {
  const { projectId, blocks, existingCharacterNames } = opts;
  const qc = useQueryClient();
  const createChar = useServerFn(upsertCharacter);
  const syncScenes = useServerFn(syncManuscriptScenes);

  const ackKey = `lovable.editor.detectedChars.v1:${projectId}`;
  const dismissedKey = `lovable.editor.dismissedChars.v1:${projectId}`;

  const existingSet = useMemo(
    () => new Set(existingCharacterNames.map((n) => normalizeCharacterName(n))),
    [existingCharacterNames]
  );

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastBlocksSig = useRef<string>("");

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    // Cheap signature: ids + content lengths + types
    const sig = blocks
      .map((b) => `${b.id}:${b.block_type}:${(b.content || "").length}`)
      .join("|");
    if (sig === lastBlocksSig.current) return;
    lastBlocksSig.current = sig;

    timerRef.current = setTimeout(async () => {
      if (typeof window === "undefined") return;
      let acked: string[] = [];
      let dismissed: string[] = [];
      try {
        acked = JSON.parse(localStorage.getItem(ackKey) || "[]");
        dismissed = JSON.parse(localStorage.getItem(dismissedKey) || "[]");
      } catch { /* ignore */ }

      // ---- character detection ----
      const tally = tallyCharacters(blocks);
      const newOnes = tally
        .filter((t) => isLikelyCharacterName(t.name))
        .filter((t) => !existingSet.has(t.name))
        .filter((t) => !acked.includes(t.name))
        .filter((t) => !dismissed.includes(t.name))
        .filter((t) => t.lineCount >= 1) // needs at least one spoken line
        .slice(0, 1); // one toast at a time

      for (const t of newOnes) {
        toast.info(`New character detected: ${t.name}`, {
          description: `${t.lineCount} line${t.lineCount === 1 ? "" : "s"} so far. Add to cast?`,
          duration: 10_000,
          action: {
            label: "Add",
            onClick: async () => {
              try {
                await createChar({
                  data: { project_id: projectId, patch: { name: titleCase(t.name) } },
                });
                qc.invalidateQueries({ queryKey: ["characters", projectId] });
                const next = [...acked, t.name];
                localStorage.setItem(ackKey, JSON.stringify(next));
                toast.success(`${titleCase(t.name)} added to cast`);
              } catch (e: any) {
                toast.error(e?.message ?? "Couldn't add character");
              }
            },
          },
          cancel: {
            label: "Not a character",
            onClick: () => {
              const next = [...dismissed, t.name];
              localStorage.setItem(dismissedKey, JSON.stringify(next));
            },
          },
        });
      }

      // ---- scene sync ----
      try {
        const outline = buildOutline(blocks);
        const scenes = outline
          .filter((s) => s.headingBlockId)
          .map((s) => ({
            heading: s.title,
            location: s.location ?? "",
            time_of_day: s.timeOfDay ?? "",
            order_index: s.index,
          }));
        if (scenes.length > 0) {
          await syncScenes({ data: { projectId, scenes } });
          qc.invalidateQueries({ queryKey: ["scenes", projectId] });
        }
      } catch { /* silent — never block the writer */ }
    }, 1500);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [blocks, projectId, existingSet, ackKey, dismissedKey, createChar, syncScenes, qc]);
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ""))
    .join(" ");
}
