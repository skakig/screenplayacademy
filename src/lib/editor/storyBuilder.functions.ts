import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

const Input = z.object({
  projectId: z.string().uuid(),
  genre: z.string().max(120),
  protagonistWant: z.string().min(1).max(400),
  antagonistForce: z.string().min(1).max(400),
});

const SYSTEM = `You are SceneSmith AI helping a writer go from blank page to a working story spine.
Given a genre and the protagonist's want vs. the opposing force, generate a complete starter package.
Reply with STRICT JSON only — no markdown — in this shape:
{
  "logline": "<25-40 word logline>",
  "outline": [{"beat":"<name>","summary":"<1-2 sentences>"}],   // exactly 8 beats
  "characters": [
    {"name":"<NAME>","role":"protagonist|antagonist|ally|mentor|love_interest","archetype":"<one phrase>","want":"<one sentence>","need":"<one sentence>","wound":"<one sentence>"}
  ]                                                                // exactly 3 characters
}`;

export const generateStoryStarter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI not configured");

    const { data: project } = await context.supabase
      .from("projects").select("id, title").eq("id", data.projectId).maybeSingle();
    if (!project) throw new Error("Project not found");

    const gateway = createLovableAiGatewayProvider(key);
    const prompt = `Title: ${project.title}
Genre: ${data.genre}
Protagonist wants: ${data.protagonistWant}
Opposing force: ${data.antagonistForce}`;

    const { text } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      system: SYSTEM,
      prompt,
    });
    const cleaned = text.replace(/^```json\s*|\s*```$/g, "").trim();
    let parsed: any;
    try { parsed = JSON.parse(cleaned); } catch {
      throw new Error("AI returned malformed response — try again");
    }

    const logline: string = String(parsed.logline ?? "").slice(0, 400);
    const outline: Array<{ beat: string; summary: string }> = Array.isArray(parsed.outline)
      ? parsed.outline.slice(0, 8).map((b: any) => ({ beat: String(b.beat ?? ""), summary: String(b.summary ?? "") }))
      : [];
    const characters: Array<any> = Array.isArray(parsed.characters)
      ? parsed.characters.slice(0, 3)
      : [];

    // Persist the logline back to the project (only if empty).
    const { data: existing } = await context.supabase
      .from("projects").select("logline").eq("id", data.projectId).maybeSingle();
    if (existing && !existing.logline && logline) {
      await context.supabase.from("projects").update({ logline }).eq("id", data.projectId);
    }

    // Persist starter characters (skip names that already exist).
    const { data: existingChars = [] } = await context.supabase
      .from("characters").select("name").eq("project_id", data.projectId);
    const existingNames = new Set((existingChars ?? []).map((c: any) => String(c.name).trim().toLowerCase()));
    const charRows: Array<any> = [];
    for (const c of characters) {
      const name = String(c.name ?? "").trim();
      if (!name || existingNames.has(name.toLowerCase())) continue;
      charRows.push({
        project_id: data.projectId,
        name,
        role: c.role ?? null,
        archetype: c.archetype ?? null,
        external_goal: c.want ?? null,
        internal_need: c.need ?? null,
        wound: c.wound ?? null,
      });
    }
    if (charRows.length > 0) {
      await context.supabase.from("characters").insert(charRows);
    }

    // Persist a starter story arc with the outline as the central beats (best effort).
    if (outline.length > 0) {
      const { data: existingArc } = await context.supabase
        .from("story_arcs").select("id").eq("project_id", data.projectId).maybeSingle();
      const outlineSummary = outline.map((b, i) => `${i + 1}. ${b.beat} — ${b.summary}`).join("\n");
      if (!existingArc) {
        await context.supabase.from("story_arcs").insert({
          project_id: data.projectId,
          structure_model: "8-beat",
          central_question: `Will the protagonist overcome ${data.antagonistForce.slice(0, 200)}?`,
          opening_state: outline[0]?.summary ?? null,
          midpoint_shift: outline[3]?.summary ?? null,
          darkest_moment: outline[5]?.summary ?? null,
          climax_choice: outline[6]?.summary ?? null,
          final_state: outline[7]?.summary ?? null,
          theme: outlineSummary.slice(0, 4000),
        });
      }
    }

    return { logline, outline, characters_created: charRows.length };
  });
