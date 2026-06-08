import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const SYSTEM = `You are SceneSmith AI, a story consultant and character architect.
You design layered, contradictory, cinematic characters with depth. Avoid clichés.
TMH ("The Moral Heuristic") describes moral behavior under pressure on a 1-9 scale:
1 Survival, 2 Self-Interest, 3 Social Contract, 4 Fairness/Justice, 5 Empathy,
6 Altruism, 7 Integrity, 8 Virtue, 9 Transcendence. Use these as behavior bands, not judgment.
When asked for JSON, return STRICT JSON only — no prose, no markdown fences.`;

async function callJson<T = any>(prompt: string): Promise<T | null> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) return null;
  try {
    const gateway = createLovableAiGatewayProvider(key);
    const { text } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      system: SYSTEM,
      prompt,
    });
    const cleaned = text.replace(/^```json\s*|\s*```$/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

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
    return text;
  } catch {
    return null;
  }
}

async function loadOwnedCharacter(ctx: any, id: string) {
  const { data, error } = await ctx.supabase.from("characters").select("*").eq("id", id).maybeSingle();
  if (error || !data) throw new Error("Character not found");
  return data;
}

function characterContext(c: any): string {
  return [
    `Name: ${c.name}`,
    c.role && `Role: ${c.role}`,
    c.archetype && `Archetype: ${c.archetype}`,
    c.age && `Age: ${c.age}`,
    c.summary && `Summary: ${c.summary}`,
    c.external_goal && `External goal: ${c.external_goal}`,
    c.internal_need && `Internal need: ${c.internal_need}`,
    c.wound && `Wound: ${c.wound}`,
    c.fear && `Fear: ${c.fear}`,
    c.secret && `Secret: ${c.secret}`,
    c.contradiction && `Contradiction: ${c.contradiction}`,
    c.voice_style && `Voice: ${c.voice_style}`,
  ].filter(Boolean).join("\n");
}

// ============= Upsert / Delete =============

const UpsertInput = z.object({
  id: z.string().uuid().optional(),
  project_id: z.string().uuid(),
  patch: z.record(z.string(), z.any()),
});

export const upsertCharacter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpsertInput.parse(d))
  .handler(async ({ data, context }) => {
    const { id, project_id, patch } = data;
    // Strip read-only / dangerous keys
    const clean: any = { ...patch };
    delete clean.id; delete clean.created_at; delete clean.updated_at; delete clean.project_id;
    if (id) {
      const { data: row, error } = await context.supabase
        .from("characters").update(clean).eq("id", id).select().single();
      if (error) throw new Error(error.message);
      return row;
    } else {
      const { data: row, error } = await context.supabase
        .from("characters").insert({ ...clean, project_id, name: clean.name || "New Character" }).select().single();
      if (error) throw new Error(error.message);
      return row;
    }
  });

const IdInput = z.object({ id: z.string().uuid() });
export const deleteCharacter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => IdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("characters").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============= Relationships =============

const RelUpsert = z.object({
  id: z.string().uuid().optional(),
  project_id: z.string().uuid(),
  character_id: z.string().uuid(),
  patch: z.record(z.string(), z.any()),
});

