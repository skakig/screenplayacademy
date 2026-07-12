// Pass A — read helper: return the latest Character Bible entry for a
// specific resolved character, so UI surfaces (resolved screenplay view,
// bible peek sheet) can render canonical identity + evidence without
// re-computing the bible.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type BibleEntryLite = {
  bible_id: string;
  bible_version: number;
  character_id: string;
  name: string;
  importance: string | null;
  aliases: string[];
  speaking_segments: number;
  mention_segments: number;
  first_appearance: {
    document_id: string;
    segment_id: string;
    sequence: number;
    heading: string | null;
  } | null;
  top_evidence: {
    segment_id: string;
    excerpt: string;
    confidence: number;
    document_id: string | null;
  }[];
  source_document_ids: string[];
};

export const getBibleEntryForCharacter = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        project_id: z.string().uuid(),
        universe_id: z.string().uuid(),
        character_id: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: bible, error } = await supabase
      .from("character_bibles")
      .select("id, version, entries")
      .eq("universe_id", data.universe_id)
      .eq("project_id", data.project_id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!bible) return null;
    const entries = (bible.entries ?? []) as Array<
      BibleEntryLite & { character_id: string }
    >;
    const entry = entries.find((e) => e.character_id === data.character_id);
    if (!entry) return null;
    return {
      ...entry,
      bible_id: bible.id,
      bible_version: bible.version,
    } as BibleEntryLite;
  });
