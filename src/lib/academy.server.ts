import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const SYSTEM = `You are SceneSmith AI, a master screenwriter coaching beginners.
Be encouraging, clear, practical, and professional. Never childish. Never academic.
Output cinematic, specific, usable craft. Keep answers tight unless told otherwise.`;

export async function callAI(prompt: string, opts?: { system?: string }): Promise<{ text: string; demo: boolean }> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) {
    return { text: "(Demo output — add credits or wait for AI to come online.)", demo: true };
  }
  try {
    const gateway = createLovableAiGatewayProvider(key);
    const { text } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      system: opts?.system ?? SYSTEM,
      prompt,
    });
    return { text, demo: false };
  } catch (err: any) {
    const msg = String(err?.message ?? err);
    if (msg.includes("429")) throw new Error("Rate limit reached. Please try again shortly.");
    if (msg.includes("402")) throw new Error("AI credits exhausted. Add credits in workspace settings.");
    throw new Error("AI request failed");
  }
}

export const GUIDED_STEPS = [
  { step_key: "create_project", title: "Create your project", output_type: "project" },
  { step_key: "logline", title: "Write your logline", output_type: "logline" },
  { step_key: "protagonist", title: "Create your protagonist", output_type: "character" },
  { step_key: "antagonist", title: "Create your antagonist", output_type: "character" },
  { step_key: "theme", title: "Define your theme", output_type: "theme" },
  { step_key: "story_arc", title: "Build your story arc", output_type: "story_arc" },
  { step_key: "scene_cards", title: "Create scene cards", output_type: "scenes" },
  { step_key: "opening_scene", title: "Write the opening scene", output_type: "script" },
  { step_key: "act1", title: "Finish Act 1", output_type: "script" },
  { step_key: "midpoint", title: "Build the midpoint", output_type: "story_arc" },
  { step_key: "rough_draft", title: "Finish the rough draft", output_type: "script" },
  { step_key: "table_read", title: "Run a table read", output_type: "audio" },
  { step_key: "pitch", title: "Generate your pitch package", output_type: "pitch" },
] as const;
