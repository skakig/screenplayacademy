import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

const Input = z.object({
  projectId: z.string().uuid(),
  characterId: z.string().uuid(),
  line: z.string().min(1).max(2000),
  context: z.string().max(4000).optional(),
});

const SYSTEM = `You are a screenplay dialogue coach analyzing whether a single line of dialogue stays in a character's established voice.
You will be given:
- the character profile (voice style, register, vocabulary)
- a sample of their prior lines (their established voice)
- one candidate line to evaluate

Reply with STRICT JSON only — no markdown — in this shape:
{
  "drift_score": 0-100,            // 0 = perfectly in voice, 100 = totally off
  "verdict": "in_voice" | "slightly_off" | "off_voice",
  "reason": "<one short sentence>",
  "suggestion": "<a rewritten version of the line in this character's voice, or empty string if the line is in voice>"
}`;

export const voiceCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI not configured");

    const { data: character } = await context.supabase
      .from("characters")
      .select("name, role, archetype, voice_summary, voice_style, vocabulary_level, sentence_rhythm, directness_level, favorite_phrases, forbidden_phrases, project_id")
      .eq("id", data.characterId)
      .maybeSingle();
    if (!character || character.project_id !== data.projectId) {
      throw new Error("Character not found in this project");
    }

    // Gather prior lines for this character from the manuscript.
    const { data: priorBlocks = [] } = await context.supabase
      .from("script_blocks")
      .select("block_type, content, order_index")
      .eq("project_id", data.projectId)
      .order("order_index", { ascending: true })
      .limit(2000);

    const priorLines: string[] = [];
    let lastSpeaker: string | null = null;
    for (const b of priorBlocks ?? []) {
      if (b.block_type === "character") {
        lastSpeaker = (b.content || "").trim().toUpperCase();
      } else if (b.block_type === "dialogue" && lastSpeaker) {
        if (lastSpeaker === (character.name || "").toUpperCase()) {
          priorLines.push(b.content || "");
        }
      }
    }
    const sample = priorLines.slice(-12).map((l, i) => `${i + 1}. ${l}`).join("\n");

    const profile = [
      `Name: ${character.name}`,
      character.role && `Role: ${character.role}`,
      character.archetype && `Archetype: ${character.archetype}`,
      character.voice_summary && `Voice: ${character.voice_summary}`,
      character.voice_style && `Voice style: ${character.voice_style}`,
      character.vocabulary_level && `Vocabulary: ${character.vocabulary_level}`,
      character.sentence_rhythm && `Sentence rhythm: ${character.sentence_rhythm}`,
      character.directness_level && `Directness: ${character.directness_level}`,
      character.favorite_phrases && `Often says: ${character.favorite_phrases}`,
      character.forbidden_phrases && `Never says: ${character.forbidden_phrases}`,
    ].filter(Boolean).join("\n");

    const prompt = [
      `Character profile:\n${profile}`,
      sample ? `Prior lines:\n${sample}` : "No prior lines yet — judge from profile.",
      data.context ? `Scene context:\n${data.context}` : "",
      `Candidate line:\n"""${data.line}"""`,
    ].filter(Boolean).join("\n\n");

    try {
      const gateway = createLovableAiGatewayProvider(key);
      const { text } = await generateText({
        model: gateway("google/gemini-3-flash-preview"),
        system: SYSTEM,
        prompt,
      });
      const cleaned = text.replace(/^```json\s*|\s*```$/g, "").trim();
      let parsed: any;
      try { parsed = JSON.parse(cleaned); } catch {
        return { drift_score: 0, verdict: "in_voice", reason: "Could not analyze", suggestion: "" };
      }
      return {
        drift_score: Math.max(0, Math.min(100, Number(parsed.drift_score) || 0)),
        verdict: parsed.verdict ?? "in_voice",
        reason: String(parsed.reason ?? ""),
        suggestion: String(parsed.suggestion ?? ""),
      };
    } catch (err: any) {
      const msg = String(err?.message ?? err);
      if (msg.includes("429")) throw new Error("Rate limit reached. Try again shortly.");
      if (msg.includes("402")) throw new Error("AI credits exhausted.");
      throw new Error("Voice check failed");
    }
  });
