import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const SYSTEM = `You are SceneSmith AI, a story consultant.
Score scenes by dramatic function. Track external plot, internal character change,
relationship shifts, moral pressure (TMH 1-9), theme, stakes, and scene turn.
Be specific, cinematic, and concise. Avoid generic notes. No clichés.
Return prose unless JSON is explicitly requested.`;

async function callText(prompt: string): Promise<string | null> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) return null;
  try {
    const gateway = createLovableAiGatewayProvider(key);
    const { text } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      system: SYSTEM,
      prompt,
    });
    return text.trim();
  } catch {
    return null;
  }
}

// ============= Scene strength scoring (deterministic) =============

export type StrengthBreakdown = {
  score: number;
  status: string;
  strong: string[];
  weak: string[];
};

export function computeSceneStrength(beat: any | null | undefined): StrengthBreakdown {
  const has = (k: string) => beat && beat[k] && String(beat[k]).trim().length >= 3;
  const strong: string[] = [];
  const weak: string[] = [];
  const checks: [string, string, string][] = [
    ["scene_purpose", "Clear purpose", "Missing scene purpose"],
    ["scene_turn", "Has a scene turn", "No scene turn — scene may be flat"],
    ["external_plot_change", "Plot advances", "No plot movement"],
    ["stakes_change", "Stakes shift", "Stakes don't change"],
    ["moral_pressure", "Moral pressure present", "No moral pressure"],
    ["theme_connection", "Connects to theme", "Theme not visible"],
    ["relationship_change", "Relationship shifts", "Relationships static"],
    ["question_raised", "Raises a dramatic question", "No question raised"],
    ["question_answered", "Answers an earlier question", "Doesn't answer anything"],
  ];
  for (const [k, good, bad] of checks) {
    if (has(k)) strong.push(good);
    else weak.push(bad);
  }
  // Each filled field worth ~11
  const score = Math.min(100, strong.length * 11);
  let status = "Unreviewed";
  if (!beat) status = "Unreviewed";
  else if (score >= 75) status = "Strong";
  else if (!has("scene_turn")) status = "Missing Turn";
  else if (!has("stakes_change")) status = "No Stakes Change";
  else if (score < 35) status = "Needs Work";
  else status = "Needs Work";
  return { score, status, strong, weak };
}

// ============= CRUD =============

const SceneArcUpsert = z.object({
  project_id: z.string().uuid(),
  scene_id: z.string().uuid(),
  patch: z.record(z.string(), z.any()),
});

export const upsertSceneArc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SceneArcUpsert.parse(d))
  .handler(async ({ data, context }) => {
    const { project_id, scene_id, patch } = data;
    const clean: any = { ...patch };
    delete clean.id; delete clean.created_at; delete clean.updated_at;
    delete clean.project_id; delete clean.scene_id;
    // Recompute score from merged data
    const { data: existing } = await context.supabase
      .from("scene_arc_beats").select("*").eq("scene_id", scene_id).maybeSingle();
    const merged = { ...(existing || {}), ...clean };
    const s = computeSceneStrength(merged);
    clean.scene_strength_score = s.score;
    if (!clean.arc_status) clean.arc_status = s.status;
    const { data: row, error } = await context.supabase
      .from("scene_arc_beats")
      .upsert({ project_id, scene_id, ...clean }, { onConflict: "scene_id" })
      .select().single();
    if (error) throw new Error(error.message);
    return row;
  });

const CharSceneArcUpsert = z.object({
  project_id: z.string().uuid(),
  scene_id: z.string().uuid(),
  character_id: z.string().uuid(),
  patch: z.record(z.string(), z.any()),
});

export const upsertCharacterSceneArc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CharSceneArcUpsert.parse(d))
  .handler(async ({ data, context }) => {
    const { project_id, scene_id, character_id, patch } = data;
    const clean: any = { ...patch };
    delete clean.id; delete clean.created_at; delete clean.updated_at;
    delete clean.project_id; delete clean.scene_id; delete clean.character_id;
    const { data: row, error } = await context.supabase
      .from("character_scene_arc_states")
      .upsert({ project_id, scene_id, character_id, ...clean }, { onConflict: "scene_id,character_id" })
      .select().single();
    if (error) throw new Error(error.message);
    return row;
  });

const DelCharSceneArc = z.object({ id: z.string().uuid() });
export const deleteCharacterSceneArc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => DelCharSceneArc.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("character_scene_arc_states").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const StoryArcUpsert = z.object({
  project_id: z.string().uuid(),
  patch: z.record(z.string(), z.any()),
});