export const upsertRelationship = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => RelUpsert.parse(d))
  .handler(async ({ data, context }) => {
    const clean: any = { ...data.patch };
    delete clean.id; delete clean.created_at; delete clean.updated_at;
    if (data.id) {
      const { data: row, error } = await context.supabase
        .from("character_relationships").update(clean).eq("id", data.id).select().single();
      if (error) throw new Error(error.message);
      return row;
    }
    const { data: row, error } = await context.supabase
      .from("character_relationships")
      .insert({ ...clean, project_id: data.project_id, character_id: data.character_id })
      .select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteRelationship = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => IdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("character_relationships").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============= Scene states =============

const SceneStateUpsert = z.object({
  id: z.string().uuid().optional(),
  project_id: z.string().uuid(),
  character_id: z.string().uuid(),
  scene_id: z.string().uuid(),
  patch: z.record(z.string(), z.any()),
});

export const upsertSceneState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SceneStateUpsert.parse(d))
  .handler(async ({ data, context }) => {
    const clean: any = { ...data.patch };
    delete clean.id; delete clean.created_at; delete clean.updated_at;
    const row = {
      ...clean,
      project_id: data.project_id,
      character_id: data.character_id,
      scene_id: data.scene_id,
    };
    const { data: out, error } = await context.supabase
      .from("character_scene_states")
      .upsert(row, { onConflict: "character_id,scene_id" })
      .select().single();
    if (error) throw new Error(error.message);
    return out;
  });

// ============= AI generators (with demo fallback) =============

const AiInput = z.object({ characterId: z.string().uuid() });

function pick<T>(arr: T[], i: number): T { return arr[Math.abs(i) % arr.length]; }
function seedFrom(s: string): number {
  let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h;
}

function demoFullProfile(c: any) {
  const seed = seedFrom(c.name + (c.role ?? ""));
  return {
    role: c.role || pick(["Protagonist", "Mentor", "Foil", "Catalyst"], seed),
    age: c.age || pick(["28", "34", "41", "52"], seed + 1),
    archetype: c.archetype || pick(["Reluctant Hero", "Trickster", "Wounded Caregiver", "Shadow Ruler"], seed + 2),
    summary: c.summary || `${c.name} carries a quiet contradiction — public competence wrapped around private fear.`,
    external_goal: c.external_goal || "Win back what was unfairly taken — and prove they were right all along.",
    internal_need: c.internal_need || "To accept help without flinching.",
    wound: c.wound || "A betrayal from someone they trusted as a child.",
    fear: c.fear || "Being seen as small.",
    secret: c.secret || "They were the one who let the door stay open.",
    contradiction: c.contradiction || "Demands honesty from everyone but themselves.",
    core_lie: c.core_lie || "If I stay in control, nobody else gets hurt.",
    voice_style: c.voice_style || "Clipped, dry, allergic to sentiment — until cornered.",
    speech_patterns: c.speech_patterns || "Short sentences. Asks questions instead of answering them. Trails off when it matters.",
    visual_description: c.visual_description || "Lean, watchful, dressed in layers of muted neutrals. Carries one item that never fits the room.",
    costume_notes: c.costume_notes || "Functional, never decorative. One inherited piece.",
    character_arc: c.character_arc || "From self-reliance as armor → to chosen vulnerability as strength.",
  };
}

function demoBackstory(c: any) {
  return {
    childhood: c.childhood || `Grew up moving often. Learned to read rooms before reading books.`,
    defining_wound: c.defining_wound || c.wound || "At twelve, made a promise they could not keep.",
    formative_relationship: c.formative_relationship || "A grandparent who told the truth even when it hurt.",
    biggest_loss: c.biggest_loss || "A friend who chose another road and never returned the call.",
    biggest_shame: c.biggest_shame || "Standing silent the one time it would have cost something to speak.",
    life_before_story: c.life_before_story || "Stable on paper. Quietly drowning.",
    lies_about: c.lies_about || "How fine they really are.",
    never_says_aloud: c.never_says_aloud || "That they still wait for that one call.",
  };
}

function demoTMH(c: any) {
  return {
    tmh_baseline: c.tmh_baseline ?? 5,
    tmh_stress: c.tmh_stress ?? 2,
    tmh_aspirational: c.tmh_aspirational ?? 7,
    tmh_shadow: c.tmh_shadow ?? 2,
    moral_wound: c.moral_wound || "Was punished for telling the truth.",
    moral_blind_spot: c.moral_blind_spot || "Mistakes loyalty for goodness.",
    core_temptation: c.core_temptation || "To take the shortcut and call it pragmatism.",
    core_virtue: c.core_virtue || "Quiet courage in small moments.",
    core_vice: c.core_vice || "Cold pride dressed as boundaries.",
    moral_test: c.moral_test || "Will they protect a stranger at the cost of someone they love?",
    what_they_justify: c.what_they_justify || "Withholding a truth that would only wound the listener.",
    would_never_do: c.would_never_do || "Harm a child, even to save themselves.",
    might_do_under_pressure: c.might_do_under_pressure || "Break a promise to keep a bigger one.",
    redemption_path: c.redemption_path || "Telling the truth out loud, to the person who most needs it.",
    corruption_path: c.corruption_path || "Convincing themselves the rules don't apply to them anymore.",
  };
}

function demoVoice(c: any) {
  return {
    voice_summary: c.voice_summary || "Spare, observational, dryly funny — never wastes a word.",
    vocabulary_level: c.vocabulary_level || "Plainspoken with occasional precision when the stakes rise.",
    sentence_rhythm: c.sentence_rhythm || "Short. Short. Long, when avoiding something.",
    directness_level: c.directness_level || "High in small talk, low in feeling.",
    emotional_openness: c.emotional_openness || "Closed by default, surgical when it opens.",
    favorite_phrases: c.favorite_phrases || "“Sure.” / “That tracks.” / “Let me think about it.”",
    forbidden_phrases: c.forbidden_phrases || "“I love you” unless they mean it like a knife.",
    how_they_lie: c.how_they_lie || "By telling a smaller truth and walking away.",
    how_they_apologize: c.how_they_apologize || "By doing something useful without naming it.",
    how_they_threaten: c.how_they_threaten || "Calmly, with a smile and a fact.",
    subtext_pattern: c.subtext_pattern || "Says the question, means the answer.",
    silence_pattern: c.silence_pattern || "Goes quiet right before they decide.",
    voice_archetype: c.voice_archetype || "The Quiet Strategist",
    humor_style: c.humor_style || "Dry, observational, slightly cruel.",
  };
}

function demoVisualPrompt(c: any) {
  const desc = c.visual_description || "a watchful figure in muted neutrals";
  return `Cinematic portrait of ${c.name}, ${c.age || "adult"}, ${c.role || "character"} — ${desc}. ${c.costume_notes || ""}. Soft Rembrandt lighting, shallow depth of field, 85mm lens, film grain, color palette ${c.color_palette || "charcoal and warm gold"}. Quiet, layered, contradictory presence. No text, no logos.`;
}

export const generateFullCharacter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AiInput.parse(d))
  .handler(async ({ data, context }) => {
    const c = await loadOwnedCharacter(context, data.characterId);
    const prompt = `Build a complete character profile for "${c.name}". Return JSON with keys: role, age, archetype, summary, external_goal, internal_need, wound, fear, secret, contradiction, core_lie, voice_style, speech_patterns, visual_description, costume_notes, character_arc. Keep each value short and cinematic. Context:\n${characterContext(c)}`;
    const ai = await callJson<Record<string, string>>(prompt);
    const patch = ai ?? demoFullProfile(c);
    const { data: row, error } = await context.supabase.from("characters").update(patch).eq("id", c.id).select().single();
    if (error) throw new Error(error.message);
    return { row, demo: !ai };
  });

