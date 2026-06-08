// Pure helpers — decide the most likely next block type after Enter,
// and the Tab cycle order. Kept tiny so it's trivially testable.

export const TAB_CYCLE = [
  "scene_heading",
  "action",
  "character",
  "dialogue",
  "parenthetical",
  "transition",
  "shot",
] as const;

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

export function cycleType(current: string, dir: 1 | -1 = 1): string {
  const idx = TAB_CYCLE.indexOf(current as any);
  if (idx === -1) return "action";
  const len = TAB_CYCLE.length;
  return TAB_CYCLE[(idx + dir + len) % len];
}
