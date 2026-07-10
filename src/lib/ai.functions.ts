import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { consumeUsage, recordUsage } from "@/lib/usage.functions";
import { modelForTier, tierFromPriceId, type Tier } from "@/lib/entitlements";
import { serverStripeEnv } from "@/lib/stripeEnv.server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

// Per-call hard ceilings — prevents a runaway single request from
// draining a month of tokens. Tuned per tool.
const MAX_OUTPUT_TOKENS_ASSIST = 1024;
const MAX_OUTPUT_TOKENS_PITCH = 4096;

async function tierForUser(supabase: SupabaseClient, userId: string): Promise<Tier> {
  const environment = serverStripeEnv();
  const { data: row } = await supabase
    .from("subscriptions")
    .select("price_id, status, current_period_end")
    .eq("user_id", userId)
    .eq("environment", environment)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!row) return "free";
  const periodOk =
    !row.current_period_end ||
    new Date(row.current_period_end as string).getTime() > Date.now();
  const active =
    (["active", "trialing", "past_due"].includes(row.status as string) && periodOk) ||
    (row.status === "canceled" && periodOk);
  return active ? tierFromPriceId(row.price_id as string | null) : "free";
}

const Input = z.object({
  projectId: z.string().uuid(),
  tool: z.string().min(1).max(64),
  prompt: z.string().min(1).max(8000),
  context: z.string().max(20000).optional(),
});

const SYSTEM = `You are SceneSmith AI, a master screenwriter and story consultant.
You help with professional screenplay writing: loglines, outlines, characters, scene construction, dialogue, subtext, tension, rewrites, and pitch materials.
Follow Hollywood screenplay conventions. Be specific, cinematic, and visual. Avoid clichés. Keep responses tight and useful.`;

const TOOL_PROMPTS: Record<string, string> = {
  "Generate logline": "Write 3 distinct loglines (25-40 words each). Format: numbered list.",
  "Build outline": "Build a beat-by-beat outline using the Save the Cat structure. 15 beats. Each beat: title + 2 sentence description.",
  "Create character": "Create a full character profile with: name, role, age, archetype, external goal, internal need, wound, secret, fear, contradiction, voice, visual description.",
  "Rewrite selected scene": "Rewrite the scene below with stronger visual writing, sharper dialogue, and clearer dramatic intent. Preserve plot and characters.",
  "Make dialogue sharper": "Rewrite the dialogue to be sharper, more subtextual, less on-the-nose. Cut unnecessary words.",
  "Add subtext": "Rewrite the dialogue so characters say one thing and mean another. Reveal character through indirection.",
  "Make scene more visual": "Rewrite emphasizing what we see and hear. Replace exposition with action and image. Show, don't tell.",
  "Reduce exposition": "Rewrite to eliminate on-the-nose exposition. Convey backstory through behavior and conflict.",
  "Increase tension": "Rewrite raising the stakes, adding ticking clocks, complications, or conflicting wants. Tighten pacing.",
  "Find plot holes": "Analyze the script for plot holes, inconsistencies, motivation gaps, and continuity issues. List with severity.",
  "Summarize scene": "Summarize the scene in 2 sentences. Then list: emotional purpose, plot purpose, conflict, reversal.",
  "Create storyboard prompt": "Write a vivid, cinematic image-generation prompt for the key shot of this scene. Include: composition, lighting, mood, camera angle, color palette, style.",
};

