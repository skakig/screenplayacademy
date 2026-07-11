import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const DEFAULT_VOICE = "JBFqnCBsd6RMkjVDRZzb"; // George

const Input = z.object({
  characterId: z.string().uuid(),
  voiceId: z.string().optional(),
  text: z.string().max(300).optional(),
});

function sampleLine(name: string, voiceSummary?: string | null) {
  const n = (name || "").trim() || "This character";
  if (voiceSummary && voiceSummary.trim().length > 8) {
    const snippet = voiceSummary.trim().replace(/\s+/g, " ").slice(0, 140);
    return `I'm ${n}. ${snippet}`;
  }
  return `I'm ${n}. Listen close — this is how I sound in the room.`;
}

export const previewCharacterVoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return { configured: false as const };
    }
    const { supabase } = context;
    const { data: ch, error } = await supabase
      .from("characters")
      .select("id, name, voice_summary, elevenlabs_voice_id, project_id")
      .eq("id", data.characterId)
      .maybeSingle();
    if (error || !ch) throw new Error("Character not found");

    const voiceId = (data.voiceId || ch.elevenlabs_voice_id || DEFAULT_VOICE).trim();
    const text = (data.text && data.text.trim().length > 0
      ? data.text.trim()
      : sampleLine(ch.name || "", ch.voice_summary)
    ).slice(0, 280);

    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.35,
            use_speaker_boost: true,
          },
        }),
      },
    );
    if (!res.ok) {
      const err = await res.text().catch(() => "");
      throw new Error(`Voice preview failed (${res.status}): ${err.slice(0, 200)}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    return {
      configured: true as const,
      voiceId,
      text,
      audioBase64: buf.toString("base64"),
      mime: "audio/mpeg",
    };
  });
