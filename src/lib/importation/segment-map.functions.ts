// Read-only server helpers for the resolved segment_map.
//
// `promoteApprovedCharactersForDocument` performs the write path (promotes
// accepted candidates into stable `characters` rows and returns the
// segment_map as a side-effect of that work). The UI needs a lightweight
// read-only counterpart that can be called from a loader or a component
// without triggering promotion, and that also exposes a compact
// `resolved_lines` view suitable for direct rendering in the screenplay
// editor.
//
// Doctrine: docs/ITS_PfHU_Importation.md §4.4 / §5.4 / §6.7.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { renderResolvedScreenplay } from "./segment-render.functions";

export type ResolvedSegmentEntity = {
  character_id: string;
  name: string;
  role: "speaker" | "mention";
};

export type ResolvedSegmentMapRow = {
  segment_id: string;
  sequence: number;
  segment_type: string;
  block_type: "scene_heading" | "character" | "dialogue" | "action";
  text: string;
  resolved_character_id: string | null;
  resolved_from_raw: string | null;
  entities: ResolvedSegmentEntity[];
};

export type ResolvedSegmentMap = {
  document_id: string;
  title: string;
  entities: Array<{ character_id: string; name: string; raw_names: string[] }>;
  rows: ResolvedSegmentMapRow[];
  totals: {
    segments: number;
    resolved_speakers: number;
    segments_with_mentions: number;
  };
};

// GET-shaped read helper. Delegates to `renderResolvedScreenplay` (which is
// itself idempotent — it auto-promotes accepted candidates before rendering
// but short-circuits when there is nothing new to promote) and reshapes the
// output into a compact per-segment map keyed for UI rendering.
export const getResolvedSegmentMap = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ document_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }): Promise<ResolvedSegmentMap> => {
    const rendered = await renderResolvedScreenplay({
      data: { document_id: data.document_id },
    });

    const nameById = new Map(
      rendered.entities.map((e) => [e.character_id, e.name] as const),
    );

    const rows: ResolvedSegmentMapRow[] = rendered.lines.map((line) => {
      const entities: ResolvedSegmentEntity[] = [];
      if (line.resolved_character_id) {
        entities.push({
          character_id: line.resolved_character_id,
          name:
            nameById.get(line.resolved_character_id) ??
            line.text ??
            "Unknown",
          role: "speaker",
        });
      }
      // Mentions: any canonical entity name appearing in the rewritten text
      // that isn't the speaker itself. Uses word-boundary detection so we
      // don't match partial names.
      if (line.block_type === "action" || line.block_type === "dialogue") {
        for (const [id, name] of nameById) {
          if (id === line.resolved_character_id) continue;
          if (!name) continue;
          const pat = new RegExp(
            `(^|[^\\p{L}\\p{N}_])${name.replace(
              /[.*+?^${}()|[\]\\]/g,
              "\\$&",
            )}(?=$|[^\\p{L}\\p{N}_])`,
            "iu",
          );
          if (pat.test(line.text)) {
            entities.push({ character_id: id, name, role: "mention" });
          }
        }
      }

      return {
        segment_id: line.segment_id,
        sequence: line.sequence,
        segment_type: line.segment_type,
        block_type: line.block_type,
        text: line.text,
        resolved_character_id: line.resolved_character_id,
        resolved_from_raw: line.resolved_from_raw,
        entities,
      };
    });

    return {
      document_id: rendered.document_id,
      title: rendered.title,
      entities: rendered.entities,
      rows,
      totals: rendered.totals,
    };
  });
