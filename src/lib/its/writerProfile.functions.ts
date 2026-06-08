import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type SkillFields = {
  formatting_skill_score: number;
  scene_craft_score: number;
  dialogue_score: number;
  visual_writing_score: number;
  character_voice_score: number;
  ai_dependence_score: number;
  confidence_score: number;
};

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export const getWriterProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("writer_profiles")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data) return data;

    // Bootstrap a default profile row (idempotent — handles parallel callers).
    const { error: insErr } = await context.supabase
      .from("writer_profiles")
      .upsert({ user_id: context.userId }, { onConflict: "user_id", ignoreDuplicates: true });
    if (insErr) throw new Error(insErr.message);
    const { data: created, error: reErr } = await context.supabase
      .from("writer_profiles")
      .select("*")
      .eq("user_id", context.userId)
      .single();
    if (reErr) throw new Error(reErr.message);
    return created;
  });

/**
 * Aggregates the last N events into the writer's profile skill scores.
 * Stateless per event, stateful in aggregate (per PfHU doctrine).
 */
export const aggregateWriterProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: events, error } = await context.supabase
      .from("writing_events")
      .select("event_type, context, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(2000);
    if (error) throw new Error(error.message);

    let blocks = 0;
    let formatErrors = 0;
    let scenesWithTurn = 0;
    let scenesTotal = 0;
    let aiAccepts = 0;
    let aiRejects = 0;
    let aiRequests = 0;
    let dialogueBlocks = 0;
    let actionBlocks = 0;
    let visualSignals = 0;

    for (const e of events ?? []) {
      const ctx = (e.context ?? {}) as Record<string, unknown>;
      switch (e.event_type) {
        case "block_created":
          blocks++;
          if (ctx.block_type === "dialogue") dialogueBlocks++;
          if (ctx.block_type === "action") actionBlocks++;
          if (ctx.visual === true) visualSignals++;
          break;
        case "format_error":
          formatErrors++;
          break;
        case "scene_created":
          scenesTotal++;
          if (ctx.has_turn === true) scenesWithTurn++;
          break;
        case "ai_request":
          aiRequests++;
          break;
        case "ai_accepted":
          aiAccepts++;
          break;
        case "ai_rejected":
          aiRejects++;
          break;
      }
    }

    const formatting = clamp(100 - (blocks > 0 ? (formatErrors / blocks) * 500 : 0));
    const sceneCraft = clamp(scenesTotal > 0 ? (scenesWithTurn / scenesTotal) * 100 : 50);
    const dialogue = clamp(40 + (dialogueBlocks > 0 ? Math.min(60, dialogueBlocks * 2) : 0));
    const visual = clamp(40 + (actionBlocks > 0 ? (visualSignals / actionBlocks) * 60 : 0));
    const characterVoice = clamp(50 + Math.min(40, dialogueBlocks / 4));
    const aiTotal = aiAccepts + aiRejects;
    const aiDependence = clamp(aiTotal > 0 ? (aiAccepts / aiTotal) * 100 : 30);
    const confidence = clamp(50 + Math.min(40, blocks / 20) - Math.min(20, formatErrors));

    const update: SkillFields & { last_aggregated_at: string } = {
      formatting_skill_score: formatting,
      scene_craft_score: sceneCraft,
      dialogue_score: dialogue,
      visual_writing_score: visual,
      character_voice_score: characterVoice,
      ai_dependence_score: aiDependence,
      confidence_score: confidence,
      last_aggregated_at: new Date().toISOString(),
    };

    const { data: existing } = await context.supabase
      .from("writer_profiles")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();

    if (existing) {
      const { data: updated, error: uErr } = await context.supabase
        .from("writer_profiles")
        .update(update)
        .eq("user_id", context.userId)
        .select()
        .single();
      if (uErr) throw new Error(uErr.message);
      return updated;
    }
    const { data: created, error: cErr } = await context.supabase
      .from("writer_profiles")
      .insert({ ...update, user_id: context.userId })
      .select()
      .single();
    if (cErr) throw new Error(cErr.message);
    return created;
  });
