// Shared between client + server. Keep beat keys aligned with SceneBeatPicker.
export const STORY_BEATS_KEYS = [
  "setup",
  "inciting",
  "rising",
  "midpoint",
  "crisis",
  "climax",
  "resolution",
] as const;

export type StoryBeatKey = (typeof STORY_BEATS_KEYS)[number];

export const STORY_BEAT_LABELS: Record<StoryBeatKey, string> = {
  setup: "Setup",
  inciting: "Inciting",
  rising: "Rising",
  midpoint: "Midpoint",
  crisis: "Crisis",
  climax: "Climax",
  resolution: "Resolution",
};
