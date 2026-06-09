// Typological transfer distance between supported languages.
// Each axis is 0 (identical/very close) .. 3 (very distant).
//   script     — writing system (Latin vs Cyrillic etc.)
//   morphology — inflection / case / agreement complexity gap
//   syntax     — word order, articles, clause structure
//   lexicon    — shared vocabulary base
// Sum is a coarse but practical proxy for "how much will L1 help me?".
//
// Numbers are linguist-informed approximations, not measured corpora. They
// are deliberately conservative — tune as we learn from real writers.

import type { LanguageCode } from "./types";
import { SUPPORTED_LANGUAGES } from "./types";

export type Axis = "script" | "morphology" | "syntax" | "lexicon";
export type DistanceBreakdown = Record<Axis, number>;

// Symmetric pair → breakdown. Lookup is order-independent.
type PairKey = `${LanguageCode}|${LanguageCode}`;

const PAIRS: Partial<Record<PairKey, DistanceBreakdown>> = {
  // Romance cluster
  "es|pt": { script: 0, morphology: 1, syntax: 0, lexicon: 0 },
  "es|it": { script: 0, morphology: 1, syntax: 1, lexicon: 1 },
  "es|fr": { script: 0, morphology: 1, syntax: 1, lexicon: 1 },
  "pt|it": { script: 0, morphology: 1, syntax: 1, lexicon: 1 },
  "pt|fr": { script: 0, morphology: 1, syntax: 1, lexicon: 1 },
  "fr|it": { script: 0, morphology: 1, syntax: 1, lexicon: 1 },

  // Germanic
  "en|de": { script: 0, morphology: 2, syntax: 2, lexicon: 1 },

  // English ↔ Romance — high lexical overlap via French/Latin loans
  "en|fr": { script: 0, morphology: 1, syntax: 1, lexicon: 1 },
  "en|es": { script: 0, morphology: 2, syntax: 1, lexicon: 2 },
  "en|it": { script: 0, morphology: 2, syntax: 1, lexicon: 2 },
  "en|pt": { script: 0, morphology: 2, syntax: 1, lexicon: 2 },

  // German ↔ Romance — moderate
  "de|fr": { script: 0, morphology: 2, syntax: 2, lexicon: 2 },
  "de|es": { script: 0, morphology: 2, syntax: 2, lexicon: 2 },
  "de|it": { script: 0, morphology: 2, syntax: 2, lexicon: 2 },
  "de|pt": { script: 0, morphology: 2, syntax: 2, lexicon: 2 },

  // Slavic cluster
  "uk|ru": { script: 0, morphology: 1, syntax: 1, lexicon: 1 },
  "pl|uk": { script: 1, morphology: 1, syntax: 1, lexicon: 1 },
  "pl|ru": { script: 1, morphology: 1, syntax: 1, lexicon: 2 },

  // Slavic ↔ Germanic/Romance — distant
  "en|pl": { script: 0, morphology: 3, syntax: 2, lexicon: 3 },
  "en|uk": { script: 1, morphology: 3, syntax: 2, lexicon: 3 },
  "en|ru": { script: 1, morphology: 3, syntax: 2, lexicon: 3 },
  "de|pl": { script: 0, morphology: 3, syntax: 2, lexicon: 3 },
  "de|uk": { script: 1, morphology: 3, syntax: 2, lexicon: 3 },
  "de|ru": { script: 1, morphology: 3, syntax: 2, lexicon: 3 },
  "fr|pl": { script: 0, morphology: 3, syntax: 2, lexicon: 3 },
  "fr|uk": { script: 1, morphology: 3, syntax: 2, lexicon: 3 },
  "fr|ru": { script: 1, morphology: 3, syntax: 2, lexicon: 3 },
  "es|pl": { script: 0, morphology: 3, syntax: 2, lexicon: 3 },
  "es|uk": { script: 1, morphology: 3, syntax: 2, lexicon: 3 },
  "es|ru": { script: 1, morphology: 3, syntax: 2, lexicon: 3 },
  "pt|pl": { script: 0, morphology: 3, syntax: 2, lexicon: 3 },
  "pt|uk": { script: 1, morphology: 3, syntax: 2, lexicon: 3 },
  "pt|ru": { script: 1, morphology: 3, syntax: 2, lexicon: 3 },
  "it|pl": { script: 0, morphology: 3, syntax: 2, lexicon: 3 },
  "it|uk": { script: 1, morphology: 3, syntax: 2, lexicon: 3 },
  "it|ru": { script: 1, morphology: 3, syntax: 2, lexicon: 3 },
};

const MAX: DistanceBreakdown = { script: 1, morphology: 3, syntax: 2, lexicon: 3 };
const ZERO: DistanceBreakdown = { script: 0, morphology: 0, syntax: 0, lexicon: 0 };

function lookup(a: LanguageCode, b: LanguageCode): DistanceBreakdown | undefined {
  return PAIRS[`${a}|${b}` as PairKey] ?? PAIRS[`${b}|${a}` as PairKey];
}

/** Per-axis distance. Same language → all zeros. Unknown pair → conservative max. */
export function transferBreakdown(a: LanguageCode, b: LanguageCode): DistanceBreakdown {
  if (a === b) return { ...ZERO };
  return lookup(a, b) ?? { ...MAX };
}

/** Single-number distance (sum of axes). Lower = closer = better bridge. */
export function transferDistance(a: LanguageCode, b: LanguageCode): number {
  const d = transferBreakdown(a, b);
  return d.script + d.morphology + d.syntax + d.lexicon;
}

/**
 * Pick the language from `known` that is typologically closest to `target`.
 * Returns null when `known` is empty. If the target itself is known, returns it.
 */
export function nearestBridge(
  known: LanguageCode[],
  target: LanguageCode,
): LanguageCode | null {
  if (known.length === 0) return null;
  if (known.includes(target)) return target;
  let best = known[0];
  let bestDist = transferDistance(best, target);
  for (let i = 1; i < known.length; i++) {
    const d = transferDistance(known[i], target);
    if (d < bestDist) { best = known[i]; bestDist = d; }
  }
  return best;
}

export { SUPPORTED_LANGUAGES };
