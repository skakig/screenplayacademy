import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { STORY_BEATS_KEYS } from "./storypulse.shared";

const Input = z.object({ projectId: z.string().uuid() });

// Industry rule of thumb: ~55 typed screenplay lines per page.
const LINES_PER_PAGE = 55;

export const getStoryPulse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { data: blocks, error } = await context.supabase
      .from("script_blocks")
      .select("id, block_type, content, metadata, order_index")
      .eq("project_id", data.projectId)
      .order("order_index");
    if (error) throw new Error(error.message);

    const rows = blocks ?? [];
    const headings: {
      id: string;
      content: string;
      beat: string | null;
      lineCount: number;
      dialogueLines: number;
      characters: string[];
    }[] = [];

    let totalLines = 0;
    let dialogueLines = 0;
    let actionLines = 0;
    let lastHeadingIdx = -1;
    const charLineCounts = new Map<string, number>();
    let lastCharacter: string | null = null;

    const estLines = (text: string) => {
      const t = String(text ?? "").trim();
      if (!t) return 1;
      // Rough estimate: 60 chars per line of typed text
      return Math.max(1, Math.ceil(t.length / 60));
    };

    for (const b of rows) {
      const lines = estLines(b.content);
      totalLines += lines;

      if (b.block_type === "scene_heading") {
        headings.push({
          id: b.id,
          content: String(b.content || "").trim() || "(untitled scene)",
          beat: (b.metadata as any)?.beat ?? null,
          lineCount: 0,
          dialogueLines: 0,
          characters: [],
        });
        lastHeadingIdx = headings.length - 1;
        lastCharacter = null;
      } else if (lastHeadingIdx >= 0) {
        headings[lastHeadingIdx].lineCount += lines;
      }

      if (b.block_type === "action") actionLines += lines;

      if (b.block_type === "character") {
        const name = String(b.content || "").trim().toUpperCase();
        if (name) {
          lastCharacter = name;
          if (lastHeadingIdx >= 0 && !headings[lastHeadingIdx].characters.includes(name)) {
            headings[lastHeadingIdx].characters.push(name);
          }
        }
      }

      if (b.block_type === "dialogue") {
        dialogueLines += lines;
        if (lastHeadingIdx >= 0) headings[lastHeadingIdx].dialogueLines += lines;
        if (lastCharacter) {
          charLineCounts.set(lastCharacter, (charLineCounts.get(lastCharacter) ?? 0) + lines);
        }
      }
    }

    const beatDistribution: Record<string, number> = {};
    for (const key of STORY_BEATS_KEYS) beatDistribution[key] = 0;
    let withBeats = 0;
    for (const h of headings) {
      if (h.beat && beatDistribution[h.beat] !== undefined) {
        beatDistribution[h.beat] += 1;
        withBeats += 1;
      }
    }

    const characterScreenTime = [...charLineCounts.entries()]
      .map(([name, lines]) => ({ name, lines }))
      .sort((a, b) => b.lines - a.lines)
      .slice(0, 8);

    const totalDialogueAction = dialogueLines + actionLines;
    return {
      totals: {
        scenes: headings.length,
        pages: Math.max(1, Math.round((totalLines / LINES_PER_PAGE) * 10) / 10),
        dialogueLines,
        actionLines,
        dialogueRatio: totalDialogueAction > 0 ? dialogueLines / totalDialogueAction : 0,
        scenesWithBeats: withBeats,
      },
      beatDistribution,
      characterScreenTime,
      headings: headings.slice(0, 60),
      empty: rows.length === 0,
    };
  });