export const generateBackstory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AiInput.parse(d))
  .handler(async ({ data, context }) => {
    const c = await loadOwnedCharacter(context, data.characterId);
    const prompt = `Write the backstory for ${c.name}. Return JSON with keys: childhood, defining_wound, formative_relationship, biggest_loss, biggest_shame, life_before_story, lies_about, never_says_aloud. Context:\n${characterContext(c)}`;
    const ai = await callJson<Record<string, string>>(prompt);
    const patch = ai ?? demoBackstory(c);
    const { data: row } = await context.supabase.from("characters").update(patch).eq("id", c.id).select().single();
    return { row, demo: !ai };
  });

export const generateTMHProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AiInput.parse(d))
  .handler(async ({ data, context }) => {
    const c = await loadOwnedCharacter(context, data.characterId);
    const prompt = `Build a TMH moral profile for ${c.name}. Return JSON with keys (numbers 1-9 for the levels): tmh_baseline, tmh_stress, tmh_aspirational, tmh_shadow, moral_wound, moral_blind_spot, core_temptation, core_virtue, core_vice, moral_test, what_they_justify, would_never_do, might_do_under_pressure, redemption_path, corruption_path. Context:\n${characterContext(c)}`;
    const ai = await callJson<Record<string, any>>(prompt);
    const patch = ai ?? demoTMH(c);
    const { data: row } = await context.supabase.from("characters").update(patch).eq("id", c.id).select().single();
    return { row, demo: !ai };
  });

