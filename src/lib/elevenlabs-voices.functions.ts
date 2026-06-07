import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ElevenLabsVoice = {
  voice_id: string;
  name: string;
  category?: string;
  labels?: Record<string, string>;
  preview_url?: string;
};

// Module-scope in-memory cache (per server worker). 10 minute TTL.
let cache: { at: number; voices: ElevenLabsVoice[] } | null = null;
const TTL_MS = 10 * 60 * 1000;

// Curated fallback voices (always returned if no API key, plus merged at bottom of API list).
const FALLBACK: ElevenLabsVoice[] = [
  { voice_id: "JBFqnCBsd6RMkjVDRZzb", name: "George (Narrator)", category: "premade" },
  { voice_id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", category: "premade" },
  { voice_id: "TX3LPaxmHKxFdv7VOQHJ", name: "Liam", category: "premade" },
  { voice_id: "Xb7hH8MSUJpSbSDYk0k2", name: "Alice", category: "premade" },
  { voice_id: "IKne3meq5aSn9XLyUdCD", name: "Charlie", category: "premade" },
  { voice_id: "cgSgspJ2msm6clMCkdW9", name: "Jessica", category: "premade" },
  { voice_id: "N2lVS1w4EtoT3dr4eOWO", name: "Callum", category: "premade" },
  { voice_id: "pFZP5JQG7iQjIQuC4Bku", name: "Lily", category: "premade" },
  { voice_id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel", category: "premade" },
];

export const listElevenLabsVoices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const now = Date.now();
    if (cache && now - cache.at < TTL_MS) return { voices: cache.voices, cached: true };

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      cache = { at: now, voices: FALLBACK };
      return { voices: FALLBACK, cached: false };
    }

    try {
      const res = await fetch("https://api.elevenlabs.io/v2/voices?page_size=100", {
        headers: { "xi-api-key": apiKey },
      });
      if (!res.ok) throw new Error(`ElevenLabs ${res.status}`);
      const json: any = await res.json();
      const voices: ElevenLabsVoice[] = (json?.voices ?? []).map((v: any) => ({
        voice_id: v.voice_id,
        name: v.name,
        category: v.category,
        labels: v.labels,
        preview_url: v.preview_url,
      }));
      // Merge fallbacks not already present
      const have = new Set(voices.map((v) => v.voice_id));
      for (const f of FALLBACK) if (!have.has(f.voice_id)) voices.push(f);
      cache = { at: now, voices };
      return { voices, cached: false };
    } catch {
      cache = { at: now, voices: FALLBACK };
      return { voices: FALLBACK, cached: false };
    }
  });
