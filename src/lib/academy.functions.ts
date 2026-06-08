import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { callAI, GUIDED_STEPS } from "./academy.server";

const ProjectIdInput = z.object({ projectId: z.string().uuid() });

export const seedGuidedSteps = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ProjectIdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: existing } = await context.supabase
      .from("project_guided_steps")
      .select("id")
      .eq("project_id", data.projectId)
      .limit(1);
    if (existing && existing.length > 0) return { ok: true, seeded: false };

    const rows = GUIDED_STEPS.map((s, i) => ({
      project_id: data.projectId,
      user_id: context.userId,
      step_key: s.step_key,
      title: s.title,
      output_type: s.output_type,
      order_index: i + 1,
      status: i === 0 ? "in_progress" : "locked",
    }));
    const { error } = await context.supabase.from("project_guided_steps").insert(rows);
    if (error) throw new Error(error.message);
    return { ok: true, seeded: true };
  });

export const listGuidedSteps = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ProjectIdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("project_guided_steps")
      .select("*")
      .eq("project_id", data.projectId)
      .order("order_index");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const StepUpdateInput = z.object({
  projectId: z.string().uuid(),
  stepKey: z.string().min(1).max(64),
  status: z.enum(["locked", "in_progress", "complete"]).optional(),
  user_output: z.string().max(20000).optional(),
  output_reference_id: z.string().uuid().nullable().optional(),
});

export const updateGuidedStep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => StepUpdateInput.parse(d))
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = {};
    if (data.status) patch.status = data.status;
    if (data.user_output !== undefined) patch.user_output = data.user_output;
    if (data.output_reference_id !== undefined) patch.output_reference_id = data.output_reference_id;
    if (data.status === "complete") patch.completed_at = new Date().toISOString();
    const { error } = await context.supabase
      .from("project_guided_steps")
      .update(patch)
      .eq("project_id", data.projectId)
      .eq("step_key", data.stepKey);
    if (error) throw new Error(error.message);

    // Auto-unlock next step on completion
    if (data.status === "complete") {
      const { data: rows } = await context.supabase
        .from("project_guided_steps")
        .select("step_key, order_index, status")
        .eq("project_id", data.projectId)
        .order("order_index");
      const current = rows?.find((r) => r.step_key === data.stepKey);
      const next = current ? rows?.find((r) => r.order_index === current.order_index + 1) : null;
      if (next && next.status === "locked") {
        await context.supabase
          .from("project_guided_steps")
          .update({ status: "in_progress" })
          .eq("project_id", data.projectId)
          .eq("step_key", next.step_key);
      }
    }
    return { ok: true };
  });

// ----- Lesson progress -----

const LessonProgressInput = z.object({
  lessonId: z.string().uuid(),
  status: z.enum(["not_started", "in_progress", "complete"]).optional(),
  user_output: z.string().max(20000).optional(),
});

export const upsertLessonProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => LessonProgressInput.parse(d))
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = {
      user_id: context.userId,
      lesson_id: data.lessonId,
    };
    if (data.status) patch.status = data.status;
    if (data.user_output !== undefined) patch.user_output = data.user_output;
    if (data.status === "complete") patch.completed_at = new Date().toISOString();

    const { data: existing } = await context.supabase
      .from("user_lesson_progress")
      .select("id")
      .eq("user_id", context.userId)
      .eq("lesson_id", data.lessonId)
      .maybeSingle();
    if (existing) {
      const { error } = await context.supabase
        .from("user_lesson_progress")
        .update(patch)
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await context.supabase.from("user_lesson_progress").insert(patch);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

// ----- AI helpers -----

const PromptInput = z.object({
  prompt: z.string().min(1).max(8000),
  context: z.string().max(20000).optional(),
});

export const aiGenerateLoglineOptions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => PromptInput.parse(d))
  .handler(async ({ data }) => {
    return callAI(
      `Generate 5 distinct logline options for the following rough story idea. Each logline 25–40 words. Each must name a protagonist, goal, obstacle, stakes, and a unique hook. Return a numbered list.\n\nIDEA:\n${data.prompt}\n\n${data.context ?? ""}`,
    );
  });

