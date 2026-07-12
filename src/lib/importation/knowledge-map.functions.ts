// Phase 5 — ITS Knowledge Map.
//
// Turns approved candidates, world entities, and cited evidence into a
// universe-scoped graph of "knowledge nodes" (a character belief, a world
// rule, a plot thread, etc.), tracks per-writer understanding state, and
// lets reviewers wire prerequisite edges between nodes.
//
// Doctrine: docs/ITS_PfHU_Importation.md §6.9 (knowledge map), §6.10
// (writer understanding state), §Phase 5.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const CONCEPT_TYPES = [
  "character_belief",
  "character_secret",
  "character_wound",
  "character_lie",
  "world_rule",
  "world_state",
  "relationship_state",
  "plot_thread",
  "timeline_fact",
  "public_vs_private",
  "other",
] as const;

const ENTITY_KINDS = [
  "character",
  "world_event",
  "world_location",
  "world_faction",
  "world_artifact",
  "world_rule",
  "world_thread",
  "none",
] as const;

const IMPORTANCE = ["critical", "high", "normal", "low"] as const;
const STATUSES = ["active", "resolved", "retconned", "superseded"] as const;

function normalizeKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 200);
}

// --- CRUD -------------------------------------------------------------------

export const createKnowledgeNode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        universe_id: z.string().uuid(),
        concept_type: z.enum(CONCEPT_TYPES),
        entity_kind: z.enum(ENTITY_KINDS).default("none"),
        entity_ids: z.array(z.string().uuid()).default([]),
        title: z.string().min(1).max(300),
        explanation: z.string().max(4000).default(""),
        importance: z.enum(IMPORTANCE).default("normal"),
        role_relevance: z
          .array(z.string().min(1).max(40))
          .default(["writer"]),
        normalized_key: z.string().max(200).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const key = normalizeKey(data.normalized_key ?? data.title);
    const { data: row, error } = await supabase
      .from("series_knowledge_nodes")
      .upsert(
        {
          universe_id: data.universe_id,
          concept_type: data.concept_type,
          entity_kind: data.entity_kind,
          entity_ids: data.entity_ids,
          title: data.title.trim(),
          explanation: data.explanation,
          importance: data.importance,
          role_relevance: data.role_relevance,
          normalized_key: key,
          extractor: "manual",
          extractor_version: "1.0.0",
        },
        { onConflict: "universe_id,normalized_key" },
      )
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateKnowledgeNode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        title: z.string().min(1).max(300).optional(),
        explanation: z.string().max(4000).optional(),
        importance: z.enum(IMPORTANCE).optional(),
        role_relevance: z.array(z.string().min(1).max(40)).optional(),
        current_status: z.enum(STATUSES).optional(),
        entity_ids: z.array(z.string().uuid()).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { id, ...patch } = data;
    const { data: row, error } = await supabase
      .from("series_knowledge_nodes")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteKnowledgeNode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("series_knowledge_nodes")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listKnowledgeNodes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        universe_id: z.string().uuid(),
        importance: z.enum(IMPORTANCE).optional(),
        status: z.enum(STATUSES).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("series_knowledge_nodes")
      .select("*")
      .eq("universe_id", data.universe_id)
      .order("importance", { ascending: true })
      .order("created_at", { ascending: true });
    if (data.importance) q = q.eq("importance", data.importance);
    if (data.status) q = q.eq("current_status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// --- Evidence + prerequisites -----------------------------------------------

export const linkNodeEvidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        node_id: z.string().uuid(),
        evidence_id: z.string().uuid().optional(),
        segment_id: z.string().uuid().optional(),
        excerpt: z.string().max(2000).default(""),
        confidence: z.number().min(0).max(1).default(0.6),
      })
      .refine((v) => v.evidence_id || v.segment_id, {
        message: "evidence_id or segment_id required",
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("series_knowledge_node_evidence")
      .upsert(
        {
          node_id: data.node_id,
          evidence_id: data.evidence_id ?? null,
          segment_id: data.segment_id ?? null,
          excerpt: data.excerpt,
          confidence: data.confidence,
        },
        {
          onConflict: data.evidence_id
            ? "node_id,evidence_id"
            : "node_id,segment_id",
        },
      )
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listNodeEvidence = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ node_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("series_knowledge_node_evidence")
      .select("*")
      .eq("node_id", data.node_id)
      .order("confidence", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const linkPrerequisite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        node_id: z.string().uuid(),
        prerequisite_node_id: z.string().uuid(),
      })
      .refine((v) => v.node_id !== v.prerequisite_node_id, {
        message: "A node cannot be its own prerequisite",
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    // Guard against direct cycles (A→B and B→A). Longer-cycle detection is
    // left to reviewer discipline for now.
    const { data: reverse } = await supabase
      .from("series_knowledge_prerequisites")
      .select("id")
      .eq("node_id", data.prerequisite_node_id)
      .eq("prerequisite_node_id", data.node_id)
      .maybeSingle();
    if (reverse) throw new Error("PREREQ: would create a cycle");

    const { data: row, error } = await supabase
      .from("series_knowledge_prerequisites")
      .upsert(
        {
          node_id: data.node_id,
          prerequisite_node_id: data.prerequisite_node_id,
        },
        { onConflict: "node_id,prerequisite_node_id" },
      )
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const unlinkPrerequisite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("series_knowledge_prerequisites")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// --- Heuristic seeding ------------------------------------------------------
//
// Walks accepted world entities under the universe and materializes one node
// per (world_event | world_rule | world_thread) with evidence carried over
// from the source candidate. Idempotent: normalized_key collisions upsert.

export const seedKnowledgeNodesFromWorld = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ universe_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const seeded: { node_id: string; source: string; created: boolean }[] = [];

    async function upsertNode(spec: {
      concept_type: (typeof CONCEPT_TYPES)[number];
      entity_kind: (typeof ENTITY_KINDS)[number];
      entity_id: string | null;
      title: string;
      explanation: string;
      importance: (typeof IMPORTANCE)[number];
      source: string;
      candidate_id: string | null;
    }) {
      const key = normalizeKey(`${spec.entity_kind}:${spec.title}`);
      const { data: existing } = await supabase
        .from("series_knowledge_nodes")
        .select("id")
        .eq("universe_id", data.universe_id)
        .eq("normalized_key", key)
        .maybeSingle();

      const { data: row, error } = await supabase
        .from("series_knowledge_nodes")
        .upsert(
          {
            universe_id: data.universe_id,
            concept_type: spec.concept_type,
            entity_kind: spec.entity_kind,
            entity_ids: spec.entity_id ? [spec.entity_id] : [],
            title: spec.title.slice(0, 300),
            explanation: spec.explanation.slice(0, 4000),
            importance: spec.importance,
            role_relevance: ["writer", "editor"],
            normalized_key: key,
            extractor: "world-seed",
            extractor_version: "1.0.0",
          },
          { onConflict: "universe_id,normalized_key" },
        )
        .select("id")
        .single();
      if (error || !row) throw new Error(error?.message ?? "Node upsert failed");

      seeded.push({
        node_id: row.id,
        source: spec.source,
        created: !existing,
      });

      // Carry evidence forward when we can trace back to the candidate.
      if (spec.candidate_id) {
        const { data: evRows } = await supabase
          .from("import_evidence")
          .select("id, segment_id, excerpt, confidence")
          .eq("candidate_id", spec.candidate_id)
          .limit(10);
        for (const ev of evRows ?? []) {
          await supabase
            .from("series_knowledge_node_evidence")
            .upsert(
              {
                node_id: row.id,
                evidence_id: ev.id,
                segment_id: ev.segment_id,
                excerpt: ev.excerpt ?? "",
                confidence: Number(ev.confidence ?? 0.6),
              },
              { onConflict: "node_id,evidence_id" },
            );
        }
      }
    }

    const { data: events } = await supabase
      .from("world_events")
      .select("id, name, summary, candidate_id")
      .eq("universe_id", data.universe_id);
    for (const e of events ?? []) {
      await upsertNode({
        concept_type: "timeline_fact",
        entity_kind: "world_event",
        entity_id: e.id,
        title: e.name ?? "Untitled event",
        explanation: (e as { summary?: string }).summary ?? "",
        importance: "normal",
        source: "world_events",
        candidate_id: (e as { candidate_id?: string }).candidate_id ?? null,
      });
    }

    const { data: rules } = await supabase
      .from("world_rules")
      .select("id, name, statement, candidate_id")
      .eq("universe_id", data.universe_id);
    for (const r of rules ?? []) {
      await upsertNode({
        concept_type: "world_rule",
        entity_kind: "world_rule",
        entity_id: r.id,
        title: r.name ?? "World rule",
        explanation: (r as { statement?: string }).statement ?? "",
        importance: "high",
        source: "world_rules",
        candidate_id: (r as { candidate_id?: string }).candidate_id ?? null,
      });
    }

    const { data: threads } = await supabase
      .from("world_threads")
      .select("id, name, question, status, candidate_id")
      .eq("universe_id", data.universe_id);
    for (const t of threads ?? []) {
      await upsertNode({
        concept_type: "plot_thread",
        entity_kind: "world_thread",
        entity_id: t.id,
        title: t.name ?? "Open thread",
        explanation: (t as { question?: string }).question ?? "",
        importance:
          (t as { status?: string }).status === "resolved" ? "low" : "high",
        source: "world_threads",
        candidate_id: (t as { candidate_id?: string }).candidate_id ?? null,
      });
    }

    return {
      universe_id: data.universe_id,
      totals: {
        seeded: seeded.length,
        created: seeded.filter((s) => s.created).length,
        events: (events ?? []).length,
        rules: (rules ?? []).length,
        threads: (threads ?? []).length,
      },
      seeded,
    };
  });

// --- Writer understanding state --------------------------------------------

const WRITER_STATUSES = [
  "unseen",
  "introduced",
  "understood",
  "uncertain",
  "contradicted",
  "mastered",
] as const;

export const setWriterKnowledgeState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        universe_id: z.string().uuid(),
        knowledge_node_id: z.string().uuid(),
        status: z.enum(WRITER_STATUSES),
        confidence: z.number().min(0).max(1).default(0.5),
        preferred_presentation: z
          .enum([
            "evidence_first",
            "summary_first",
            "map",
            "timeline",
            "card",
          ])
          .default("evidence_first"),
        evidence_of_understanding: z.record(z.string(), z.unknown()).default({}),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("writer_knowledge_state")
      .upsert(
        {
          user_id: userId,
          universe_id: data.universe_id,
          knowledge_node_id: data.knowledge_node_id,
          status: data.status,
          confidence: data.confidence,
          preferred_presentation: data.preferred_presentation,
          evidence_of_understanding: data.evidence_of_understanding,
          last_checked_at: new Date().toISOString(),
        },
        { onConflict: "user_id,knowledge_node_id" },
      )
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const getWriterKnowledgeMap = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ universe_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: nodes, error: nErr } = await supabase
      .from("series_knowledge_nodes")
      .select("*")
      .eq("universe_id", data.universe_id)
      .order("importance", { ascending: true });
    if (nErr) throw new Error(nErr.message);

    const nodeIds = (nodes ?? []).map((n) => n.id);
    if (nodeIds.length === 0) {
      return {
        nodes: [],
        prerequisites: [],
        writer_state: [],
        summary: { total: 0, unseen: 0, understood: 0, mastered: 0 },
      };
    }

    const { data: prereqs } = await supabase
      .from("series_knowledge_prerequisites")
      .select("id, node_id, prerequisite_node_id")
      .in("node_id", nodeIds);

    const { data: state } = await supabase
      .from("writer_knowledge_state")
      .select("*")
      .eq("user_id", userId)
      .in("knowledge_node_id", nodeIds);

    const stateByNode = new Map(
      (state ?? []).map((s) => [s.knowledge_node_id, s]),
    );
    let unseen = 0;
    let understood = 0;
    let mastered = 0;
    for (const n of nodes ?? []) {
      const s = stateByNode.get(n.id);
      if (!s || s.status === "unseen") unseen++;
      else if (s.status === "mastered") mastered++;
      else if (s.status === "understood") understood++;
    }

    return {
      nodes: nodes ?? [],
      prerequisites: prereqs ?? [],
      writer_state: state ?? [],
      summary: {
        total: (nodes ?? []).length,
        unseen,
        understood,
        mastered,
      },
    };
  });
