import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const Input = z.object({
  projectId: z.string().uuid(),
  tool: z.string().min(1).max(64),
  prompt: z.string().min(1).max(8000),
  context: z.string().max(20000).optional(),
});

const SYSTEM = `You are SceneSmith AI, a master screenwriter and story consultant.
You help with professional screenplay writing: loglines, outlines, characters, scene construction, dialogue, subtext, tension, rewrites, and pitch materials.
Follow Hollywood screenplay conventions. Be specific, cinematic, and visual. Avoid clichés. Keep responses tight and useful.`;

export const aiAssist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI not configured");

    // verify ownership
    const { data: p, error: pe } = await context.supabase
      .from("projects").select("id").eq("id", data.projectId).maybeSingle();
    if (pe || !p) throw new Error("Project not found");

    const gateway = createLovableAiGatewayProvider(key);
    const prompt = data.context
      ? `Tool: ${data.tool}\n\nContext:\n${data.context}\n\nRequest:\n${data.prompt}`
      : `Tool: ${data.tool}\n\nRequest:\n${data.prompt}`;

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