export const generateDialogueVoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AiInput.parse(d))
  .handler(async ({ data, context }) => {
    const c = await loadOwnedCharacter(context, data.characterId);
    const prompt = `Design the dialogue voice for ${c.name}. Return JSON with keys: voice_summary, vocabulary_level, sentence_rhythm, directness_level, emotional_openness, favorite_phrases, forbidden_phrases, how_they_lie, how_they_apologize, how_they_threaten, subtext_pattern, silence_pattern, voice_archetype, humor_style. Context:\n${characterContext(c)}`;
    const ai = await callJson<Record<string, string>>(prompt);
    const patch = ai ?? demoVoice(c);
    const { data: row } = await context.supabase.from("characters").update(patch).eq("id", c.id).select().single();
    return { row, demo: !ai };
  });

export const generateVisualPrompt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AiInput.parse(d))
  .handler(async ({ data, context }) => {
    const c = await loadOwnedCharacter(context, data.characterId);
    const ai = await callText(`Write a cinematic single-paragraph image-generation prompt for a portrait of ${c.name}. Visual: ${c.visual_description ?? ""}. Costume: ${c.costume_notes ?? ""}. Tone should reveal character. No text, no logos.`);
    const prompt = ai ?? demoVisualPrompt(c);
    const { data: row } = await context.supabase.from("characters").update({ image_prompt: prompt }).eq("id", c.id).select().single();
    return { row, demo: !ai };
  });

export const runMoralPressureTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AiInput.parse(d))
  .handler(async ({ data, context }) => {
    const c = await loadOwnedCharacter(context, data.characterId);
    const ai = await callText(`Design three escalating moral pressure scenarios for ${c.name}. For each: setup, choice, predicted TMH level (1-9), reasoning. Context:\n${characterContext(c)}`);
    return { text: ai ?? `Three pressure tests for ${c.name}:\n\n1) Low pressure — A friend asks for a small favor that breaks a small rule. Predicted TMH: ${c.tmh_baseline ?? 5}. They take the safe path that protects the relationship.\n\n2) Medium pressure — A stranger needs help that costs them visible status. Predicted TMH: ${(c.tmh_baseline ?? 5) - 1}. They hesitate; pride wins by inches.\n\n3) High pressure — Someone they love is in danger if they don't lie to a person they respect. Predicted TMH: ${c.tmh_stress ?? 2}. They lie. They tell themselves it was love.`, demo: !ai };
  });

export const analyzeCharacterArc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AiInput.parse(d))
  .handler(async ({ data, context }) => {
    const c = await loadOwnedCharacter(context, data.characterId);
    const ai = await callJson<Record<string, string>>(`Map ${c.name}'s arc. Return JSON: starting_belief, ending_belief, starting_behavior, ending_behavior, act1_state, act2_pressure, midpoint_shift, dark_night_state, climax_choice, final_image. Context:\n${characterContext(c)}`);
    const patch = ai ?? {
      starting_belief: c.starting_belief || "If I stay in control, nobody else gets hurt.",
      ending_belief: c.ending_belief || "Letting people in is not the same as losing.",
      starting_behavior: c.starting_behavior || "Withholds.",
      ending_behavior: c.ending_behavior || "Asks for what they need.",
      act1_state: c.act1_state || "Functional armor.",
      act2_pressure: c.act2_pressure || "Armor cracks under a cost they didn't expect.",
      midpoint_shift: c.midpoint_shift || "Realizes the rule they live by is the rule that's killing them.",
      dark_night_state: c.dark_night_state || "Briefly chooses the old self — and loses something irreversible.",
      climax_choice: c.climax_choice || "Chooses honesty in the worst possible moment.",
      final_image: c.final_image || "Sitting beside someone, finally quiet, not alone.",
    };
    const { data: row } = await context.supabase.from("characters").update(patch).eq("id", c.id).select().single();
    return { row, demo: !ai };
  });