export const upsertStoryArc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => StoryArcUpsert.parse(d))
  .handler(async ({ data, context }) => {
    const { project_id, patch } = data;
    const clean: any = { ...patch };
    delete clean.id; delete clean.created_at; delete clean.updated_at; delete clean.project_id;
    const { data: row, error } = await context.supabase
      .from("story_arcs")
      .upsert({ project_id, ...clean }, { onConflict: "project_id" })
      .select().single();
    if (error) throw new Error(error.message);
    return row;
  });

const CharArcUpsert = z.object({
  project_id: z.string().uuid(),
  character_id: z.string().uuid(),
  patch: z.record(z.string(), z.any()),
});

export const upsertCharacterArc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CharArcUpsert.parse(d))
  .handler(async ({ data, context }) => {
    const { project_id, character_id, patch } = data;
    const clean: any = { ...patch };
    delete clean.id; delete clean.created_at; delete clean.updated_at;
    delete clean.project_id; delete clean.character_id;
    const { data: row, error } = await context.supabase
      .from("character_arcs")
      .upsert({ project_id, character_id, ...clean }, { onConflict: "character_id" })
      .select().single();
    if (error) throw new Error(error.message);
    return row;
  });

// ============= AI Arc Tools =============

const ToolInput = z.object({
  project_id: z.string().uuid(),
  scene_id: z.string().uuid().optional(),
  character_id: z.string().uuid().optional(),
  tool: z.string(),
  notes: z.string().optional(),
});

async function loadSceneContext(ctx: any, scene_id: string) {
  const [scene, beat, blocks, charStates] = await Promise.all([
    ctx.supabase.from("scenes").select("*").eq("id", scene_id).maybeSingle(),
    ctx.supabase.from("scene_arc_beats").select("*").eq("scene_id", scene_id).maybeSingle(),
    ctx.supabase.from("script_blocks").select("block_type, content").eq("scene_id", scene_id).order("order_index"),
    ctx.supabase.from("character_scene_arc_states").select("*").eq("scene_id", scene_id),
  ]);
  return {
    scene: scene.data,
    beat: beat.data,
    blocks: blocks.data || [],
    charStates: charStates.data || [],
  };
}

function demoOutput(tool: string, scene: any, beat: any): string {
  const heading = scene?.scene_heading || scene?.title || "this scene";
  const purpose = beat?.scene_purpose || "advance the story";
  const lines: Record<string, string> = {
    "Find this scene's turn": `Possible turn for ${heading}:\n• The character realizes the person they trusted is the one withholding the truth.\n• This forces a choice: confront or comply.\n• The scene pivots from investigation to accusation.`,
    "Strengthen character movement": `Make the lead move from L${beat?.emotional_charge && beat.emotional_charge > 6 ? "6 Altruism" : "4 Justice"} → L2 Self-Interest by introducing a private cost the audience didn't see coming. The scene should END with them quieter than they began — fear, not anger.`,
    "Add moral pressure": `Add a witness with conflicting loyalty so the protagonist cannot do the right thing without betraying someone they love. The pressure is not "what's right?" but "who pays?"`,
    "Connect scene to theme": `If your theme is truth vs. protection, plant a small lie inside an act of love. Let the audience see the lie before the other character does. Tension lives in dramatic irony.`,
    "Raise the stakes": `Make failure here cost something irreversible: a relationship, a deadline, a body. Stakes should be specific, visible, and immediate — not "the case."`,
    "Make the protagonist choose": `End the scene with a binary choice the protagonist cannot escape. Two doors. Both have prices. They must pick.`,
    "Pressure the wound": `Have the antagonist (or worse, an ally) press the exact thing your protagonist fears about themselves — not in argument, but in the most ordinary line of dialogue.`,
    "Diagnose weak scene": `Scene strength: ${beat?.scene_strength_score ?? "Unscored"}.\nMissing: scene turn, stakes change, character choice. Consider cutting the first beat — the scene starts when the question is asked, not when characters arrive.`,
    "Suggest stronger ending": `End on an image, not a line. A door closing, a phone going to voicemail, a name written and crossed out. The image should answer one question and ask the next.`,
    "Suggest midpoint reversal": `Midpoint should flip the story's premise: the investigator becomes the suspect, the rescue becomes a trap, the ally becomes the threat. The protagonist's plan must die here.`,
    "Strengthen climax choice": `Force the protagonist to choose between the external goal and the internal need. Whichever they choose, the audience must understand the cost.`,
    "Fix Act 2 sag": `Drop a scene where the antagonist gets a clean win. Then drop a scene where the protagonist's lie is named aloud by someone who loves them. Act 2 sags when nothing the lead does matters — restore consequence.`,
  };
  return lines[tool] || `Suggestion for ${heading}: tighten ${purpose}. Make the cost visible, the choice irreversible, and the silence louder than the dialogue.`;
}

