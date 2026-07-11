// Pass 2 — Detected Characters Inbox server fns.
// Candidates are persisted; parser never writes to public.characters directly.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { tallyCharacters, normalizeCharacterName, type Block } from "@/lib/editor/manuscriptAnalyzer";

const StatusSchema = z.enum(["pending", "ignored", "rejected"]);

/**
 * Sync detected speakers from script_blocks into character_candidates.
 * - Never touches public.characters.
 * - Upserts pending rows on (project_id, normalized_name).
 * - Refreshes counts + last_seen_at for known pending rows.
 * - Leaves accepted / ignored / rejected candidates alone.
 */
export const syncCharacterCandidates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { projectId: string }) =>
    z.object({ projectId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: blocks } = await supabase
      .from("script_blocks")
      .select("id,block_type,content,order_index,metadata")
      .eq("project_id", data.projectId)
      .order("order_index");

    const tallies = tallyCharacters((blocks ?? []) as Block[]);

    // Map: normalized -> aggregate
    const agg = new Map<
      string,
      { detected: string; normalized: string; blockIds: string[]; sceneCount: number; lineCount: number }
    >();
    // walk blocks once to collect source_block_ids per speaker + scene count
    const scenes = new Map<string, Set<number>>();
    const sortedBlocks = [...((blocks ?? []) as Block[])].sort((a, b) => a.order_index - b.order_index);
    let sceneIdx = -1;
    let lastSpeaker: string | null = null;
    for (const b of sortedBlocks) {
      if (b.block_type === "scene_heading") {
        sceneIdx++;
        lastSpeaker = null;
        continue;
      }
      if (b.block_type === "character") {
        const norm = normalizeCharacterName(b.content);
        if (!norm) { lastSpeaker = null; continue; }
        lastSpeaker = norm;
        const bucket = agg.get(norm) ?? {
          detected: b.content.trim(),
          normalized: norm,
          blockIds: [] as string[],
          sceneCount: 0,
          lineCount: 0,
        };
        if (bucket.blockIds.length < 50) bucket.blockIds.push(b.id);
        agg.set(norm, bucket);
        if (sceneIdx >= 0) {
          const s = scenes.get(norm) ?? new Set<number>();
          s.add(sceneIdx);
          scenes.set(norm, s);
        }
      } else if (b.block_type === "dialogue" && lastSpeaker) {
        const bucket = agg.get(lastSpeaker);
        if (bucket) bucket.lineCount += 1;
      }
    }
    // Keep only speakers that spoke at least once (mirrors tallyCharacters)
    for (const t of tallies) {
      const b = agg.get(t.name);
      if (b) b.lineCount = Math.max(b.lineCount, t.lineCount);
    }
    for (const [k, v] of agg) if (v.lineCount === 0) agg.delete(k);

    // Existing characters (non-quarantined) — skip candidates that already match.
    const { data: existingChars } = await supabase
      .from("characters")
      .select("id,name")
      .eq("project_id", data.projectId)
      .is("quarantined_at", null);
    const existingNormalized = new Set(
      (existingChars ?? []).map((c: any) => normalizeCharacterName(c.name || "")).filter(Boolean),
    );

    // Existing candidates
    const { data: existingCands } = await supabase
      .from("character_candidates")
      .select("id,normalized_name,status,dialogue_line_count,scene_count")
      .eq("project_id", data.projectId);
    const existingByNorm = new Map<string, any>();
    for (const c of (existingCands ?? []) as any[]) existingByNorm.set(c.normalized_name, c);

    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    for (const [norm, bucket] of agg) {
      if (existingNormalized.has(norm)) { skipped++; continue; }
      const existing = existingByNorm.get(norm);
      const sceneCount = scenes.get(norm)?.size ?? 0;
      if (existing) {
        if (existing.status === "pending") {
          const { error } = await supabase
            .from("character_candidates")
            .update({
              dialogue_line_count: bucket.lineCount,
              scene_count: sceneCount,
              source_block_ids: bucket.blockIds,
              last_seen_at: new Date().toISOString(),
            })
            .eq("id", existing.id);
          if (!error) updated++;
        } else {
          skipped++;
        }
        continue;
      }
      const { error } = await supabase.from("character_candidates").insert({
        project_id: data.projectId,
        detected_name: bucket.detected,
        normalized_name: norm,
        source_block_ids: bucket.blockIds,
        dialogue_line_count: bucket.lineCount,
        scene_count: sceneCount,
        candidate_type: "speaker",
        confidence: Math.min(1, 0.4 + bucket.lineCount * 0.05),
      });
      if (!error) inserted++;
    }

    return { inserted, updated, skipped, total: agg.size };
  });

export const setCandidateStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { candidateId: string; status: "pending" | "ignored" | "rejected" }) =>
    z.object({ candidateId: z.string().uuid(), status: StatusSchema }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("character_candidates")
      .update({ status: data.status, updated_at: new Date().toISOString() })
      .eq("id", data.candidateId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const acceptCandidate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    candidateId: string;
    overrides?: { name?: string; importance?: string; story_function?: string };
  }) =>
    z.object({
      candidateId: z.string().uuid(),
      overrides: z.object({
        name: z.string().optional(),
        importance: z.string().optional(),
        story_function: z.string().optional(),
      }).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: id, error } = await context.supabase.rpc("accept_character_candidate", {
      _candidate_id: data.candidateId,
      _overrides: data.overrides ?? {},
    });
    if (error) throw new Error(error.message);
    return { characterId: id as string };
  });
