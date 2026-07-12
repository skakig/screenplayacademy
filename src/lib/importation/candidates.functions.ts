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
import { screenplayHeuristicWorldExtractor } from "./adapters/screenplay-world-extractor";
import type { CandidateType, EntityExtractor, ImportCandidate, SourceSegment } from "./contracts";

// --- helpers ---

// (universe ownership is enforced by RLS on every table we touch)



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

    // Phase 2 + Phase 3 extractors run together; each records its own
    // extraction_runs row so re-ingest is idempotent per adapter+version.
    const extractors: { extractor: EntityExtractor; types: CandidateType[] }[] = [
      {
        extractor: screenplayHeuristicEntityExtractor,
        types: ["character", "location", "relationship"],
      },
      {
        extractor: screenplayHeuristicWorldExtractor,
        types: ["event", "artifact", "thread"],
      },
    ];

    let totalCandidates = 0;
    let totalEvidence = 0;

    for (const { extractor, types } of extractors) {
      const candidates = await extractor.extract({
        segments,
        sourceType: "screenplay",
        types: [...types],
      });

      const candidateRows = candidates
        .filter((c) => !keptSeparate.has(`${c.candidateType}:${c.normalizedKey}`))
        .map((c) => ({
          universe_id: doc.universe_id,
          document_id: doc.id,
          candidate_type: c.candidateType,
          normalized_key: c.normalizedKey,
          proposed_payload: c.proposedPayload as never,
          confidence: c.confidence,
          extractor_adapter: extractor.adapter,
          extractor_version: extractor.version,
          created_by: userId,
          status: "pending",
        }));

      if (candidateRows.length === 0) {
        await supabase.from("import_extraction_runs").upsert(
          {
            document_id: doc.id,
            universe_id: doc.universe_id,
            stage: "extract",
            adapter: extractor.adapter,
            adapter_version: extractor.version,
            input_checksum: doc.checksum,
            status: "succeeded",
            output_summary: { candidates: 0, evidence: 0 } as never,
          },
          { onConflict: "document_id,stage,adapter,adapter_version,input_checksum" },
        );
        continue;
      }

      const { data: upserted, error: upErr } = await supabase
        .from("import_candidates")
        .upsert(candidateRows, {
          onConflict:
            "universe_id,candidate_type,normalized_key,extractor_adapter,extractor_version",
        })
        .select("id, candidate_type, normalized_key");
      if (upErr) throw new Error(upErr.message);

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
          adapter: extractor.adapter,
          adapter_version: extractor.version,
          input_checksum: doc.checksum,
          status: "succeeded",
          output_summary: {
            candidates: candidateRows.length,
            evidence: evidenceRows.length,
          } as never,
        },
        { onConflict: "document_id,stage,adapter,adapter_version,input_checksum" },
      );

      totalCandidates += candidateRows.length;
      totalEvidence += evidenceRows.length;
    }

    return {
      candidates_written: totalCandidates,
      evidence_written: totalEvidence,
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

// --- promote to world / story entities (Phase 3) ---



export const promoteLocationCandidate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        candidate_id: z.string().uuid(),
        name_override: z.string().max(200).optional(),
        description: z.string().max(4000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: cand, error } = await supabase
      .from("import_candidates")
      .select("*")
      .eq("id", data.candidate_id)
      .single();
    if (error || !cand) throw new Error("Candidate not found");
    if (cand.candidate_type !== "location") {
      throw new Error("Not a location candidate");
    }
    const payload = (cand.proposed_payload ?? {}) as Record<string, unknown>;
    const name =
      data.name_override?.trim() || (payload.name as string) || cand.normalized_key;
    const { data: row, error: insErr } = await supabase
      .from("world_locations")
      .upsert(
        {
          universe_id: cand.universe_id,
          candidate_id: cand.id,
          name,
          normalized_key: cand.normalized_key,
          int_ext: (payload.int_ext as string) ?? null,
          description: data.description ?? null,
        },
        { onConflict: "universe_id,normalized_key" },
      )
      .select("id")
      .single();
    if (insErr || !row) throw new Error(insErr?.message ?? "Insert failed");
    await supabase
      .from("import_candidates")
      .update({
        status: "accepted",
        promoted_ref: { table: "world_locations", id: row.id } as never,
      })
      .eq("id", cand.id);
    return { location_id: row.id, candidate_id: cand.id };
  });