const TestDialogueInput = z.object({ characterId: z.string().uuid(), scenario: z.string().min(1).max(2000) });
export const testDialogue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => TestDialogueInput.parse(d))
  .handler(async ({ data, context }) => {
    const c = await loadOwnedCharacter(context, data.characterId);
    const ai = await callText(`Write 5-8 lines of dialogue for ${c.name} in this scenario: "${data.scenario}". Stay strictly in their voice. Include subtext. Context:\n${characterContext(c)}`);
    return { text: ai ?? `${c.name.toUpperCase()}\n(measured)\nThat's not the question, is it.\n\n${c.name.toUpperCase()} (CONT'D)\nLet me think about it.`, demo: !ai };
  });

export const findContradictions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AiInput.parse(d))
  .handler(async ({ data, context }) => {
    const c = await loadOwnedCharacter(context, data.characterId);
    const ai = await callText(`Audit ${c.name}'s profile for internal contradictions, voice/TMH mismatches, and continuity warnings. List concise bullets. Context:\n${characterContext(c)}`);
    return { text: ai ?? `• Voice ("${c.voice_style ?? "—"}") reads more open than internal need ("${c.internal_need ?? "—"}") suggests.\n• TMH baseline (${c.tmh_baseline ?? "—"}) vs. core_vice ("${c.core_vice ?? "—"}") may be reading too virtuous; raise stakes in Act 2.\n• Add at least one concrete behavioral detail — current profile leans abstract.`, demo: !ai };
  });

export const suggestSceneUse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AiInput.parse(d))
  .handler(async ({ data, context }) => {
    const c = await loadOwnedCharacter(context, data.characterId);
    const { data: scenes = [] } = await context.supabase
      .from("scenes").select("title, scene_heading, emotional_purpose, plot_purpose")
      .eq("project_id", c.project_id).order("order_index").limit(20);
    const sceneList = (scenes ?? []).map((s: any, i: number) => `${i + 1}. ${s.title || s.scene_heading || "Untitled"} — ${s.plot_purpose ?? ""}`).join("\n");
    const ai = await callText(`Suggest 3 scenes from this project where ${c.name} would be transformative. For each: which scene, what they do, what changes. Scenes:\n${sceneList}\n\nCharacter:\n${characterContext(c)}`);
    return { text: ai ?? `Three scenes where ${c.name} earns their place:\n• Open with their refusal — establish the armor in motion.\n• Mid-script confrontation — let the wound do the talking.\n• Final scene — the quiet decision nobody else sees.`, demo: !ai };
  });

// ============= Portrait generation =============

export const generatePortrait = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AiInput.parse(d))
  .handler(async ({ data, context }) => {
    const c = await loadOwnedCharacter(context, data.characterId);
    const key = process.env.LOVABLE_API_KEY;
    if (!key) {
      // No-op demo: just stamp a placeholder URL we can show as “coming soon”
      return { row: c, demo: true, message: "AI image not configured — connect Lovable AI to generate portraits." };
    }
    const prompt = c.image_prompt || demoVisualPrompt(c);
    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-image-preview",
          prompt,
          n: 1,
        }),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(`Image gen failed (${res.status}): ${t.slice(0, 160)}`);
      }
      const json: any = await res.json();
      const b64 = json?.data?.[0]?.b64_json;
      const url = json?.data?.[0]?.url;
      let portraitUrl: string | null = null;
      if (b64) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        const path = `${c.project_id}/characters/${c.id}.png`;
        const { error: upErr } = await supabaseAdmin.storage
          .from("storyboards")
          .upload(path, bytes, { contentType: "image/png", upsert: true });
        if (upErr) throw new Error(upErr.message);
        const { data: signed } = await supabaseAdmin.storage
          .from("storyboards").createSignedUrl(path, 60 * 60 * 24 * 30);
        portraitUrl = signed?.signedUrl ?? null;
      } else if (url) {
        portraitUrl = url;
      }
      const { data: row } = await context.supabase
        .from("characters").update({ portrait_url: portraitUrl, image_prompt: prompt })
        .eq("id", c.id).select().single();
      return { row, demo: false };
    } catch (e: any) {
      throw new Error(e?.message ?? "Portrait generation failed");
    }
  });

// ============= List characters for a project (for autocomplete) =============
const ListInput = z.object({ projectId: z.string().uuid() });
export const listProjectCharacters = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ListInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("characters")
      .select("id, name, role, archetype, summary")
      .eq("project_id", data.projectId)
      .order("name");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
