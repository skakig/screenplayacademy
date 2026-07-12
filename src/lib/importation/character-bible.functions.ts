// Phase 4 — auto-generate a character bible from resolved identities.
//
// Reads every non-quarantined character in a project that was promoted from
// an `import_candidates` row under the given story universe, folds in
// aliases + top evidence excerpts + first appearance + speaking/mention
// counts, and writes a versioned `character_bibles` row attached to the
// universe + project.
//
// Idempotent-per-version: each call inserts a new version so history is
// preserved; callers can page through prior generations.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

type BibleEntry = {
  character_id: string;
  name: string;
  importance: string | null;
  aliases: string[];
  candidate_ids: string[];
  source_document_ids: string[];
  source: "manual" | "imported";
  first_appearance: {
    document_id: string;
    segment_id: string;
    sequence: number;
    heading: string | null;
  } | null;
  speaking_segments: number;
  mention_segments: number;
  top_evidence: {
    segment_id: string;
    excerpt: string;
    confidence: number;
    document_id: string | null;
  }[];
};

export const generateCharacterBible = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        universe_id: z.string().uuid(),
        project_id: z.string().uuid(),
        summary: z.string().max(4000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Sanity: universe + project belong to caller (RLS enforces, but a clear
    // error message helps callers).
    const [{ data: uni, error: uErr }, { data: proj, error: pErr }] =
      await Promise.all([
        supabase
          .from("story_universes")
          .select("id")
          .eq("id", data.universe_id)
          .single(),
        supabase
          .from("projects")
          .select("id")
          .eq("id", data.project_id)
          .single(),
      ]);
    if (uErr || !uni) throw new Error("Universe not found");
    if (pErr || !proj) throw new Error("Project not found");

    // 1) Every character candidate under this universe that has been promoted
    //    into a `characters` row.
    const { data: cands, error: cErr } = await supabase
      .from("import_candidates")
      .select(
        "id, normalized_key, proposed_payload, promoted_ref, document_id",
      )
      .eq("universe_id", data.universe_id)
      .eq("candidate_type", "character")
      .in("status", ["accepted", "approved"]);
    if (cErr) throw new Error(cErr.message);

    const promotedRows = (cands ?? []).filter((c) => {
      const ref = c.promoted_ref as { table?: string; id?: string } | null;
      return ref?.table === "characters" && typeof ref.id === "string";
    });
    // Note: we no longer bail out when there are no promoted candidates —
    // manually-created characters must still appear in the Bible.

    const characterIds = Array.from(
      new Set(
        promotedRows.map(
          (c) => (c.promoted_ref as { id: string }).id,
        ),
      ),
    );

    // 2) Character metadata (RLS ensures the project belongs to the caller).
    const { data: chars, error: chErr } = await supabase
      .from("characters")
      .select("id, name, importance, project_id, quarantined_at")
      .in("id", characterIds)
      .eq("project_id", data.project_id)
      .is("quarantined_at", null);
    if (chErr) throw new Error(chErr.message);
    const charById = new Map(
      (chars ?? []).map((c) => [c.id as string, c]),
    );

    // 3) Evidence for the promoted candidates, joined to segments for
    //    ordering + first-appearance resolution.
    const candIds = promotedRows.map((c) => c.id);
    const { data: evRows, error: eErr } = await supabase
      .from("import_evidence")
      .select(
        "candidate_id, segment_id, excerpt, confidence, direct_or_inferred",
      )
      .in("candidate_id", candIds);
    if (eErr) throw new Error(eErr.message);

    const segIds = Array.from(
      new Set((evRows ?? []).map((e) => e.segment_id)),
    );
    const segById = new Map<
      string,
      {
        id: string;
        sequence: number;
        heading: string | null;
        document_id: string;
        segment_type: string;
        speakers: string[] | null;
      }
    >();
    if (segIds.length > 0) {
      const { data: segRows, error: sErr } = await supabase
        .from("source_segments")
        .select(
          "id, sequence, heading, document_id, segment_type, speakers",
        )
        .in("id", segIds);
      if (sErr) throw new Error(sErr.message);
      for (const s of segRows ?? []) {
        segById.set(s.id as string, {
          id: s.id as string,
          sequence: s.sequence as number,
          heading: (s.heading as string | null) ?? null,
          document_id: s.document_id as string,
          segment_type: s.segment_type as string,
          speakers: (s.speakers as string[] | null) ?? null,
        });
      }
    }

    // 4) Aliases per character.
    const { data: aliasRows } = await supabase
      .from("character_aliases")
      .select("character_id, alias_text")
      .in("character_id", characterIds);
    const aliasByChar = new Map<string, string[]>();
    for (const a of aliasRows ?? []) {
      const arr = aliasByChar.get(a.character_id as string) ?? [];
      arr.push(a.alias_text as string);
      aliasByChar.set(a.character_id as string, arr);
    }

    // 5) Group candidates by resolved character.
    const candsByChar = new Map<
      string,
      {
        candidate_ids: string[];
        payload_names: Set<string>;
        payload_importances: Set<string>;
        source_document_ids: Set<string>;
      }
    >();
    for (const c of promotedRows) {
      const ref = c.promoted_ref as { id: string };
      const bucket = candsByChar.get(ref.id) ?? {
        candidate_ids: [],
        payload_names: new Set<string>(),
        payload_importances: new Set<string>(),
        source_document_ids: new Set<string>(),
      };
      bucket.candidate_ids.push(c.id);
      const payload = (c.proposed_payload ?? {}) as {
        name?: string;
        importance?: string;
      };
      if (payload.name?.trim()) bucket.payload_names.add(payload.name.trim());
      if (payload.importance?.trim())
        bucket.payload_importances.add(payload.importance.trim());
      if (c.document_id) bucket.source_document_ids.add(c.document_id);
      candsByChar.set(ref.id, bucket);
    }

    // 6) Compose entries.
    const entries: BibleEntry[] = [];
    const documentIdSet = new Set<string>();

    for (const charId of characterIds) {
      const ch = charById.get(charId);
      if (!ch) continue; // filtered by project/quarantine
      const bucket = candsByChar.get(charId);
      if (!bucket) continue;

      const charEvidence = (evRows ?? []).filter((e) =>
        bucket.candidate_ids.includes(e.candidate_id as string),
      );

      // First appearance = lowest sequence across cited segments.
      let firstSeg: {
        document_id: string;
        segment_id: string;
        sequence: number;
        heading: string | null;
      } | null = null;
      for (const ev of charEvidence) {
        const seg = segById.get(ev.segment_id as string);
        if (!seg) continue;
        if (!firstSeg || seg.sequence < firstSeg.sequence) {
          firstSeg = {
            document_id: seg.document_id,
            segment_id: seg.id,
            sequence: seg.sequence,
            heading: seg.heading,
          };
        }
      }

      // Speaking vs mention counts (deduped by segment).
      const speakingSegs = new Set<string>();
      const mentionSegs = new Set<string>();
      const nameKey = ch.name?.toString().trim().toUpperCase() ?? "";
      for (const ev of charEvidence) {
        const seg = segById.get(ev.segment_id as string);
        if (!seg) continue;
        documentIdSet.add(seg.document_id);
        bucket.source_document_ids.add(seg.document_id);
        const speaks = (seg.speakers ?? []).some(
          (s) => s.trim().toUpperCase() === nameKey,
        );
        if (speaks) speakingSegs.add(seg.id);
        else mentionSegs.add(seg.id);
      }

      // Top evidence: highest-confidence, deduped by excerpt, capped at 5.
      const seenExcerpts = new Set<string>();
      const topEvidence = [...charEvidence]
        .sort(
          (a, b) => Number(b.confidence ?? 0) - Number(a.confidence ?? 0),
        )
        .filter((e) => {
          const key = (e.excerpt as string).trim();
          if (seenExcerpts.has(key)) return false;
          seenExcerpts.add(key);
          return true;
        })
        .slice(0, 5)
        .map((e) => {
          const seg = segById.get(e.segment_id as string);
          return {
            segment_id: e.segment_id as string,
            excerpt: e.excerpt as string,
            confidence: Number(e.confidence ?? 0),
            document_id: seg?.document_id ?? null,
          };
        });

      const aliasSet = new Set<string>(aliasByChar.get(charId) ?? []);
      for (const n of bucket.payload_names) {
        if (n.toUpperCase() !== nameKey) aliasSet.add(n);
      }

      entries.push({
        character_id: charId,
        source: "imported",
        name: (ch.name as string) ?? "Unknown",
        importance:
          (ch.importance as string | null) ??
          [...bucket.payload_importances][0] ??
          null,
        aliases: [...aliasSet].sort((a, b) => a.localeCompare(b)),
        candidate_ids: bucket.candidate_ids,
        source_document_ids: [...bucket.source_document_ids],
        first_appearance: firstSeg,
        speaking_segments: speakingSegs.size,
        mention_segments: mentionSegs.size,
        top_evidence: topEvidence,
      });
    }

    // 6b) Manual characters — every non-quarantined character in the project
    //     not already covered by a promoted candidate.
    const importedIds = new Set(entries.map((e) => e.character_id));
    const { data: allProjChars, error: apErr } = await supabase
      .from("characters")
      .select("id, name, importance")
      .eq("project_id", data.project_id)
      .is("quarantined_at", null);
    if (apErr) throw new Error(apErr.message);
    for (const ch of allProjChars ?? []) {
      const id = ch.id as string;
      if (importedIds.has(id)) continue;
      const aliases = aliasByChar.get(id) ?? [];
      entries.push({
        character_id: id,
        source: "manual",
        name: (ch.name as string) ?? "Unknown",
        importance: (ch.importance as string | null) ?? null,
        aliases: [...aliases].sort((a, b) => a.localeCompare(b)),
        candidate_ids: [],
        source_document_ids: [],
        first_appearance: null,
        speaking_segments: 0,
        mention_segments: 0,
        top_evidence: [],
      });
    }

    // Sort: leads first (speaking segments desc), then alpha.
    entries.sort((a, b) => {
      if (b.speaking_segments !== a.speaking_segments)
        return b.speaking_segments - a.speaking_segments;
      return a.name.localeCompare(b.name);
    });

    // 7) Next version + insert.
    const { data: latest } = await supabase
      .from("character_bibles")
      .select("version")
      .eq("universe_id", data.universe_id)
      .eq("project_id", data.project_id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextVersion = (latest?.version ?? 0) + 1;

    const summary =
      data.summary?.trim() ||
      `Auto-generated from ${entries.length} resolved character${
        entries.length === 1 ? "" : "s"
      } across ${documentIdSet.size} source document${
        documentIdSet.size === 1 ? "" : "s"
      }.`;

    const { data: bible, error: bErr } = await supabase
      .from("character_bibles")
      .insert({
        universe_id: data.universe_id,
        project_id: data.project_id,
        version: nextVersion,
        summary,
        source_document_ids: [...documentIdSet],
        entries: entries as never,
        generated_by: userId,
      })
      .select("id, version, created_at")
      .single();
    if (bErr || !bible)
      throw new Error(bErr?.message ?? "Failed to persist character bible");

    return {
      bible_id: bible.id as string,
      version: bible.version as number,
      created_at: bible.created_at as string,
      summary,
      entry_count: entries.length,
      source_document_ids: [...documentIdSet],
      entries,
      skipped: false,
    };
  });

export const listCharacterBibles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        universe_id: z.string().uuid(),
        project_id: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("character_bibles")
      .select(
        "id, version, summary, source_document_ids, entries, generated_by, created_at",
      )
      .eq("universe_id", data.universe_id)
      .eq("project_id", data.project_id)
      .order("version", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getLatestCharacterBible = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        universe_id: z.string().uuid(),
        project_id: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("character_bibles")
      .select(
        "id, version, summary, source_document_ids, entries, generated_by, created_at",
      )
      .eq("universe_id", data.universe_id)
      .eq("project_id", data.project_id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row ?? null;
  });
