import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { TablesInsert } from "@/integrations/supabase/types";
import {
  DEP_TABLES,
  callJson,
  callText,
  cascadeDelete,
  characterContext,
  demoBackstory,
  demoFullProfile,
  demoTMH,
  demoVisualPrompt,
  demoVoice,
  loadOwnedCharacter,
  sanitizeCharacterPatch,
  snapshotForIds,
} from "./characters.server";

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
    const clean = sanitizeCharacterPatch(patch);
    if (id) {
      const { data: row, error } = await context.supabase
        .from("characters").update(clean).eq("id", id).select().single();
      if (error) throw new Error(error.message);
      return row;
    } else {
      const insertRow: TablesInsert<"characters"> = {
        ...clean,
        project_id,
        name: typeof clean.name === "string" && clean.name.trim() ? clean.name : "New Character",
      };
      const { data: row, error } = await context.supabase
        .from("characters").insert(insertRow).select().single();
      if (error) throw new Error(error.message);
      return row;
    }
  });

const IdInput = z.object({ id: z.string().uuid() });

export const deleteCharacter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => IdInput.parse(d))
  .handler(async ({ data, context }) => {
    const snapshot = await snapshotForIds(context, [data.id]);
    await cascadeDelete(context, [data.id]);
    const { error } = await context.supabase.from("characters").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true, deleted: 1, snapshot };
  });

const BulkDeleteInput = z.object({ ids: z.array(z.string().uuid()).min(1).max(500) });
export const bulkDeleteCharacters = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => BulkDeleteInput.parse(d))
  .handler(async ({ data, context }) => {
    const snapshot = await snapshotForIds(context, data.ids);
    await cascadeDelete(context, data.ids);
    const { error, count } = await context.supabase
      .from("characters").delete({ count: "exact" }).in("id", data.ids);
    if (error) throw new Error(error.message);
    return { ok: true, deleted: count ?? data.ids.length, snapshot };
  });

const RestoreInput = z.object({
  snapshot: z.object({
    characters: z.array(z.record(z.string(), z.any())).default([]),
    character_relationships: z.array(z.record(z.string(), z.any())).default([]),
    character_scene_states: z.array(z.record(z.string(), z.any())).default([]),
    character_scene_arc_states: z.array(z.record(z.string(), z.any())).default([]),
    character_arcs: z.array(z.record(z.string(), z.any())).default([]),
    character_evidence_events: z.array(z.record(z.string(), z.any())).default([]),
    character_snapshots: z.array(z.record(z.string(), z.any())).default([]),
  }),
});

export const restoreCharacters = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => RestoreInput.parse(d))
  .handler(async ({ data, context }) => {
    const { snapshot } = data;
    if (!snapshot.characters.length) return { restored: 0 };

    // Verify ownership of every project referenced by the character rows.
    const projectIds = Array.from(
      new Set(snapshot.characters.map((c: any) => c.project_id).filter(Boolean)),
    );
    if (projectIds.length) {
      const { data: owned, error: ownErr } = await context.supabase
        .from("projects").select("id").in("id", projectIds);
      if (ownErr) throw new Error(ownErr.message);
      const ownedIds = new Set((owned ?? []).map((p: any) => p.id));
      for (const pid of projectIds) {
        if (!ownedIds.has(pid)) throw new Error("Not allowed to restore into that project");
      }
    }

    // Characters first, then dependents (preserves foreign-key order).
    const { error: cErr } = await context.supabase
      .from("characters").upsert(snapshot.characters as any, { onConflict: "id", ignoreDuplicates: true });
    if (cErr) throw new Error(cErr.message);

    for (const table of DEP_TABLES) {
      const rows = (snapshot as any)[table] as any[];
      if (!rows?.length) continue;
      const { error } = await context.supabase
        .from(table).upsert(rows, { onConflict: "id", ignoreDuplicates: true });
      if (error) throw new Error(`${table}: ${error.message}`);
    }

    return { restored: snapshot.characters.length };
  });


