// Editable surfaces for the Character Bible:
//   • Aliases per character (add / remove)
//   • Evidence excerpts per character (edit / reclassify / delete)
//
// Evidence rows live under `import_candidates` — we resolve which candidates
// belong to a given resolved character via `promoted_ref`.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const EVIDENCE_TYPES = [
  "speaking",
  "mention",
  "action",
  "description",
  "attribute",
  "relationship",
] as const;
const DIRECT_OR_INFERRED = ["direct", "inferred"] as const;

function normalizeAlias(s: string) {
  return s.trim().toUpperCase().replace(/\s+/g, " ");
}

/** Aliases + evidence for a single character within a universe. */
export const getCharacterBibleEditable = createServerFn({ method: "GET" })
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

    const { data: ch, error: chErr } = await supabase
      .from("characters")
      .select("id, name, project_id")
      .eq("id", data.character_id)
      .eq("project_id", data.project_id)
      .maybeSingle();
    if (chErr) throw new Error(chErr.message);
    if (!ch) throw new Error("Character not found");

    const { data: aliases, error: aErr } = await supabase
      .from("character_aliases")
      .select("id, alias_text, alias_kind, source, created_at")
      .eq("character_id", data.character_id)
      .order("alias_text");
    if (aErr) throw new Error(aErr.message);

    // Candidates in this universe promoted to this character.
    const { data: cands, error: cErr } = await supabase
      .from("import_candidates")
      .select("id, promoted_ref")
      .eq("universe_id", data.universe_id)
      .eq("candidate_type", "character")
      .in("status", ["accepted", "approved"]);
    if (cErr) throw new Error(cErr.message);
    const candidateIds = (cands ?? [])
      .filter((c) => {
        const ref = c.promoted_ref as { table?: string; id?: string } | null;
        return ref?.table === "characters" && ref.id === data.character_id;
      })
      .map((c) => c.id as string);

    let evidence: {
      id: string;
      candidate_id: string;
      segment_id: string;
      excerpt: string;
      evidence_type: string;
      direct_or_inferred: string;
      confidence: number;
      location_hint: string | null;
      heading: string | null;
      sequence: number | null;
      document_id: string | null;
    }[] = [];

    if (candidateIds.length > 0) {
      const { data: evRows, error: eErr } = await supabase
        .from("import_evidence")
        .select(
          "id, candidate_id, segment_id, excerpt, evidence_type, direct_or_inferred, confidence, location_hint",
        )
        .in("candidate_id", candidateIds)
        .order("confidence", { ascending: false });
      if (eErr) throw new Error(eErr.message);

      const segIds = Array.from(
        new Set((evRows ?? []).map((e) => e.segment_id as string)),
      );
      const segMap = new Map<
        string,
        { heading: string | null; sequence: number; document_id: string }
      >();
      if (segIds.length > 0) {
        const { data: segs } = await supabase
          .from("source_segments")
          .select("id, heading, sequence, document_id")
          .in("id", segIds);
        for (const s of segs ?? []) {
          segMap.set(s.id as string, {
            heading: (s.heading as string | null) ?? null,
            sequence: s.sequence as number,
            document_id: s.document_id as string,
          });
        }
      }

      evidence = (evRows ?? []).map((e) => {
        const seg = segMap.get(e.segment_id as string);
        return {
          id: e.id as string,
          candidate_id: e.candidate_id as string,
          segment_id: e.segment_id as string,
          excerpt: e.excerpt as string,
          evidence_type: e.evidence_type as string,
          direct_or_inferred: e.direct_or_inferred as string,
          confidence: Number(e.confidence ?? 0),
          location_hint: (e.location_hint as string | null) ?? null,
          heading: seg?.heading ?? null,
          sequence: seg?.sequence ?? null,
          document_id: seg?.document_id ?? null,
        };
      });
    }

    return {
      character: { id: ch.id as string, name: ch.name as string },
      aliases: (aliases ?? []).map((a) => ({
        id: a.id as string,
        alias_text: a.alias_text as string,
        alias_kind: a.alias_kind as string,
        source: a.source as string,
        created_at: a.created_at as string,
      })),
      evidence,
    };
  });

export const addCharacterAlias = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        project_id: z.string().uuid(),
        character_id: z.string().uuid(),
        alias_text: z.string().min(1).max(200),
        alias_kind: z.string().min(1).max(40).default("manual"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const alias_text = data.alias_text.trim();
    if (!alias_text) throw new Error("Alias cannot be empty");
    const { data: row, error } = await supabase
      .from("character_aliases")
      .insert({
        project_id: data.project_id,
        character_id: data.character_id,
        alias_text,
        normalized: normalizeAlias(alias_text),
        alias_kind: data.alias_kind,
        source: "manual",
      })
      .select("id, alias_text, alias_kind, source, created_at")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const removeCharacterAlias = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ alias_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("character_aliases")
      .delete()
      .eq("id", data.alias_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateEvidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        evidence_id: z.string().uuid(),
        excerpt: z.string().min(1).max(1000).optional(),
        evidence_type: z.enum(EVIDENCE_TYPES).optional(),
        direct_or_inferred: z.enum(DIRECT_OR_INFERRED).optional(),
        confidence: z.number().min(0).max(1).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = {};
    if (data.excerpt !== undefined) patch.excerpt = data.excerpt.trim();
    if (data.evidence_type !== undefined) patch.evidence_type = data.evidence_type;
    if (data.direct_or_inferred !== undefined)
      patch.direct_or_inferred = data.direct_or_inferred;
    if (data.confidence !== undefined) patch.confidence = data.confidence;
    if (Object.keys(patch).length === 0) return { ok: true, updated: false };
    const { data: row, error } = await context.supabase
      .from("import_evidence")
      .update(patch)
      .eq("id", data.evidence_id)
      .select(
        "id, excerpt, evidence_type, direct_or_inferred, confidence, segment_id, candidate_id, location_hint",
      )
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, updated: true, row };
  });

export const deleteEvidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ evidence_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("import_evidence")
      .delete()
      .eq("id", data.evidence_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const EVIDENCE_TYPE_OPTIONS = EVIDENCE_TYPES;
export const EVIDENCE_MODE_OPTIONS = DIRECT_OR_INFERRED;