export const aiGenerateThemeOptions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => PromptInput.parse(d))
  .handler(async ({ data }) => {
    return callAI(
      `Suggest 5 thematic statements (one-sentence each) for this story idea. A theme is a moral argument, not a topic. Show what the story argues about human nature.\n\n${data.prompt}\n\n${data.context ?? ""}`,
    );
  });

export const aiExplainScreenplayConcept = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ concept: z.string().min(1).max(120) }).parse(d))
  .handler(async ({ data }) => {
    return callAI(
      `Explain the screenplay concept "${data.concept}" in 4 short paragraphs: (1) Definition, (2) Why it matters, (3) A specific example from a well-known film, (4) A 1-line test to spot it in your own writing.`,
    );
  });

export const aiCoachCurrentScene = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    sceneText: z.string().max(20000),
    level: z.enum(["gentle", "active", "teaching"]),
  }).parse(d))
  .handler(async ({ data }) => {
    const levelInstr = {
      gentle: "Only flag the single biggest weakness if any. Be brief. If the scene is solid, say so.",
      active: "Identify 3 craft suggestions ranked by impact. Be concrete and actionable.",
      teaching: "Identify 3 craft issues. For each, explain the underlying screenplay principle, give a 1-line example, then a specific rewrite suggestion for this scene.",
    }[data.level];
    return callAI(
      `Coach this scene. ${levelInstr}\n\nSCENE:\n${data.sceneText}`,
    );
  });

export const aiCreateProtagonistFromLesson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => PromptInput.parse(d))
  .handler(async ({ data }) => callAI(
    `Create a protagonist for this story. Return JSON with keys: name, role, age, archetype, external_goal, internal_need, wound, fear, contradiction, core_lie, voice_style. Story context:\n${data.prompt}\n\n${data.context ?? ""}`,
  ));

export const aiCreateAntagonistFromLesson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => PromptInput.parse(d))
  .handler(async ({ data }) => callAI(
    `Create an antagonist that mirrors and pressures the protagonist. Return JSON with keys: name, role, age, archetype, external_goal, internal_need, wound, fear, core_lie, why_dangerous. Context:\n${data.prompt}\n\n${data.context ?? ""}`,
  ));

export const aiBuildStoryArcFromLesson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => PromptInput.parse(d))
  .handler(async ({ data }) => callAI(
    `Build a story arc using a 3-act structure with key beats. Return JSON with keys: arc_type, structure_model, central_question, opening_state, midpoint_shift, darkest_moment, climax_choice, final_state, theme. Context:\n${data.prompt}\n\n${data.context ?? ""}`,
  ));

export const aiCreateSceneListFromLesson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => PromptInput.parse(d))
  .handler(async ({ data }) => callAI(
    `Generate a numbered list of 20–30 scene cards for this story. For each scene: heading (INT./EXT. LOCATION — TIME), one-sentence purpose, one-sentence turn. Context:\n${data.prompt}\n\n${data.context ?? ""}`,
  ));

export const aiDiagnoseBeginnerScript = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => PromptInput.parse(d))
  .handler(async ({ data }) => callAI(
    `Diagnose this beginner screenplay excerpt. Identify the 3 most common beginner pitfalls present (on-the-nose dialogue, weak scene goal, missing turn, exposition dumps, flat conflict, etc.). For each, quote the offending line and propose a fix.\n\nSCRIPT:\n${data.prompt}\n\n${data.context ?? ""}`,
  ));

export const aiGenerateRewriteExercise = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => PromptInput.parse(d))
  .handler(async ({ data }) => callAI(
    `Create a focused rewriting exercise. Provide: (1) the principle being taught, (2) a "before" scene snippet (weak), (3) a guided 3-step rewrite plan, (4) a "after" example. Use the writer's context where possible.\n\nCONTEXT:\n${data.prompt}\n${data.context ?? ""}`,
  ));