export const promoteFactionCandidate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        candidate_id: z.string().uuid(),
        name_override: z.string().max(200).optional(),
        kind: z.string().max(120).optional(),
        description: z.string().max(4000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: cand, error } = await supabase
      .from("import_candidates")
      .select("*")
      .eq("id", data.candidate_id)
      .single();
    if (error || !cand) throw new Error("Candidate not found");
    if (cand.candidate_type !== "faction") {
      throw new Error("Not a faction candidate");
    }
    const payload = (cand.proposed_payload ?? {}) as Record<string, unknown>;
    const name =
      data.name_override?.trim() || (payload.name as string) || cand.normalized_key;
    const { data: row, error: insErr } = await supabase
      .from("world_factions")
      .upsert(
        {
          universe_id: cand.universe_id,
          candidate_id: cand.id,
          name,
          normalized_key: cand.normalized_key,
          kind: data.kind ?? (typeof payload.kind === "string" && payload.kind.trim() ? payload.kind.trim() : null),
          description: data.description ?? null,
        },
        { onConflict: "universe_id,normalized_key" },
      )
      .select("id")
      .single();
    if (insErr || !row) throw new Error(insErr?.message ?? "Insert failed");
    await supabase
      .from("import_candidates")
      .update({
        status: "accepted",
        promoted_ref: { table: "world_factions", id: row.id } as never,
      })
      .eq("id", cand.id);
    return { faction_id: row.id, candidate_id: cand.id };
  });

export const promoteEventCandidate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        candidate_id: z.string().uuid(),
        name_override: z.string().max(200).optional(),
        summary: z.string().max(4000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: cand, error } = await supabase
      .from("import_candidates")
      .select("*")
      .eq("id", data.candidate_id)
      .single();
    if (error || !cand) throw new Error("Candidate not found");
    if (cand.candidate_type !== "event") {
      throw new Error("Not an event candidate");
    }
    const payload = (cand.proposed_payload ?? {}) as Record<string, unknown>;
    const name =
      data.name_override?.trim() || (payload.name as string) || cand.normalized_key;
    const sequence =
      typeof payload.sequence === "number" ? (payload.sequence as number) : null;

    // Resolve location by normalized key if the extractor tagged one.
    let locationId: string | null = null;
    const locKey = typeof payload.location_key === "string" && payload.location_key.trim() ? payload.location_key.trim() : null;
    if (locKey) {
      const { data: loc } = await supabase
        .from("world_locations")
        .select("id")
        .eq("universe_id", cand.universe_id)
        .eq("normalized_key", locKey)
        .maybeSingle();
      if (loc) locationId = loc.id;
    }

    const { data: row, error: insErr } = await supabase
      .from("world_events")
      .upsert(
        {
          universe_id: cand.universe_id,
          candidate_id: cand.id,
          name,
          normalized_key: cand.normalized_key,
          summary: data.summary ?? null,
          sequence,
          location_id: locationId,
        },
        { onConflict: "universe_id,normalized_key" },
      )
      .select("id")
      .single();
    if (insErr || !row) throw new Error(insErr?.message ?? "Insert failed");

    // Also mirror as a timeline entry so the ordered view stays in sync.
    if (sequence !== null) {
      await supabase.from("world_timeline_entries").insert({
        universe_id: cand.universe_id,
        event_id: row.id,
        candidate_id: cand.id,
        label: name,
        sequence,
        when_hint: typeof payload.time === "string" && payload.time.trim() ? payload.time.trim() : null,
      });
    }

    await supabase
      .from("import_candidates")
      .update({
        status: "accepted",
        promoted_ref: { table: "world_events", id: row.id } as never,
      })
      .eq("id", cand.id);
    return { event_id: row.id, candidate_id: cand.id };
  });

