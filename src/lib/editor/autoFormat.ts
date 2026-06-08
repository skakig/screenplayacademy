// Detect a block type from the user's typed text. Returns null if no rule fires.
// Conservative — only fire when the signal is strong enough that a writer
// would want the format change.

export function detectBlockType(text: string): string | null {
  const t = text.trim();
  if (!t) return null;

  // Scene headings
  if (/^(INT\.|EXT\.|INT\/EXT\.|I\/E\.|EST\.)/i.test(t)) return "scene_heading";

  // Transitions
  if (/^(FADE (IN|OUT)|CUT TO:|DISSOLVE TO:|SMASH CUT|MATCH CUT|JUMP CUT)/i.test(t))
    return "transition";

  // Parenthetical
  if (/^\(.*\)?$/.test(t)) return "parenthetical";

  // Character cue: short, all-caps, no terminal punctuation, no leading
  // article — only fire if the text is long enough to be meaningful.
  if (t.length >= 2 && t.length <= 38 && /^[A-Z][A-Z0-9 .'\-]{1,37}$/.test(t) && !/[.!?]$/.test(t)) {
    return "character";
  }

  return null;
}

// Friendly label used in the "auto-formatted as ___" toast.
export const BLOCK_LABEL: Record<string, string> = {
  scene_heading: "Scene Heading",
  action: "Action",
  character: "Character",
  dialogue: "Dialogue",
  parenthetical: "Parenthetical",
  transition: "Transition",
  shot: "Shot",
  note: "Note",
};
