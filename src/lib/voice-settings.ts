// Shared ElevenLabs model + voice tuning used by BOTH the in-builder
// character voice preview (voice-preview.functions.ts) and the table read
// generator (tableread.functions.ts). Keeping these in one module means the
// clip a writer approves during the "Preview voice" step is the exact same
// voice + prosody that plays back during the performance — no drift between
// audition and final read.
export const TABLE_READ_MODEL_ID = "eleven_multilingual_v2";

export const TABLE_READ_VOICE_SETTINGS = {
  stability: 0.5,
  similarity_boost: 0.75,
  style: 0.35,
  use_speaker_boost: true,
} as const;