export const getImageGenStatus = createServerFn({ method: "GET" })
  .handler(async () => {
    return { configured: !!process.env.LOVABLE_API_KEY };
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

const PortraitInput = z.object({
  characterId: z.string().uuid(),
  presetKey: z.string().optional(),
  rerollSeed: z.boolean().optional(),
});

export const generatePortrait = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => PortraitInput.parse(d))
  .handler(async ({ data, context }) => {
    const c = await loadOwnedCharacter(context, data.characterId);
    const key = process.env.LOVABLE_API_KEY;

    // Gate portrait generation against the user's monthly plan cap BEFORE
    // spending model credits. Throws USAGE_LIMIT when the cap is reached.
    const { consumeUsage } = await import("@/lib/usage.functions");
    try {
      await consumeUsage(context.supabase, "character_portraits", 1);
    } catch (e: any) {
      const msg = String(e?.message ?? "");
      if (msg.startsWith("USAGE_LIMIT")) {
        throw new Error(
          "Portrait generation limit reached for your plan this month. Upgrade or wait for next cycle.",
        );
      }
      throw e;
    }

    // Seed reuse for cross-take consistency. Keep the same seed unless the
    // caller asked to reroll or the character has never had a portrait.
    const existingSeed = Number((c as any).portrait_seed ?? 0);
    const seed =
      !data.rerollSeed && existingSeed > 0
        ? existingSeed
        : Math.floor(Math.random() * 2_000_000_000) + 1;

    // Compose deterministically from the full profile + selected cast style
    // preset so every character in the cast reads as one film.
    const { composePortraitPrompt } = await import("@/lib/characters/portraitPrompt");
    const { getCastStylePreset } = await import("@/lib/characters/castStylePresets");
    const { data: projectRow } = await context.supabase
      .from("projects").select("*").eq("id", c.project_id).maybeSingle();
    const meta = ((projectRow as any)?.metadata ?? {}) as Record<string, any>;
    const presetKey = data.presetKey || meta.cast_style_preset || "ultra_realistic";
    const preset = getCastStylePreset(presetKey);
    // Preset provides the baseline; project metadata.visual_style overrides individual fields.
    const style = { ...preset.contract, ...(meta.visual_style ?? {}) };
    let prompt = composePortraitPrompt(c as any, style);
    if (!prompt.trim()) {
      prompt = demoVisualPrompt(c);
    }
    // Append seed tag — image models honour it as a stability hint.
    prompt = `${prompt} Seed: ${seed}.`;
    await context.supabase
      .from("characters")
      .update({ image_prompt: prompt, portrait_seed: seed } as any)
      .eq("id", c.id);
    if (!key) {
      const { data: row } = await context.supabase
        .from("characters").select("*").eq("id", c.id).single();
      return { row, demo: true, configured: false, preset: preset.key, seed };
    }
    const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-2.5-flash-image-preview", prompt, n: 1 }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`Portrait generation failed (${res.status}): ${t.slice(0, 200) || res.statusText}`);
    }
    const json: any = await res.json().catch(() => ({}));
    const b64 = json?.data?.[0]?.b64_json;
    const url = json?.data?.[0]?.url;
    if (!b64 && !url) {
      throw new Error("Portrait generation returned no image data. Try again or refine the visual prompt.");
    }
    let portraitUrl: string | null = null;
    let portraitPath: string | null = null;
    if (b64) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const bytes = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
      // Path encodes seed + timestamp so regenerations remain uniquely
      // addressable and the browser doesn't serve the previous portrait.
      const path = `${c.project_id}/characters/${c.id}-${seed}-${Date.now()}.png`;
      const { error: upErr } = await supabaseAdmin.storage
        .from("storyboards")
        .upload(path, bytes, { contentType: "image/png", upsert: true });
      if (upErr) throw new Error(`Portrait upload failed: ${upErr.message}`);
      const { data: signed } = await supabaseAdmin.storage
        .from("storyboards").createSignedUrl(path, 60 * 60 * 24 * 30);
      portraitUrl = signed?.signedUrl ?? null;
      portraitPath = path;
    } else if (url) {
      portraitUrl = url;
    }
    if (!portraitUrl) {
      throw new Error("Portrait was generated but could not be stored. Please retry.");
    }
    const { data: row } = await context.supabase
      .from("characters")
      .update({
        portrait_url: portraitUrl,
        image_prompt: prompt,
        portrait_seed: seed,
        ...(portraitPath ? { portrait_path: portraitPath } : {}),
      } as any)
      .eq("id", c.id)
      .select()
      .single();
    return { row, demo: false, preset: preset.key, seed };
  });

// ============= Refresh portrait signed URL =============

const RefreshInput = z.object({ characterId: z.string().uuid() });

export const refreshPortraitUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => RefreshInput.parse(d))
  .handler(async ({ data, context }) => {
    const c = await loadOwnedCharacter(context, data.characterId);
    const path = (c as any).portrait_path as string | null;
    if (!path) return { url: (c as any).portrait_url ?? null, refreshed: false };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage
      .from("storyboards")
      .createSignedUrl(path, 60 * 60 * 24 * 30);
    if (error || !signed?.signedUrl) return { url: (c as any).portrait_url ?? null, refreshed: false };
    await context.supabase
      .from("characters")
      .update({ portrait_url: signed.signedUrl })
      .eq("id", c.id);
    return { url: signed.signedUrl, refreshed: true };
  });


// ============= Cast style preset (per project) =============

const CastStyleInput = z.object({
  projectId: z.string().uuid(),
  presetKey: z.string().min(1).max(64),
});

export const setCastStylePreset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CastStyleInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: project, error } = await context.supabase
      .from("projects").select("id, metadata").eq("id", data.projectId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!project) throw new Error("Project not found");
    const meta = { ...((project as any).metadata ?? {}), cast_style_preset: data.presetKey };
    const { error: upErr } = await context.supabase
      .from("projects").update({ metadata: meta } as any).eq("id", data.projectId);
    if (upErr) throw new Error(upErr.message);
    return { ok: true, presetKey: data.presetKey };
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
      .is("quarantined_at", null)
      .order("name");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
