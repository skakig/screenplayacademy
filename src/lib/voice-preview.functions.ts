import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { consumeUsage } from "@/lib/usage.functions";
import { z } from "zod";
import { createHash } from "crypto";

const Input = z.object({
  characterId: z.string().uuid(),
  text: z.string().min(1).max(500).optional(),
});

const MODEL_ID = "eleven_multilingual_v2";
const VOICE_SETTINGS = {
  stability: 0.5,
  similarity_boost: 0.75,
  style: 0.35,
  use_speaker_boost: true,
};
// Bump when generation params change to invalidate old cached clips.
const CACHE_VERSION = "v1";
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour

function buildGreeting(name?: string | null, role?: string | null) {
  const n = (name ?? "").trim() || "This character";
  const r = (role ?? "").trim();
  return r
    ? `Hi, I'm ${n}. ${r}. Here's a taste of how I sound before the table read.`
    : `Hi, I'm ${n}. Here's a taste of how I sound before the table read.`;
}

/**
 * Generate (or return a cached) voice preview clip for a character.
 *
 * Caching model:
 *   - Cache key = sha256(version | voiceId | modelId | settings | text).
 *   - Clips stored at voice-previews/<userId>/<hash>.mp3 (private bucket).
 *   - Repeated requests for the same voice + text skip ElevenLabs entirely
 *     and just re-sign the existing object, so playback is instant and
 *     doesn't consume tts credits a second time.
 */
export const previewCharacterVoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: character, error: charErr } = await supabase
      .from("characters")
      .select("id, name, role, elevenlabs_voice_id, project_id")
      .eq("id", data.characterId)
      .maybeSingle();
    if (charErr) throw new Error(charErr.message);
    if (!character) throw new Error("Character not found");

    const voiceId = (character as any).elevenlabs_voice_id as string | null;
    if (!voiceId) {
      return { ok: false as const, reason: "no_voice" as const };
    }

    const text = (data.text ?? buildGreeting(character.name, (character as any).role)).trim();
    if (!text) return { ok: false as const, reason: "empty_text" as const };

    const settingsKey = JSON.stringify(VOICE_SETTINGS);
    const hash = createHash("sha256")
      .update(`${CACHE_VERSION}|${voiceId}|${MODEL_ID}|${settingsKey}|${text}`)
      .digest("hex");
    const path = `${userId}/${hash}.mp3`;

    const signAndReturn = async (cached: boolean) => {
      const { data: signed, error: signErr } = await supabase.storage
        .from("voice-previews")
        .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
      if (signErr || !signed?.signedUrl) {
        throw new Error(signErr?.message ?? "Could not sign voice preview URL");
      }
      return {
        ok: true as const,
        cached,
        url: signed.signedUrl,
        path,
        hash,
        voiceId,
        text,
      };
    };

    // Cache probe — list the single object at this exact path.
    const { data: existing } = await supabase.storage
      .from("voice-previews")
      .list(userId, { search: `${hash}.mp3`, limit: 1 });
    if (existing && existing.some((f) => f.name === `${hash}.mp3`)) {
      return signAndReturn(true);
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return { ok: false as const, reason: "not_configured" as const };
    }

    // Meter before hitting the paid provider.
    try {
      await consumeUsage(supabase, "tts_characters", text.length);
    } catch (e: any) {
      return { ok: false as const, reason: "quota" as const, message: e?.message };
    }

    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ text, model_id: MODEL_ID, voice_settings: VOICE_SETTINGS }),
      },
    );
    if (!res.ok) {
      const err = await res.text().catch(() => "");
      throw new Error(`ElevenLabs TTS failed (${res.status}): ${err.slice(0, 200)}`);
    }
    const bytes = new Uint8Array(await res.arrayBuffer());

    const { error: upErr } = await supabase.storage
      .from("voice-previews")
      .upload(path, bytes, { contentType: "audio/mpeg", upsert: true });
    if (upErr) throw new Error(upErr.message);

    return signAndReturn(false);
  });
