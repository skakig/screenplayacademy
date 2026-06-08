import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const listCoachRecommendations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ project_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("coach_recommendations")
      .select("*")
      .eq("project_id", data.project_id)
      .in("status", ["pending", "shown"])
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const resolveCoachRecommendation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(["shown", "applied", "dismissed"]),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const now = new Date().toISOString();
    const update =
      data.status === "shown"
        ? { status: data.status, shown_at: now }
        : { status: data.status, resolved_at: now };
    const { error } = await context.supabase
      .from("coach_recommendations")
      .update(update)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Deterministic rule engine. Reads recent project signals + writer profile,
 * writes one row per fired rule (idempotent on rule_key+project_id while pending).
 */
const RuleInput = z.object({ project_id: z.string().uuid() });

type Rule = {
  key: string;
  title: string;
  body: string;
  severity: "info" | "tip" | "warning";
  lesson_slug?: string;
  fires: (s: Signals) => boolean;
};

type Signals = {
  blocks: number;
  formatErrors: number;
  scenesTotal: number;
  scenesWithTurn: number;
  aiAccepts: number;
  aiRejects: number;
  dialogueBlocks: number;
  actionBlocks: number;
  profile: {
    formatting_skill_score: number;
    scene_craft_score: number;
    ai_dependence_score: number;
    confidence_score: number;
    coaching_level: string;
  };
};

const RULES: Rule[] = [
  {
    key: "format_basics",
    title: "Brush up on scene heading format",
    body: "Several blocks are missing INT./EXT. prefixes or time-of-day. Headings anchor every scene — fix these first.",
    severity: "warning",
    lesson_slug: "scene-headings",
    fires: (s) => s.blocks >= 10 && s.profile.formatting_skill_score < 55,
  },
  {
    key: "scene_turn",
    title: "Add a turn to your scenes",
    body: "Most of your scenes start and end in the same emotional place. A scene earns its keep when something changes — a decision, a discovery, a reversal.",
    severity: "tip",
    lesson_slug: "scene-turn",
    fires: (s) => s.scenesTotal >= 3 && s.scenesWithTurn / Math.max(1, s.scenesTotal) < 0.4,
  },
  {
    key: "subtext_dialogue",
    title: "Push dialogue beneath the surface",
    body: "Your dialogue is doing a lot of telling. Try writing what the character says, then asking what they really mean. Cut the literal version.",
    severity: "tip",
    lesson_slug: "subtext",
    fires: (s) => s.dialogueBlocks >= 20,
  },
  {
    key: "ai_dependence",
    title: "Write the first pass yourself",
    body: "You're accepting AI suggestions far more than rejecting them. The fastest way to find your voice is to draft first, then let AI sharpen.",
    severity: "warning",
    fires: (s) => s.profile.ai_dependence_score > 75 && s.aiAccepts + s.aiRejects >= 6,
  },
  {
    key: "visual_writing",
    title: "Make us see it",
    body: "Several action lines describe feelings, not visuals. Replace one with something we can actually see on screen — a gesture, a prop, a glance.",
    severity: "tip",
    lesson_slug: "show-dont-tell",
    fires: (s) => s.actionBlocks >= 10,
  },
];

export const generateCoachRecommendations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => RuleInput.parse(d))
  .handler(async ({ data, context }) => {
    // Pull recent project signals from writing_events.
    const { data: events } = await context.supabase
      .from("writing_events")
      .select("event_type, context")
      .eq("user_id", context.userId)
      .eq("project_id", data.project_id)
      .order("created_at", { ascending: false })
      .limit(1000);

    const sig: Signals = {
      blocks: 0,
      formatErrors: 0,
      scenesTotal: 0,
      scenesWithTurn: 0,
      aiAccepts: 0,
      aiRejects: 0,
      dialogueBlocks: 0,
      actionBlocks: 0,
      profile: {
        formatting_skill_score: 50,
        scene_craft_score: 50,
        ai_dependence_score: 50,
        confidence_score: 50,
        coaching_level: "gentle",
      },
    };

    for (const e of events ?? []) {
      const ctx = (e.context ?? {}) as Record<string, unknown>;
      if (e.event_type === "block_created") {
        sig.blocks++;
        if (ctx.block_type === "dialogue") sig.dialogueBlocks++;
        if (ctx.block_type === "action") sig.actionBlocks++;
      } else if (e.event_type === "format_error") sig.formatErrors++;
      else if (e.event_type === "scene_created") {
        sig.scenesTotal++;
        if (ctx.has_turn === true) sig.scenesWithTurn++;
      } else if (e.event_type === "ai_accepted") sig.aiAccepts++;
      else if (e.event_type === "ai_rejected") sig.aiRejects++;
    }

    const { data: profile } = await context.supabase
      .from("writer_profiles")
      .select("formatting_skill_score, scene_craft_score, ai_dependence_score, confidence_score, coaching_level")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (profile) sig.profile = { ...sig.profile, ...profile };

    // Find which rules currently fire.
    const firing = RULES.filter((r) => r.fires(sig));

    // Existing pending/shown recs for this project — don't re-fire.
    const { data: existing } = await context.supabase
      .from("coach_recommendations")
      .select("rule_key")
      .eq("project_id", data.project_id)
      .in("status", ["pending", "shown"]);
    const have = new Set((existing ?? []).map((r) => r.rule_key));

    const toInsert = firing
      .filter((r) => !have.has(r.key))
      .map((r) => ({
        user_id: context.userId,
        project_id: data.project_id,
        rule_key: r.key,
        title: r.title,
        body: r.body,
        severity: r.severity,
        lesson_slug: r.lesson_slug ?? null,
      }));

    if (toInsert.length > 0) {
      const { error } = await context.supabase.from("coach_recommendations").insert(toInsert);
      if (error) throw new Error(error.message);
    }
    return { fired: toInsert.length };
  });
