// Phase 2 — candidate extraction, review inbox, and identity decisions.
//
// Runs the provider-neutral entity extractor over persisted source segments,
// upserts `import_candidates` (deduped by universe+type+normalized_key+
// extractor version), and writes `import_evidence` linking each candidate
// back to the citing segment. Reviewers act via `updateCandidateStatus` and
// `recordIdentityDecision`; accepted character candidates promote into
// `characters` while preserving evidence lineage.
//
// Doctrine: docs/ITS_PfHU_Importation.md §4.4 (non-destructive identity),
// §4.5 (canon vs belief vs inference), §5.1–5.4, §6.5–6.7.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { screenplayHeuristicEntityExtractor } from "./adapters/screenplay-entity-extractor";
import type { SourceSegment } from "./contracts";

// --- helpers ---

async function assertUniverseOwner(
  supabase: {
    from: (t: string) => {
      select: (c: string) => {
        eq: (col: string, val: string) => {
          maybeSingle: () => Promise<{ data: { id: string } | null; error: unknown }>;
        };
      };
    };
  },
  universeId: string,
) {
  const { data, error } = await supabase
    .from("story_universes")
    .select("id")
    .eq("id", universeId)
    .maybeSingle();
  if (error || !data) throw new Error("Universe not found");
}

function loadSegments(rows: {
  id: string;
  document_id: string;
  segment_type: string;
  sequence: number;
  heading: string | null;
  raw_text: string;
  normalized_text: string;
  location: Record<string, unknown> | null;
  speakers: string[] | null;
  language: string | null;
  checksum: string;
}[]): SourceSegment[] {
  return rows.map((r) => ({
    id: r.id,
    documentId: r.document_id,
    segmentType: r.segment_type as SourceSegment["segmentType"],
    sequence: r.sequence,
    heading: r.heading ?? undefined,
    rawText: r.raw_text,
    normalizedText: r.normalized_text,
    location: (r.location ?? {}) as SourceSegment["location"],
    speakers: r.speakers ?? undefined,
    language: r.language ?? undefined,
    checksum: r.checksum,
  }));
}

// --- run extractor ---

export const runCandidateExtraction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        document_id: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: doc, error: dErr } = await supabase
      .from("source_documents")
      .select("id, universe_id, checksum")
      .eq("id", data.document_id)
      .single();
    if (dErr || !doc) throw new Error("Document not found");

    const { data: segRows, error: sErr } = await supabase
      .from("source_segments")
      .select(
        "id, document_id, segment_type, sequence, heading, raw_text, normalized_text, location, speakers, language, checksum",
      )
      .eq("document_id", data.document_id)
      .order("sequence", { ascending: true });
    if (sErr) throw new Error(sErr.message);

    const segments = loadSegments(
      (segRows ?? []) as unknown as Parameters<typeof loadSegments>[0],
    );
    if (segments.length === 0) {
      return { candidates_written: 0, evidence_written: 0, skipped: true };
    }

    const candidates = await screenplayHeuristicEntityExtractor.extract({
      segments,
      sourceType: "screenplay",
      types: ["character", "location", "relationship"],
    });

    // Load any existing identity decisions so we don't re-propose merges
    // the user already rejected ("kept_separate").
    const { data: decisions } = await supabase
      .from("import_identity_decisions")
      .select("subject_type, subject_key, decision, kept_separate_candidate_ids")
      .eq("universe_id", doc.universe_id);
    const keptSeparate = new Set(
      (decisions ?? [])
        .filter((d) => d.decision === "keep_separate")
        .map((d) => `${d.subject_type}:${d.subject_key}`),
    );

    // Upsert candidates.
    const candidateRows = candidates
      .filter((c) => !keptSeparate.has(`${c.candidateType}:${c.normalizedKey}`))
      .map((c) => ({
        universe_id: doc.universe_id,
        document_id: doc.id,
        candidate_type: c.candidateType,
        normalized_key: c.normalizedKey,
        proposed_payload: c.proposedPayload as never,
        confidence: c.confidence,
        extractor_adapter: screenplayHeuristicEntityExtractor.adapter,
        extractor_version: screenplayHeuristicEntityExtractor.version,
        created_by: userId,
        status: "pending",
      }));

    if (candidateRows.length === 0) {
      return { candidates_written: 0, evidence_written: 0, skipped: false };
    }

    const { data: upserted, error: upErr } = await supabase
      .from("import_candidates")
      .upsert(candidateRows, {
        onConflict:
          "universe_id,candidate_type,normalized_key,extractor_adapter,extractor_version",
      })
      .select("id, candidate_type, normalized_key");
    if (upErr) throw new Error(upErr.message);

    // Key by (type, normalizedKey) → id so we can attach evidence.
    const idByKey = new Map<string, string>();
    for (const row of upserted ?? []) {
      idByKey.set(`${row.candidate_type}:${row.normalized_key}`, row.id);
    }

    const evidenceRows: {
      candidate_id: string;
      segment_id: string;
      universe_id: string;
      excerpt: string;
      evidence_type: string;
      confidence: number;
      direct_or_inferred: string;
      location_hint: string | null;
    }[] = [];
    for (const c of candidates) {
      const cid = idByKey.get(`${c.candidateType}:${c.normalizedKey}`);
      if (!cid) continue;
      for (const e of c.evidence) {
        evidenceRows.push({
          candidate_id: cid,
          segment_id: e.segmentId,
          universe_id: doc.universe_id,
          excerpt: e.excerpt.slice(0, 1000),
          evidence_type: e.evidenceType,
          confidence: e.confidence,
          direct_or_inferred: e.directOrInferred,
          location_hint: e.locationHint ?? null,
        });
      }
    }

    if (evidenceRows.length > 0) {
      const { error: evErr } = await supabase
        .from("import_evidence")
        .upsert(evidenceRows, { onConflict: "candidate_id,segment_id,excerpt" });
      if (evErr) throw new Error(evErr.message);
    }

    await supabase.from("import_extraction_runs").upsert(
      {
        document_id: doc.id,
        universe_id: doc.universe_id,
        stage: "extract",
        adapter: screenplayHeuristicEntityExtractor.adapter,
        adapter_version: screenplayHeuristicEntityExtractor.version,
        input_checksum: doc.checksum,
        status: "succeeded",
        output_summary: {
          candidates: candidateRows.length,
          evidence: evidenceRows.length,
        } as never,
      },
      { onConflict: "document_id,stage,adapter,adapter_version,input_checksum" },
    );

    return {
      candidates_written: candidateRows.length,
      evidence_written: evidenceRows.length,
      skipped: false,
    };
  });

