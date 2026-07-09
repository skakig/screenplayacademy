import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { generateText, Output, NoObjectGeneratedError } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import type { VaultSceneRow } from "./schemas";

const WARNING_CATEGORIES = [
  "timeline_contradiction",
  "motivation_mismatch",
  "emotional_continuity",
  "duplicated_beat",
  "premature_reveal",
  "missing_setup",
  "payoff_opportunity",
] as const;

const PlacementSchema = z.object({
  suggestions: z
    .array(
      z.object({
        act: z.enum(["act_1", "act_2a", "midpoint", "act_2b", "act_3"]),
        beforeSceneId: z.string().nullable(),
        afterSceneId: z.string().nullable(),
        rationale: z.string(),
        confidence: z.number().min(0).max(1),
      }),
    )
    .max(5),
});

const CheckSchema = z.object({
  warnings: z
    .array(
      z.object({
        category: z.enum(WARNING_CATEGORIES),
        severity: z.enum(["info", "warn", "block"]),
        message: z.string(),
      }),
    )
    .max(12),
  summary: z.string(),
});

async function loadContext(supabase: any, projectId: string) {
  const [scenesRes, charsRes] = await Promise.all([
    supabase
      .from("scenes")
      .select("id, title, scene_heading, order_index, plot_purpose, emotional_purpose")
      .eq("project_id", projectId)
      .order("order_index", { ascending: true })
      .limit(60),
    supabase
      .from("characters")
      .select("id, name, role, want, need, wound")
      .eq("project_id", projectId)
      .limit(30),
  ]);
  return {
    scenes: (scenesRes.data ?? []) as Array<Record<string, unknown>>,
    characters: (charsRes.data ?? []) as Array<Record<string, unknown>>,
  };
}

export const suggestPlacement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ vaultSceneId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI not configured");

    const { data: vault, error } = await context.supabase
      .from("vault_scenes")
      .select("*")
      .eq("id", data.vaultSceneId)
      .single();
    if (error || !vault) throw new Error(error?.message ?? "Vault scene not found");
    const v = vault as VaultSceneRow;

    const ctx = await loadContext(context.supabase, v.project_id);
    const gateway = createLovableAiGatewayProvider(key);

    const prompt = `You are a screenplay story editor. Suggest where this vault scene fits best in the timeline.

VAULT SCENE:
Title: ${v.title}
Kind: ${v.kind}
Tone: ${v.emotional_tone ?? "—"}
Estimated position (writer's guess): ${v.estimated_position}
Tags: ${v.tags.join(", ") || "—"}
Content:
${v.content.slice(0, 3000)}

EXISTING SCENES (id, order, heading, purpose):
${ctx.scenes.map((s: any) => `- [${s.id}] #${s.order_index} ${s.scene_heading ?? s.title ?? ""} | ${s.plot_purpose ?? ""}`).join("\n") || "(none yet)"}

CHARACTERS:
${ctx.characters.map((c: any) => `- ${c.name} (${c.role ?? "?"}): wants ${c.want ?? "?"}`).join("\n") || "(none)"}

Return up to 3 placement suggestions ordered best-first. For each, choose the act, and either afterSceneId (paste an existing id) or beforeSceneId. Use null for the other. Confidence between 0 and 1. Rationale in 1-2 sentences.`;

    try {
      const { output } = await generateText({
        model: gateway("google/gemini-3-flash-preview"),
        output: Output.object({ schema: PlacementSchema }),
        prompt,
      });
      return output;
    } catch (err) {
      if (NoObjectGeneratedError.isInstance(err)) {
        return { suggestions: [] };
      }
      throw err;
    }
  });

export const integrationCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        vaultSceneId: z.string().uuid(),
        destination: z.enum(["act_1", "act_2a", "midpoint", "act_2b", "act_3", "custom"]),
        referenceSceneId: z.string().uuid().optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI not configured");

    const { data: vault, error } = await context.supabase
      .from("vault_scenes")
      .select("*")
      .eq("id", data.vaultSceneId)
      .single();
    if (error || !vault) throw new Error(error?.message ?? "Vault scene not found");
    const v = vault as VaultSceneRow;

    const ctx = await loadContext(context.supabase, v.project_id);
    const gateway = createLovableAiGatewayProvider(key);

    const prompt = `You are a screenplay continuity editor. The writer wants to integrate this vault scene into the timeline.

DESTINATION: ${data.destination}${data.referenceSceneId ? ` (relative to scene ${data.referenceSceneId})` : ""}

VAULT SCENE:
Title: ${v.title}
Tone: ${v.emotional_tone ?? "—"}
Tags: ${v.tags.join(", ") || "—"}
Content:
${v.content.slice(0, 3000)}

EXISTING SCENES (in order):
${ctx.scenes.map((s: any) => `- #${s.order_index} ${s.scene_heading ?? s.title ?? ""} | purpose: ${s.plot_purpose ?? "—"} | tone: ${s.emotional_purpose ?? "—"}`).join("\n") || "(none)"}

CHARACTERS:
${ctx.characters.map((c: any) => `- ${c.name} (${c.role ?? "?"}): wants ${c.want ?? "?"}, wound: ${c.wound ?? "?"}`).join("\n") || "(none)"}

Return warnings if you see any of: timeline_contradiction, motivation_mismatch, emotional_continuity, duplicated_beat, premature_reveal, missing_setup, payoff_opportunity. Severity: info | warn | block. Also include a one-sentence overall summary. If everything looks clean, return an empty warnings array and a positive summary.`;

    try {
      const { output } = await generateText({
        model: gateway("google/gemini-3-flash-preview"),
        output: Output.object({ schema: CheckSchema }),
        prompt,
      });
      return output;
    } catch (err) {
      if (NoObjectGeneratedError.isInstance(err)) {
        return { warnings: [], summary: "Could not analyze — proceed with caution." };
      }
      throw err;
    }
  });