export const promoteArtifactCandidate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        candidate_id: z.string().uuid(),
        name_override: z.string().max(200).optional(),
        description: z.string().max(4000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: cand, error } = await supabase
      .from("import_candidates")
      .select("*")
      .eq("id", data.candidate_id)
      .single();
    if (error || !cand) throw new Error("Candidate not found");
    if (cand.candidate_type !== "artifact") {
      throw new Error("Not an artifact candidate");
    }
    const payload = (cand.proposed_payload ?? {}) as Record<string, unknown>;
    const name =
      data.name_override?.trim() || (payload.name as string) || cand.normalized_key;
    const { data: row, error: insErr } = await supabase
      .from("world_artifacts")
      .upsert(
        {
          universe_id: cand.universe_id,
          candidate_id: cand.id,
          name,
          normalized_key: cand.normalized_key,
          description: data.description ?? null,
        },
        { onConflict: "universe_id,normalized_key" },
      )
      .select("id")
      .single();
    if (insErr || !row) throw new Error(insErr?.message ?? "Insert failed");
    await supabase
      .from("import_candidates")
      .update({
        status: "accepted",
        promoted_ref: { table: "world_artifacts", id: row.id } as never,
      })
      .eq("id", cand.id);
    return { artifact_id: row.id, candidate_id: cand.id };
  });

export const promoteRuleCandidate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        candidate_id: z.string().uuid(),
        name_override: z.string().max(200).optional(),
        statement: z.string().min(1).max(4000),
        scope: z.string().max(200).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: cand, error } = await supabase
      .from("import_candidates")
      .select("*")
      .eq("id", data.candidate_id)
      .single();
    if (error || !cand) throw new Error("Candidate not found");
    if (cand.candidate_type !== "rule") {
      throw new Error("Not a rule candidate");
    }
    const payload = (cand.proposed_payload ?? {}) as Record<string, unknown>;
    const name =
      data.name_override?.trim() || (payload.name as string) || cand.normalized_key;
    const { data: row, error: insErr } = await supabase
      .from("world_rules")
      .upsert(
        {
          universe_id: cand.universe_id,
          candidate_id: cand.id,
          name,
          normalized_key: cand.normalized_key,
          statement: data.statement,
          scope: data.scope ?? null,
        },
        { onConflict: "universe_id,normalized_key" },
      )
      .select("id")
      .single();
    if (insErr || !row) throw new Error(insErr?.message ?? "Insert failed");
    await supabase
      .from("import_candidates")
      .update({
        status: "accepted",
        promoted_ref: { table: "world_rules", id: row.id } as never,
      })
      .eq("id", cand.id);
    return { rule_id: row.id, candidate_id: cand.id };
  });

export const promoteThreadCandidate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        candidate_id: z.string().uuid(),
        name_override: z.string().max(200).optional(),
        question_override: z.string().max(2000).optional(),
        status: z.enum(["open", "resolved", "abandoned"]).default("open"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: cand, error } = await supabase
      .from("import_candidates")
      .select("*")
      .eq("id", data.candidate_id)
      .single();
    if (error || !cand) throw new Error("Candidate not found");
    if (cand.candidate_type !== "thread") {
      throw new Error("Not a thread candidate");
    }
    const payload = (cand.proposed_payload ?? {}) as Record<string, unknown>;
    const name =
      data.name_override?.trim() ||
      (payload.name as string) ||
      cand.normalized_key.slice(0, 200);
    const question =
      data.question_override?.trim() ||
      (payload.question as string) ||
      cand.normalized_key;
    const { data: row, error: insErr } = await supabase
      .from("world_threads")
      .upsert(
        {
          universe_id: cand.universe_id,
          candidate_id: cand.id,
          name,
          normalized_key: cand.normalized_key,
          question,
          status: data.status,
        },
        { onConflict: "universe_id,normalized_key" },
      )
      .select("id")
      .single();
    if (insErr || !row) throw new Error(insErr?.message ?? "Insert failed");
    await supabase
      .from("import_candidates")
      .update({
        status: "accepted",
        promoted_ref: { table: "world_threads", id: row.id } as never,
      })
      .eq("id", cand.id);
    return { thread_id: row.id, candidate_id: cand.id };
  });

