/**
 * Authorship palette — deterministic, muted color assignment for Arena.
 *
 * Design goals (per user spec):
 *   - Restrained. Colors are orientation, not decoration.
 *   - Consistent per writer within a round (session-local).
 *   - Muted OKLCH tokens that look integrated with the screenplay page,
 *     never a kindergarten spreadsheet.
 *   - Deterministic: same (sessionId, userId) always yields the same slot,
 *     so the rail color survives refreshes and reorderings.
 *
 * We pick from a fixed 8-slot palette by hashing (sessionId | userId) and
 * distributing writers across the slots. Judges/viewers get a neutral slot.
 */

export interface AuthorshipColor {
  /** Border rail color — the 3px vertical stripe. */
  rail: string;
  /** Very light background tint for the card. */
  tint: string;
  /** Foreground color for the initials chip. */
  chip: string;
  /** Text color that pairs with the chip. */
  chipFg: string;
}

/**
 * Muted palette in OKLCH. Fixed L/C, hue rotated for perceptual spacing.
 * Lightness ~0.62 keeps the rail visible against both light and dark
 * backgrounds; chroma 0.11 stays quiet next to screenplay type.
 */
const RAIL_LC = { L: 0.62, C: 0.11 };
const TINT_LC = { L: 0.96, C: 0.02 };
const CHIP_LC = { L: 0.72, C: 0.09 };
const HUES = [12, 48, 96, 152, 196, 232, 276, 322] as const;

/** Neutral slot for judges, viewers, and blind entries. */
export const NEUTRAL_AUTHORSHIP_COLOR: AuthorshipColor = {
  rail: `oklch(0.72 0.02 260)`,
  tint: `oklch(0.97 0.005 260 / 0.6)`,
  chip: `oklch(0.86 0.02 260)`,
  chipFg: `oklch(0.28 0.02 260)`,
};

function colorForHue(hue: number): AuthorshipColor {
  return {
    rail: `oklch(${RAIL_LC.L} ${RAIL_LC.C} ${hue})`,
    tint: `oklch(${TINT_LC.L} ${TINT_LC.C} ${hue} / 0.55)`,
    chip: `oklch(${CHIP_LC.L} ${CHIP_LC.C} ${hue})`,
    chipFg: `oklch(0.25 0.04 ${hue})`,
  };
}

/** Fast, stable 32-bit hash. */
function hash(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/**
 * Deterministic color for one writer within one session.
 * We hash to a slot, then rehash with a salt if the slot collides with an
 * earlier writer in the ordered list — keeps the palette perceptually spaced
 * for the small groups Arena actually hosts.
 */
export function buildAuthorshipPalette(
  sessionId: string,
  orderedUserIds: string[],
): Map<string, AuthorshipColor> {
  const out = new Map<string, AuthorshipColor>();
  const taken = new Set<number>();
  for (const uid of orderedUserIds) {
    if (!uid || out.has(uid)) continue;
    let slot = hash(`${sessionId}:${uid}`) % HUES.length;
    let salt = 0;
    while (taken.has(slot) && taken.size < HUES.length) {
      salt += 1;
      slot = hash(`${sessionId}:${uid}:${salt}`) % HUES.length;
    }
    taken.add(slot);
    out.set(uid, colorForHue(HUES[slot]));
  }
  return out;
}

export function initialsFor(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "??";
  const parts = trimmed.split(/\s+/).slice(0, 2);
  return parts
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("")
    .padEnd(1, "?")
    .slice(0, 2);
}