export const runArcTool = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ToolInput.parse(d))
  .handler(async ({ data, context }) => {
    let scene: any = null, beat: any = null, blocks: any[] = [], charStates: any[] = [];
    if (data.scene_id) {
      const c = await loadSceneContext(context, data.scene_id);
      scene = c.scene; beat = c.beat; blocks = c.blocks; charStates = c.charStates;
    }
    const { data: project } = await context.supabase.from("projects")
      .select("title, genre, logline, tone").eq("id", data.project_id).maybeSingle();
    const { data: storyArc } = await context.supabase.from("story_arcs")
      .select("*").eq("project_id", data.project_id).maybeSingle();

    const script = blocks.map((b: any) => `[${b.block_type}] ${b.content}`).join("\n").slice(-3000);
    const prompt = `Project: ${project?.title ?? ""} (${project?.genre ?? ""})
Logline: ${project?.logline ?? ""}
Theme: ${storyArc?.theme ?? ""}
Central question: ${storyArc?.central_question ?? ""}

Scene: ${scene?.scene_heading ?? scene?.title ?? "(unspecified)"}
Existing arc data: ${JSON.stringify(beat || {})}
Character states in scene: ${JSON.stringify(charStates)}
${script ? `Script excerpt:\n${script}` : ""}

User notes: ${data.notes || "(none)"}
Task: ${data.tool}

Respond with concise, actionable craft notes (under 220 words). No headers, no fluff.`;

    const text = await callText(prompt);
    return { text: text || demoOutput(data.tool, scene, beat), demo: !text };
  });

// ============= Project-level diagnosis =============

const DiagInput = z.object({ project_id: z.string().uuid() });

export const diagnoseProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => DiagInput.parse(d))
  .handler(async ({ data, context }) => {
    const [scenes, beats, states, characters] = await Promise.all([
      context.supabase.from("scenes").select("id, scene_heading, title, order_index").eq("project_id", data.project_id).order("order_index"),
      context.supabase.from("scene_arc_beats").select("*").eq("project_id", data.project_id),
      context.supabase.from("character_scene_arc_states").select("*").eq("project_id", data.project_id),
      context.supabase.from("characters").select("id, name, role").eq("project_id", data.project_id),
    ]);
    const sceneRows = scenes.data || [];
    const beatMap = new Map((beats.data || []).map((b: any) => [b.scene_id, b]));
    const stateRows = states.data || [];
    const charRows = characters.data || [];

    const warnings: { kind: string; message: string; sceneId?: string; characterId?: string }[] = [];

    // Weak scenes
    for (const s of sceneRows) {
      const b = beatMap.get(s.id);
      const r = computeSceneStrength(b);
      if (r.score < 35) {
        warnings.push({ kind: "weak_scene", sceneId: s.id, message: `${s.scene_heading || s.title || "Untitled scene"} — strength ${r.score}/100. ${r.weak.slice(0, 2).join("; ")}` });
      }
    }

    // Protagonist silence: any character with role containing "Protagonist" missing for 4+ scenes
    const protag = charRows.find((c: any) => /protagon|lead/i.test(c.role || ""));
    if (protag && sceneRows.length > 4) {
      const present = new Set(stateRows.filter((s: any) => s.character_id === protag.id).map((s: any) => s.scene_id));
      let gap = 0;
      for (const s of sceneRows) {
        if (present.has(s.id)) gap = 0;
        else gap++;
        if (gap === 4) {
          warnings.push({ kind: "protag_silence", characterId: protag.id, message: `${protag.name} disappears for 4+ consecutive scenes near "${s.scene_heading || s.title}".` });
          gap = 0;
        }
      }
    }

    // Flat TMH stretch
    for (const c of charRows) {
      const charStates = stateRows.filter((s: any) => s.character_id === c.id);
      const moves = charStates.filter((s: any) => s.tmh_start_level && s.tmh_end_level && s.tmh_start_level !== s.tmh_end_level);
      if (charStates.length >= 5 && moves.length === 0) {
        warnings.push({ kind: "flat_arc", characterId: c.id, message: `${c.name} appears in ${charStates.length} scenes with no TMH movement — flat arc.` });
      }
    }

    return { warnings, totals: { scenes: sceneRows.length, beats: (beats.data || []).length, states: stateRows.length } };
  });
