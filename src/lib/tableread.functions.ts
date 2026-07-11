import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireFeature } from "@/lib/entitlements.functions";
import { consumeUsage } from "@/lib/usage.functions";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

const Input = z.object({
  projectId: z.string().uuid(),
  sceneId: z.string().uuid().optional(),
  voiceMap: z.record(z.string(), z.string()).default({}),
  narrator: z.boolean().default(true),
  sfx: z.boolean().default(false),
});

const SignInput = z.object({ audioAssetId: z.string().uuid() });

// Default ElevenLabs voices (allow-listed from the docs)
const DEFAULT_NARRATOR = "JBFqnCBsd6RMkjVDRZzb"; // George
const FALLBACK_VOICES = [
  "EXAVITQu4vr4xnSDxMaL", // Sarah
  "TX3LPaxmHKxFdv7VOQHJ", // Liam
  "Xb7hH8MSUJpSbSDYk0k2", // Alice
  "IKne3meq5aSn9XLyUdCD", // Charlie
  "cgSgspJ2msm6clMCkdW9", // Jessica
  "N2lVS1w4EtoT3dr4eOWO", // Callum
  "pFZP5JQG7iQjIQuC4Bku", // Lily
  "onwK4e9ZLuTAKqWW03F9", // Daniel
];

type Line = { voiceId: string; text: string; speaker: string };

async function ttsLine(apiKey: string, voiceId: string, text: string, previous?: string, next?: string) {
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        previous_text: previous,
        next_text: next,
        voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.35, use_speaker_boost: true },
      }),
    },
  );
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`ElevenLabs TTS failed (${res.status}): ${err.slice(0, 200)}`);
  }
  return new Uint8Array(await res.arrayBuffer());
}

