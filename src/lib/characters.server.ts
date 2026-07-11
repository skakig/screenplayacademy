import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const SYSTEM = `You are SceneSmith AI, a story consultant and character architect.
You design layered, contradictory, cinematic characters with depth. Avoid clichés.
TMH ("The Moral Heuristic") describes moral behavior under pressure on a 1-9 scale:
1 Survival, 2 Self-Interest, 3 Social Contract, 4 Fairness/Justice, 5 Empathy,
6 Altruism, 7 Integrity, 8 Virtue, 9 Transcendence. Use these as behavior bands, not judgment.
When asked for JSON, return STRICT JSON only — no prose, no markdown fences.`;

export async function callJson<T = any>(prompt: string): Promise<T | null> {
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

export async function callText(prompt: string): Promise<string | null> {
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

export async function loadOwnedCharacter(ctx: any, id: string) {
  const { data, error } = await ctx.supabase.from("characters").select("*").eq("id", id).maybeSingle();
  if (error || !data) throw new Error("Character not found");
  return data;
}

export function sanitizeCharacterPatch(patch: Record<string, any>) {
  const clean: Record<string, any> = { ...patch };
  delete clean.id;
  delete clean.created_at;
  delete clean.updated_at;
  delete clean.project_id;

  if (clean.moral_pressure && !clean.act2_pressure) clean.act2_pressure = clean.moral_pressure;
  delete clean.moral_pressure;

  return clean;
}

export function characterContext(c: any): string {
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

export const DEP_TABLES = [
  "character_relationships",
  "character_scene_states",
  "character_scene_arc_states",
  "character_arcs",
  "character_evidence_events",
  "character_snapshots",
] as const;

export async function snapshotForIds(ctx: any, ids: string[]) {
  const idList = ids.join(",");
  const [chars, rels, scenes, sceneArcs, arcs, evidence, snaps] = await Promise.all([
    ctx.supabase.from("characters").select("*").in("id", ids),
    ctx.supabase.from("character_relationships").select("*").or(
      `character_id.in.(${idList}),related_character_id.in.(${idList})`,
    ),
    ctx.supabase.from("character_scene_states").select("*").in("character_id", ids),
    ctx.supabase.from("character_scene_arc_states").select("*").in("character_id", ids),
    ctx.supabase.from("character_arcs").select("*").in("character_id", ids),
    ctx.supabase.from("character_evidence_events").select("*").in("character_id", ids),
    ctx.supabase.from("character_snapshots").select("*").in("character_id", ids),
  ]);
  return {
    characters: chars.data ?? [],
    character_relationships: rels.data ?? [],
    character_scene_states: scenes.data ?? [],
    character_scene_arc_states: sceneArcs.data ?? [],
    character_arcs: arcs.data ?? [],
    character_evidence_events: evidence.data ?? [],
    character_snapshots: snaps.data ?? [],
  };
}

export async function cascadeDelete(ctx: any, ids: string[]) {
  await ctx.supabase.from("character_relationships").delete().in("character_id", ids);
  await ctx.supabase.from("character_relationships").delete().in("related_character_id", ids);
  await ctx.supabase.from("character_scene_states").delete().in("character_id", ids);
  await ctx.supabase.from("character_scene_arc_states").delete().in("character_id", ids);
  await ctx.supabase.from("character_arcs").delete().in("character_id", ids);
  await ctx.supabase.from("character_evidence_events").delete().in("character_id", ids);
  await ctx.supabase.from("character_snapshots").delete().in("character_id", ids);
}

function pick<T>(arr: T[], i: number): T { return arr[Math.abs(i) % arr.length]; }

function seedFrom(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

export function demoFullProfile(c: any) {
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

export function demoBackstory(c: any) {
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

export function demoTMH(c: any) {
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

export function demoVoice(c: any) {
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

export function demoVisualPrompt(c: any) {
  const desc = c.visual_description || "a watchful figure in muted neutrals";
  return `Cinematic portrait of ${c.name}, ${c.age || "adult"}, ${c.role || "character"} — ${desc}. ${c.costume_notes || ""}. Soft Rembrandt lighting, shallow depth of field, 85mm lens, film grain, color palette ${c.color_palette || "charcoal and warm gold"}. Quiet, layered, contradictory presence. No text, no logos.`;
}