export const aiAssist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI not configured");

    const { data: p, error: pe } = await context.supabase
      .from("projects").select("id").eq("id", data.projectId).maybeSingle();
    if (pe || !p) throw new Error("Project not found");

    // Meter monthly AI assists. Throws USAGE_LIMIT when the tier cap is reached.
    await consumeUsage(context.supabase, "ai_assists", 1);


    const gateway = createLovableAiGatewayProvider(key);
    const toolGuidance = TOOL_PROMPTS[data.tool] ?? "";
    const prompt = [
      toolGuidance && `Tool guidance: ${toolGuidance}`,
      data.context && `Context:\n${data.context}`,
      `Request: ${data.prompt}`,
    ].filter(Boolean).join("\n\n");

    try {
      const { text } = await generateText({
        model: gateway("google/gemini-3-flash-preview"),
        system: SYSTEM,
        prompt,
      });

      await context.supabase.from("ai_requests").insert({
        user_id: context.userId,
        project_id: data.projectId,
        request_type: data.tool,
        input: { prompt: data.prompt },
        output: { text },
        status: "ok",
      });

      return { text };
    } catch (err: any) {
      const msg = String(err?.message ?? err);
      if (msg.includes("429")) throw new Error("Rate limit reached. Please try again shortly.");
      if (msg.includes("402")) throw new Error("AI credits exhausted. Add credits in workspace settings.");
      throw new Error("AI request failed");
    }
  });

const PitchInput = z.object({ projectId: z.string().uuid() });

const PITCH_SYSTEM = `You are SceneSmith AI generating a complete pitch package for a screenplay. Output STRICT JSON with these keys:
logline, short_synopsis, one_page_synopsis, treatment, character_bible, tone_statement, comparables, target_audience, budget_tier, poster_prompt, trailer_vo, pitch_email.
Each value is a string. Be specific, cinematic, and pitch-ready. No markdown fences, just JSON.`;

export const generatePitchPackage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => PitchInput.parse(d))
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI not configured");

    const { data: project } = await context.supabase.from("projects").select("*").eq("id", data.projectId).maybeSingle();
    if (!project) throw new Error("Project not found");

    // Pitch generation is a heavier call — bills as 10 AI assists.
    await consumeUsage(context.supabase, "ai_assists", 10);


    const { data: characters = [] } = await context.supabase.from("characters").select("name, role, archetype, external_goal, internal_need, wound").eq("project_id", data.projectId);
    const { data: blocks = [] } = await context.supabase.from("script_blocks").select("block_type, content").eq("project_id", data.projectId).order("order_index").limit(800);

    const script = (blocks ?? []).filter((b: any) => b.block_type !== "note").map((b: any) => `[${b.block_type}] ${b.content}`).join("\n").slice(0, 12000);
    const chars = (characters ?? []).map((c: any) => `${c.name} — ${c.role ?? ""} (${c.archetype ?? ""})`).join("\n");

    const gateway = createLovableAiGatewayProvider(key);
    const { text } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      system: PITCH_SYSTEM,
      prompt: `Title: ${project.title}\nType: ${project.project_type}\nGenre: ${project.genre ?? ""}\nTone: ${project.tone ?? ""}\nLogline: ${project.logline ?? ""}\n\nCharacters:\n${chars}\n\nScript excerpt:\n${script}`,
    });

    let parsed: any = {};
    try { parsed = JSON.parse(text.replace(/^```json\s*|\s*```$/g, "")); } catch { parsed = { treatment: text }; }

    const row = {
      project_id: data.projectId,
      logline: parsed.logline ?? null,
      short_synopsis: parsed.short_synopsis ?? null,
      one_page_synopsis: parsed.one_page_synopsis ?? null,
      treatment: parsed.treatment ?? null,
      character_bible: parsed.character_bible ?? null,
      tone_statement: parsed.tone_statement ?? null,
      comparables: parsed.comparables ?? null,
      target_audience: parsed.target_audience ?? null,
      budget_tier: parsed.budget_tier ?? null,
      poster_prompt: parsed.poster_prompt ?? null,
      trailer_vo: parsed.trailer_vo ?? null,
      pitch_email: parsed.pitch_email ?? null,
      generated_at: new Date().toISOString(),
    };

    const { data: existing } = await context.supabase.from("pitch_packages").select("id").eq("project_id", data.projectId).maybeSingle();
    if (existing) {
      await context.supabase.from("pitch_packages").update(row).eq("project_id", data.projectId);
    } else {
      await context.supabase.from("pitch_packages").insert(row);
    }
    return row;
  });
