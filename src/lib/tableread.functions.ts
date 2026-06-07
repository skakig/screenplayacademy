import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const Input = z.object({
  projectId: z.string().uuid(),
  sceneId: z.string().uuid().optional(),
  voiceMap: z.record(z.string(), z.string()).default({}),
  narrator: z.boolean().default(true),
  sfx: z.boolean().default(false),
});

// Generate an AI table read. Requires ELEVENLABS_API_KEY; returns a graceful coming_soon state when missing.
export const generateTableRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.ELEVENLABS_API_KEY;

    const { data: p } = await context.supabase.from("projects").select("id").eq("id", data.projectId).maybeSingle();
    if (!p) throw new Error("Project not found");

    if (!apiKey) {
      const { data: inserted } = await context.supabase.from("audio_assets").insert({
        project_id: data.projectId,
        scene_id: data.sceneId ?? null,
        kind: "table_read",
        voice_map: data.voiceMap,
        status: "coming_soon",
      }).select().single();
      return { ...inserted, message: "AI table reads are a Pro feature. Coming soon." };
    }

    // Placeholder: actual ElevenLabs stitching omitted in MVP.
    const { data: inserted } = await context.supabase.from("audio_assets").insert({
      project_id: data.projectId,
      scene_id: data.sceneId ?? null,
      kind: "table_read",
      voice_map: data.voiceMap,
      status: "queued",
    }).select().single();
    return inserted;
  });