// --- review inbox ---

export const listCandidates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        universe_id: z.string().uuid(),
        candidate_type: z.string().optional(),
        status: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("import_candidates")
      .select("*")
      .eq("universe_id", data.universe_id);
    if (data.candidate_type) q = q.eq("candidate_type", data.candidate_type);
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q
      .order("confidence", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getCandidateEvidence = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ candidate_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("import_evidence")
      .select(
        "id, segment_id, excerpt, evidence_type, confidence, direct_or_inferred, location_hint",
      )
      .eq("candidate_id", data.candidate_id)
      .order("confidence", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const updateCandidateStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        candidate_id: z.string().uuid(),
        status: z.enum(["pending", "accepted", "rejected", "merged", "kept_separate"]),
        review_notes: z.string().max(2000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("import_candidates")
      .update({
        status: data.status,
        review_notes: data.review_notes ?? null,
      })
      .eq("id", data.candidate_id)
      .select("*")
      .single();
    if (error || !row) throw new Error(error?.message ?? "Update failed");
    return row;
  });

// --- non-destructive identity decisions ---

export const recordIdentityDecision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        universe_id: z.string().uuid(),
        subject_type: z.string().min(1),
        subject_key: z.string().min(1),
        decision: z.enum(["merge", "keep_separate", "link"]),
        canonical_name: z.string().optional(),
        merged_candidate_ids: z.array(z.string().uuid()).default([]),
        kept_separate_candidate_ids: z.array(z.string().uuid()).default([]),
        reason: z.string().max(2000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Upsert the decision so extractors can honour it on future runs.
    const { data: row, error } = await supabase
      .from("import_identity_decisions")
      .upsert(
        {
          universe_id: data.universe_id,
          subject_type: data.subject_type,
          subject_key: data.subject_key,
          decision: data.decision,
          canonical_name: data.canonical_name ?? null,
          merged_candidate_ids: data.merged_candidate_ids,
          kept_separate_candidate_ids: data.kept_separate_candidate_ids,
          reason: data.reason ?? null,
          decided_by: userId,
        },
        { onConflict: "universe_id,subject_type,subject_key,decision" },
      )
      .select("*")
      .single();
    if (error || !row) throw new Error(error?.message ?? "Decision write failed");

    // Reflect the decision on affected candidates so the inbox stays honest.
    if (data.decision === "merge" && data.merged_candidate_ids.length > 0) {
      await supabase
        .from("import_candidates")
        .update({ status: "merged" })
        .in("id", data.merged_candidate_ids);
    }
    if (
      data.decision === "keep_separate" &&
      data.kept_separate_candidate_ids.length > 0
    ) {
      await supabase
        .from("import_candidates")
        .update({ status: "kept_separate" })
        .in("id", data.kept_separate_candidate_ids);
    }

    return row;
  });

// --- promote to canonical characters (screenplay) ---

export const promoteCharacterCandidate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        candidate_id: z.string().uuid(),
        project_id: z.string().uuid(),
        name_override: z.string().max(200).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: cand, error: cErr } = await supabase
      .from("import_candidates")
      .select("*")
      .eq("id", data.candidate_id)
      .single();
    if (cErr || !cand) throw new Error("Candidate not found");
    if (cand.candidate_type !== "character") {
      throw new Error("Only character candidates can be promoted here");
    }

    const payload = (cand.proposed_payload ?? {}) as {
      name?: string;
      importance?: string;
    };
    const finalName =
      data.name_override?.trim() || payload.name?.trim() || cand.normalized_key;

    // Reuse an active same-name character if present (RLS guards project).
    const { data: existing } = await supabase
      .from("characters")
      .select("id")
      .eq("project_id", data.project_id)
      .is("quarantined_at", null)
      .ilike("name", finalName)
      .maybeSingle();

    let characterId: string;
    if (existing) {
      characterId = existing.id;
    } else {
      const { data: created, error: insErr } = await supabase
        .from("characters")
        .insert({
          project_id: data.project_id,
          name: finalName,
          importance: payload.importance ?? "unassigned",
        })
        .select("id")
        .single();
      if (insErr || !created) throw new Error(insErr?.message ?? "Insert failed");
      characterId = created.id;
    }

    await supabase
      .from("import_candidates")
      .update({
        status: "accepted",
        promoted_ref: { table: "characters", id: characterId } as never,
      })
      .eq("id", data.candidate_id);

    return { character_id: characterId, candidate_id: data.candidate_id };
  });
