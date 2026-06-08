// Pure screenplay keymap helpers. No React, no DOM.
// Centralizes Enter transitions, Tab cycling, and Shift+Enter soft-break rules
// so the editor lab and production editor share identical behavior.

export const TAB_CYCLE = [
  "scene_heading",
  "action",
  "character",
  "dialogue",
  "parenthetical",
  "transition",
  "shot",
  "note",
] as const;

export type BlockType = (typeof TAB_CYCLE)[number];

/**
 * What kind of block should be created when the writer presses Enter
 * from `current` (knowing the previous block was `prev`).
 *
 * Mirrors the table in docs/SCREENPLAY_EDITOR_CONTRACT.md.
 */
export function nextBlockTypeAfter(current: string, prev?: string): string {
  switch (current) {
    case "scene_heading":
      return "action";
    case "action":
      return "action";
    case "character":
      return "dialogue";
    case "dialogue":
      // After dialogue, most common next is another character speaking,
      // unless the previous block was action (then back to action).
      return prev === "action" ? "action" : "character";
    case "parenthetical":
      return "dialogue";
    case "transition":
      return "scene_heading";
    case "shot":
      return "action";
    case "note":
      return "action";
    default:
      return "action";
  }
}

/** Cycle block type forward (dir=1) or backward (dir=-1) through TAB_CYCLE. */
export function cycleType(current: string, dir: 1 | -1 = 1): string {
  const idx = TAB_CYCLE.indexOf(current as BlockType);
  if (idx === -1) return "action";
  const len = TAB_CYCLE.length;
  return TAB_CYCLE[(idx + dir + len) % len];
}

/**
 * Whether Shift+Enter should insert a soft newline inside the current block
 * instead of creating a new block.
 */
export function allowsSoftNewline(current: string): boolean {
  return current === "action" || current === "note";
}