export const generateTableRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    const { supabase, userId } = context;
    await requireFeature(supabase, userId, "table_read");


    const { data: project } = await supabase
      .from("projects")
      .select("id, title, user_id")
      .eq("id", data.projectId)
      .maybeSingle();
    if (!project) throw new Error("Project not found");

    // Persist any voice assignments back onto characters so they stick
    for (const [characterId, voiceId] of Object.entries(data.voiceMap)) {
      if (voiceId && voiceId.trim().length > 0) {
        await supabase
          .from("characters")
          .update({ elevenlabs_voice_id: voiceId.trim() })
          .eq("id", characterId)
          .eq("project_id", data.projectId);
      }
    }

    // Load script blocks. We DON'T filter by scene_id in the query — many
    // projects have script_blocks.scene_id unpopulated (the editor doesn't
    // assign it yet), which would silently return zero lines. Instead we
    // load all blocks ordered, then slice by scene heading below.
    const { data: blocks } = await supabase
      .from("script_blocks")
      .select("id, block_type, content, scene_id, order_index")
      .eq("project_id", data.projectId)
      .order("order_index");

    // If a scene is selected, slice the block range: from the matching
    // scene_heading block up to (but not including) the next scene_heading.
    let scopedBlocks = blocks ?? [];
    if (data.sceneId && scopedBlocks.length > 0) {
      const { data: targetScene } = await supabase
        .from("scenes")
        .select("scene_heading, title")
        .eq("id", data.sceneId)
        .maybeSingle();

      // Prefer an exact scene_id match when the editor did populate it.
      const byId = scopedBlocks.filter((b) => b.scene_id === data.sceneId);
      if (byId.length > 0) {
        scopedBlocks = byId;
      } else if (targetScene) {
        const norm = (s: string) => s.trim().toUpperCase().replace(/\s+/g, " ");
        const targetHeading = norm(targetScene.scene_heading || targetScene.title || "");
        const startIdx = scopedBlocks.findIndex(
          (b) => b.block_type === "scene_heading" && norm(String(b.content ?? "")) === targetHeading,
        );
        if (startIdx >= 0) {
          const rest = scopedBlocks.slice(startIdx + 1);
          const nextHeadingRel = rest.findIndex((b) => b.block_type === "scene_heading");
          const endIdx = nextHeadingRel === -1 ? scopedBlocks.length : startIdx + 1 + nextHeadingRel;
          scopedBlocks = scopedBlocks.slice(startIdx, endIdx);
        }
        // If we couldn't find the heading, fall through and perform the
        // full script — better than throwing "nothing to perform".
      }
    }

    const { data: characters } = await supabase
      .from("characters")
      .select("id, name, elevenlabs_voice_id")
      .eq("project_id", data.projectId);

    // Build voice-id resolver keyed by uppercase character name
    const charByName = new Map<string, { id: string; voiceId: string | null }>();
    (characters ?? []).forEach((c) => {
      charByName.set((c.name || "").trim().toUpperCase(), {
        id: c.id,
        voiceId: data.voiceMap[c.id] || c.elevenlabs_voice_id || null,
      });
    });

    // Round-robin fallback voice assignment for unknown speakers
    const assignedFallback = new Map<string, string>();
    let fallbackIdx = 0;
    const pickVoiceForSpeaker = (name: string): string => {
      const key = name.trim().toUpperCase();
      const known = charByName.get(key);
      if (known?.voiceId) return known.voiceId;
      if (assignedFallback.has(key)) return assignedFallback.get(key)!;
      const v = FALLBACK_VOICES[fallbackIdx % FALLBACK_VOICES.length];
      fallbackIdx++;
      assignedFallback.set(key, v);
      return v;
    };

    // Walk blocks → ordered lines
    const lines: Line[] = [];
    let currentSpeaker: string | null = null;
    for (const b of scopedBlocks) {
      const content = String(b.content ?? "").trim();
      if (!content) continue;
      switch (b.block_type) {
        case "scene_heading":
          if (data.narrator) lines.push({ voiceId: DEFAULT_NARRATOR, text: content.toUpperCase(), speaker: "NARRATOR" });
          currentSpeaker = null;
          break;
        case "action":
        case "shot":
        case "transition":
          if (data.narrator) lines.push({ voiceId: DEFAULT_NARRATOR, text: content, speaker: "NARRATOR" });
          break;
        case "character":
          currentSpeaker = content;
          break;
        case "dialogue":
          if (currentSpeaker) {
            lines.push({ voiceId: pickVoiceForSpeaker(currentSpeaker), text: content, speaker: currentSpeaker });
          } else if (data.narrator) {
            lines.push({ voiceId: DEFAULT_NARRATOR, text: content, speaker: "NARRATOR" });
          }
          break;
        case "parenthetical":
          // Skip parentheticals from spoken output by default — they're stage direction.
          break;
        case "note":
          // Notes never appear in spoken output (matches editor export rule).
          break;
        default:
          if (data.narrator) lines.push({ voiceId: DEFAULT_NARRATOR, text: content, speaker: "NARRATOR" });
      }
    }

    if (lines.length === 0) {
      throw new Error("Nothing to perform — add scene headings, action, or dialogue first.");
    }

    // Estimate spoken minutes at ~150 wpm and consume that from the monthly
    // cap up-front — this way we never burn ElevenLabs credits for an
    // over-quota user. Rounded up, minimum 1 minute per run.
    const totalWords = lines.reduce((s, l) => s + l.text.split(/\s+/).filter(Boolean).length, 0);
    const estimatedMinutes = Math.max(1, Math.ceil(totalWords / 150));
    await consumeUsage(supabase, "tableread_minutes", estimatedMinutes);

    // ElevenLabs bills per character — meter that directly BEFORE any TTS
    // call so an over-quota user can't drain the character pool via a
    // long dialogue run that squeaks under the minutes cap.
    const totalCharacters = lines.reduce((s, l) => s + l.text.length, 0);
    if (totalCharacters > 0) {
      await consumeUsage(supabase, "tts_characters", totalCharacters);
    }



    // Create a pending row up front so the UI shows progress and we get an id
    const { data: pendingRow, error: insertErr } = await supabase
      .from("audio_assets")
      .insert({
        project_id: data.projectId,
        scene_id: data.sceneId ?? null,
        kind: "table_read",
        voice_map: Object.fromEntries(
          [...charByName.entries()].map(([name, v]) => [name, v.voiceId ?? null]),
        ) as any,
        status: "generating",
      })
      .select()
      .single();
    if (insertErr || !pendingRow) throw new Error(insertErr?.message ?? "Could not create audio asset");

    if (!apiKey) {
      await supabaseAdmin
        .from("audio_assets")
        .update({ status: "coming_soon" })
        .eq("id", pendingRow.id);
      return {
        id: pendingRow.id,
        status: "coming_soon" as const,
        message: "AI voices aren't connected yet. Once the studio is wired up, hit Generate again.",
      };
    }

    try {
      // Sequentially TTS each line with prosody stitching context
      const chunks: Uint8Array[] = [];
      for (let i = 0; i < lines.length; i++) {
        const prev = lines[i - 1]?.text;
        const next = lines[i + 1]?.text;
        const buf = await ttsLine(apiKey, lines[i].voiceId, lines[i].text, prev, next);
        chunks.push(buf);
      }

      // Concatenate MP3 frames
      const total = chunks.reduce((s, c) => s + c.byteLength, 0);
      const merged = new Uint8Array(total);
      let off = 0;
      for (const c of chunks) { merged.set(c, off); off += c.byteLength; }

      const path = `${userId}/${data.projectId}/${pendingRow.id}.mp3`;
      const { error: upErr } = await supabaseAdmin.storage
        .from("table-reads")
        .upload(path, merged, { contentType: "audio/mpeg", upsert: true });
      if (upErr) throw new Error(`Upload failed: ${upErr.message}`);

      const { data: signed } = await supabaseAdmin.storage
        .from("table-reads")
        .createSignedUrl(path, 60 * 60 * 24 * 7); // 7 days

      const approxSeconds = Math.max(2, Math.round(lines.reduce((s, l) => s + l.text.split(/\s+/).length, 0) / 2.5));

      const { data: updated } = await supabaseAdmin
        .from("audio_assets")
        .update({
          status: "ready",
          audio_url: signed?.signedUrl ?? null,
          duration_seconds: approxSeconds,
        })
        .eq("id", pendingRow.id)
        .select()
        .single();

      return { ...updated, status: "ready" as const };
    } catch (e: any) {
      await supabaseAdmin
        .from("audio_assets")
        .update({ status: "failed" })
        .eq("id", pendingRow.id);
      throw new Error(e?.message ?? "Table read generation failed");
    }
  });

// Re-sign a stored table read so the player keeps working past the original 7-day window.
export const refreshTableReadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SignInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row } = await supabase
      .from("audio_assets")
      .select("id, project_id")
      .eq("id", data.audioAssetId)
      .maybeSingle();
    if (!row) throw new Error("Not found");
    const path = `${userId}/${row.project_id}/${row.id}.mp3`;
    const { data: signed, error } = await supabaseAdmin.storage
      .from("table-reads")
      .createSignedUrl(path, 60 * 60 * 24 * 7);
    if (error || !signed?.signedUrl) throw new Error(error?.message ?? "Could not sign URL");
    await supabaseAdmin
      .from("audio_assets")
      .update({ audio_url: signed.signedUrl })
      .eq("id", row.id);
    return { url: signed.signedUrl };
  });
