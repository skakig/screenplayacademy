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
    const patch: {
      status?: "locked" | "in_progress" | "complete";
      user_output?: string;
      output_reference_id?: string | null;
      completed_at?: string;
    } = {};
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

// ----- Apply step output to project tables -----

function tryParseJson(text: string): any | null {
  try {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
  } catch { /* noop */ }
  return null;
}

const ApplyInput = z.object({
  projectId: z.string().uuid(),
  stepKey: z.string().min(1).max(64),
  text: z.string().min(1).max(40000),
  insertIntoEditor: z.boolean().optional(),
});

export const applyStepOutput = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ApplyInput.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { projectId, stepKey, text, insertIntoEditor } = data;
    let referenceId: string | null = null;
    let summary = "Saved";

    const appendEditorBlocks = async (blocks: Array<{ block_type: string; content: string }>) => {
      const { data: existing } = await sb
        .from("script_blocks")
        .select("order_index")
        .eq("project_id", projectId)
        .order("order_index", { ascending: false })
        .limit(1);
      let start = (existing?.[0]?.order_index ?? -1) + 1;
      const rows = blocks.map((b) => ({
        project_id: projectId,
        block_type: b.block_type,
        content: b.content,
        order_index: start++,
      }));
      if (rows.length) await sb.from("script_blocks").insert(rows);
    };

    switch (stepKey) {
      case "logline": {
        // Use first non-empty line, strip numbering
        const first = text.split("\n").map((l) => l.replace(/^\s*\d+[\.\)]\s*/, "").trim()).find(Boolean) ?? text.trim();
        await sb.from("projects").update({ logline: first }).eq("id", projectId);
        summary = "Logline saved to project";
        if (insertIntoEditor) {
          await appendEditorBlocks([{ block_type: "note", content: `LOGLINE: ${first}` }]);
        }
        break;
      }
      case "protagonist":
      case "antagonist": {
        const json = tryParseJson(text);
        const role = stepKey === "protagonist" ? "Protagonist" : "Antagonist";
        const payload: any = {
          project_id: projectId,
          name: json?.name?.toString().slice(0, 120) || role,
          role,
          age: json?.age?.toString().slice(0, 60) ?? null,
          archetype: json?.archetype?.toString().slice(0, 120) ?? null,
          external_goal: json?.external_goal ?? null,
          internal_need: json?.internal_need ?? null,
          wound: json?.wound ?? null,
          fear: json?.fear ?? null,
          contradiction: json?.contradiction ?? null,
          core_lie: json?.core_lie ?? null,
          voice_style: json?.voice_style ?? null,
          group_name: role === "Protagonist" ? "Main Cast" : "Antagonists",
        };
        const { data: inserted } = await sb.from("characters").insert(payload).select("id, name").single();
        referenceId = inserted?.id ?? null;
        summary = `${role} "${inserted?.name}" added to Characters`;
        if (insertIntoEditor) {
          await appendEditorBlocks([{ block_type: "note", content: `${role.toUpperCase()}: ${inserted?.name}\n${text.slice(0, 600)}` }]);
        }
        break;
      }
      case "theme":
      case "story_arc":
      case "midpoint": {
        const json = tryParseJson(text);
        const { data: existing } = await sb.from("story_arcs").select("id").eq("project_id", projectId).maybeSingle();
        const patch: any = { project_id: projectId };
        if (stepKey === "theme") {
          const first = text.split("\n").map((l) => l.replace(/^\s*\d+[\.\)]\s*/, "").trim()).find(Boolean) ?? text.trim();
          patch.theme = first;
          summary = "Theme saved to story arc";
        } else if (stepKey === "midpoint") {
          patch.midpoint_shift = text.trim().slice(0, 4000);
          summary = "Midpoint saved to story arc";
        } else if (json) {
          for (const k of ["arc_type","structure_model","central_question","opening_state","midpoint_shift","darkest_moment","climax_choice","final_state","theme"]) {
            if (json[k]) patch[k] = String(json[k]);
          }
          summary = "Story arc saved";
        } else {
          patch.central_question = text.trim().slice(0, 4000);
          summary = "Story arc saved (notes)";
        }
        if (existing?.id) {
          await sb.from("story_arcs").update(patch).eq("id", existing.id);
          referenceId = existing.id;
        } else {
          const { data: created } = await sb.from("story_arcs").insert(patch).select("id").single();
          referenceId = created?.id ?? null;
        }
        break;
      }
      case "scene_cards": {
        // Parse "1. INT. LOCATION - DAY — purpose" type lines
        const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
        const cards = lines
          .filter((l) => /^\d+[\.\)]/.test(l) || /^(INT|EXT|INT\/EXT)\b/i.test(l))
          .slice(0, 40)
          .map((l, i) => {
            const cleaned = l.replace(/^\s*\d+[\.\)]\s*/, "");
            const heading = (cleaned.match(/(INT|EXT|INT\/EXT)[^—\-\n]+/i)?.[0] ?? cleaned).trim().slice(0, 240);
            const purpose = cleaned.replace(heading, "").replace(/^[\s—\-:]+/, "").trim().slice(0, 1000);
            return { heading, purpose, idx: i };
          });
        if (cards.length === 0) {
          summary = "Could not parse scene cards — try regenerating.";
          break;
        }
        const sceneRows = cards.map((c) => ({
          project_id: projectId,
          scene_heading: c.heading,
          title: c.heading,
          plot_purpose: c.purpose || null,
          status: "idea" as const,
          order_index: c.idx,
        }));
        await sb.from("scenes").insert(sceneRows);
        summary = `${cards.length} scene cards added`;
        if (insertIntoEditor) {
          const blocks: Array<{ block_type: string; content: string }> = [];
          for (const c of cards) {
            blocks.push({ block_type: "scene_heading", content: c.heading });
            if (c.purpose) blocks.push({ block_type: "note", content: c.purpose });
          }
          await appendEditorBlocks(blocks);
        }
        break;
      }
      case "opening_scene":
      case "act1":
      case "rough_draft": {
        // Turn text into action/dialogue blocks if no slugline; otherwise treat as raw scene
        const lines = text.split("\n").map((l) => l.trim());
        const blocks: Array<{ block_type: string; content: string }> = [];
        for (const l of lines) {
          if (!l) continue;
          if (/^(INT|EXT|INT\/EXT)\b/i.test(l)) blocks.push({ block_type: "scene_heading", content: l });
          else if (/^[A-Z][A-Z0-9 \.\-']{2,40}$/.test(l)) blocks.push({ block_type: "character", content: l });
          else if (/^\(.+\)$/.test(l)) blocks.push({ block_type: "parenthetical", content: l });
          else if (/^(CUT TO|FADE (IN|OUT)|DISSOLVE TO)\:?$/i.test(l)) blocks.push({ block_type: "transition", content: l });
          else blocks.push({ block_type: "action", content: l });
        }
        if (blocks.length === 0) blocks.push({ block_type: "action", content: text.trim() });
        await appendEditorBlocks(blocks);
        summary = `${blocks.length} blocks inserted into editor`;
        break;
      }
      default: {
        // Just attach as note block for visibility
        if (insertIntoEditor) {
          await appendEditorBlocks([{ block_type: "note", content: `[${stepKey}] ${text.slice(0, 2000)}` }]);
          summary = "Saved as editor note";
        } else {
          summary = "Saved to step";
        }
      }
    }

    // Persist user_output + reference on the step
    const patch: any = { user_output: text.slice(0, 20000) };
    if (referenceId) patch.output_reference_id = referenceId;
    await sb.from("project_guided_steps").update(patch).eq("project_id", projectId).eq("step_key", stepKey);

    return { ok: true, summary, referenceId };
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
    const patch: {
      user_id: string;
      lesson_id: string;
      status?: "not_started" | "in_progress" | "complete";
      user_output?: string;
      completed_at?: string;
    } = {
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