// --- Phase 4: batch promote approved character candidates + resolve per-segment map ---
//
// Walks every character candidate for a document that the reviewer has marked
// approved (status in {accepted, approved}), promotes each into a stable
// `characters` row (reusing an active same-name character when present so the
// identity stays stable across re-imports), then joins evidence + segment
// speakers to emit a resolved entity map keyed by segment_id. Idempotent:
// re-running against the same document yields the same character ids and the
// same segment mapping.
export const promoteApprovedCharactersForDocument = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        document_id: z.string().uuid(),
        project_id: z.string().uuid(),
        include_pending: z.boolean().default(false),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: doc, error: dErr } = await supabase
      .from("source_documents")
      .select("id, universe_id")
      .eq("id", data.document_id)
      .single();
    if (dErr || !doc) throw new Error("Document not found");

    const statuses = data.include_pending
      ? ["pending", "accepted", "approved"]
      : ["accepted", "approved"];

    const { data: cands, error: cErr } = await supabase
      .from("import_candidates")
      .select("id, normalized_key, proposed_payload, promoted_ref, status")
      .eq("universe_id", doc.universe_id)
      .eq("candidate_type", "character")
      .in("status", statuses);
    if (cErr) throw new Error(cErr.message);

    type Payload = { name?: string; importance?: string };

    const promoted: {
      candidate_id: string;
      character_id: string;
      name: string;
      created: boolean;
      normalized_key: string;
    }[] = [];
    const candidateToCharacter = new Map<string, string>();
    const nameKeyToCharacter = new Map<string, { id: string; name: string }>();

    for (const cand of cands ?? []) {
      const payload = (cand.proposed_payload ?? {}) as Payload;
      const finalName =
        (payload.name && payload.name.trim()) || cand.normalized_key;
      const key = finalName.trim().toUpperCase();

      // Fast path: candidate was already promoted previously.
      const existingRef = cand.promoted_ref as
        | { table?: string; id?: string }
        | null;
      if (existingRef?.table === "characters" && existingRef.id) {
        candidateToCharacter.set(cand.id, existingRef.id);
        nameKeyToCharacter.set(key, { id: existingRef.id, name: finalName });
        promoted.push({
          candidate_id: cand.id,
          character_id: existingRef.id,
          name: finalName,
          created: false,
          normalized_key: cand.normalized_key,
        });
        continue;
      }

      // Reuse in-batch by normalized name (two candidates for the same person).
      let characterId = nameKeyToCharacter.get(key)?.id ?? null;
      let created = false;

      if (!characterId) {
        const { data: existing } = await supabase
          .from("characters")
          .select("id, name")
          .eq("project_id", data.project_id)
          .is("quarantined_at", null)
          .ilike("name", finalName)
          .maybeSingle();
        if (existing) {
          characterId = existing.id;
        } else {
          const { data: ins, error: insErr } = await supabase
            .from("characters")
            .insert({
              project_id: data.project_id,
              name: finalName,
              importance: payload.importance ?? "unassigned",
            })
            .select("id")
            .single();
          if (insErr || !ins)
            throw new Error(insErr?.message ?? "Character insert failed");
          characterId = ins.id;
          created = true;
        }
      }

      await supabase
        .from("import_candidates")
        .update({
          status: "accepted",
          promoted_ref: { table: "characters", id: characterId } as never,
        })
        .eq("id", cand.id);

      candidateToCharacter.set(cand.id, characterId);
      nameKeyToCharacter.set(key, { id: characterId, name: finalName });
      promoted.push({
        candidate_id: cand.id,
        character_id: characterId,
        name: finalName,
        created,
        normalized_key: cand.normalized_key,
      });
    }

    // Load segments for the document.
    const { data: segRows, error: sErr } = await supabase
      .from("source_segments")
      .select("id, sequence, segment_type, speakers")
      .eq("document_id", data.document_id)
      .order("sequence", { ascending: true });
    if (sErr) throw new Error(sErr.message);

    // Load evidence rows for the promoted candidates (mentions in segments).
    const promotedCandIds = Array.from(candidateToCharacter.keys());
    const evidenceBySegment = new Map<
      string,
      { candidate_id: string; excerpt: string; confidence: number }[]
    >();
    if (promotedCandIds.length > 0) {
      const { data: evRows, error: eErr } = await supabase
        .from("import_evidence")
        .select("candidate_id, segment_id, excerpt, confidence")
        .in("candidate_id", promotedCandIds);
      if (eErr) throw new Error(eErr.message);
      for (const ev of evRows ?? []) {
        const arr = evidenceBySegment.get(ev.segment_id) ?? [];
        arr.push({
          candidate_id: ev.candidate_id,
          excerpt: ev.excerpt,
          confidence: Number(ev.confidence),
        });
        evidenceBySegment.set(ev.segment_id, arr);
      }
    }

    const segment_map = (segRows ?? []).map((seg) => {
      const speakers = (seg.speakers ?? []) as string[];
      const speakerKeys = new Set(
        speakers.map((s) => s.trim().toUpperCase()).filter(Boolean),
      );

      const entities = new Map<
        string,
        {
          character_id: string;
          name: string;
          candidate_ids: string[];
          role: "speaker" | "mention";
          confidence: number;
        }
      >();

      // Speaker resolution from the segment's own speakers[].
      for (const sk of speakerKeys) {
        const hit = nameKeyToCharacter.get(sk);
        if (!hit) continue;
        const prev = entities.get(hit.id);
        entities.set(hit.id, {
          character_id: hit.id,
          name: hit.name,
          candidate_ids: prev?.candidate_ids ?? [],
          role: "speaker",
          confidence: Math.max(prev?.confidence ?? 0, 0.95),
        });
      }

      // Mentions from evidence rows.
      for (const ev of evidenceBySegment.get(seg.id) ?? []) {
        const charId = candidateToCharacter.get(ev.candidate_id);
        if (!charId) continue;
        const prev = entities.get(charId);
        const nextRole: "speaker" | "mention" = prev?.role === "speaker"
          ? "speaker"
          : "mention";
        const nextCandidates = prev
          ? Array.from(new Set([...prev.candidate_ids, ev.candidate_id]))
          : [ev.candidate_id];
        entities.set(charId, {
          character_id: charId,
          name: prev?.name ?? nameKeyToCharacter.get(
            [...nameKeyToCharacter.entries()].find(
              ([, v]) => v.id === charId,
            )?.[0] ?? "",
          )?.name ?? "Unknown",
          candidate_ids: nextCandidates,
          role: nextRole,
          confidence: Math.max(prev?.confidence ?? 0, ev.confidence),
        });
      }

      return {
        segment_id: seg.id,
        sequence: seg.sequence,
        segment_type: seg.segment_type,
        characters: Array.from(entities.values()).sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
      };
    });

    return {
      document_id: data.document_id,
      universe_id: doc.universe_id,
      promoted,
      segment_map,
      totals: {
        candidates_processed: promoted.length,
        characters_created: promoted.filter((p) => p.created).length,
        segments: segment_map.length,
        segments_with_entities: segment_map.filter(
          (s) => s.characters.length > 0,
        ).length,
      },
    };
  });
