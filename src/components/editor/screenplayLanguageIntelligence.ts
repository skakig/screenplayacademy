// Pure language intelligence — see docs/SCREENPLAY_LANGUAGE_INTELLIGENCE.md.
// No React, no DOM, no network. Safe to call from the hot typing path
// because callers only invoke it on Enter / blur / explicit moments.

export type LanguageContext = {
  blockType: string;
  prevBlockType?: string;
  /** Lowercased character names + aliases that must never be touched. */
  characterNames?: Set<string>;
  /** Lowercased project dictionary terms (locations, invented words, etc.). */
  projectDictionary?: Set<string>;
  /**
   * Lowercased "original" tokens the writer reverted after we auto-fixed
   * them. We never re-apply the same fix to the same original.
   */
  rejectedFixes?: Set<string>;
  language?: string;
};

export type AppliedFix = {
  kind: "capitalize_i" | "sentence_start";
  original: string;
  replacement: string;
};

export type LanguageDecision = {
  term: string;
  start: number;
  end: number;
  kind:
    | "unknown_term"
    | "character_candidate"
    | "location_candidate";
  confidence: "high" | "medium" | "low";
  reason: string;
};

const DICTIONARY_BLOCKLIST = new Set([
  // never offered as "unknown" — they're common words our basic dictionary misses
  "i","im","ive","ill","id","ok","okay","oh","ah","uh","hmm","yeah","yes","no",
]);

/**
 * Capitalize standalone English `i` and its contractions (i'm, i'll, i've, i'd).
 * Idempotent. Never touches `i` inside other words, Roman numerals, or non-
 * English text we don't fully understand.
 */
export function capitalizeStandaloneI(text: string, ctx: LanguageContext): string {
  if (!text) return text;
  if (ctx.blockType === "note") return text;
  if (ctx.language && !ctx.language.toLowerCase().startsWith("en")) return text;

  // Match `i` (and i'm, i'll, i've, i'd) as a standalone word. Word
  // boundaries with explicit non-letter look-around so we don't break
  // contractions inside other words.
  return text.replace(
    /(^|[^\p{L}\p{N}'])i(['’](m|ll|ve|d))?(?=$|[^\p{L}\p{N}])/gu,
    (match, pre: string, contraction: string | undefined) => {
      const original = (contraction ? "i" + contraction : "i").toLowerCase();
      if (ctx.rejectedFixes?.has(original)) return match;
      const fixed = contraction ? "I" + contraction : "I";
      return pre + fixed;
    },
  );
}

/**
 * Capitalize first letter of sentences for Action and Dialogue blocks.
 * Skipped for Note (private) and for explicitly-styled lines the writer
 * has already reverted (rejectedFixes contains the original).
 */
export function capitalizeSentenceStarts(text: string, ctx: LanguageContext): string {
  if (!text) return text;
  if (ctx.blockType === "note") return text;
  if (ctx.blockType !== "action" && ctx.blockType !== "dialogue") return text;
  if (ctx.rejectedFixes?.has(`__sentence_start:${text.slice(0, 60).toLowerCase()}`)) {
    return text;
  }

  let out = text.replace(
    /^(\s*["'(\[]*\s*)(\p{Ll})/u,
    (_m, p1: string, p2: string) => p1 + p2.toUpperCase(),
  );
  out = out.replace(
    /([.!?]\s+["'(\[]*)(\p{Ll})/gu,
    (_m, p1: string, p2: string) => p1 + p2.toUpperCase(),
  );
  return out;
}

/**
 * Compose every safe (high-confidence) language fix. Returns the result
 * and a list of fixes for telemetry / sticky-undo.
 */
export function applySafeLanguageFixes(
  text: string,
  ctx: LanguageContext,
): { text: string; changed: boolean; fixes: AppliedFix[] } {
  const fixes: AppliedFix[] = [];
  if (!text) return { text, changed: false, fixes };

  let next = capitalizeStandaloneI(text, ctx);
  if (next !== text) {
    fixes.push({ kind: "capitalize_i", original: text, replacement: next });
  }

  const before = next;
  next = capitalizeSentenceStarts(next, ctx);
  if (next !== before) {
    fixes.push({ kind: "sentence_start", original: before, replacement: next });
  }

  return { text: next, changed: next !== text, fixes };
}

const WORD_RE = /[\p{L}][\p{L}'’\-]*/gu;

/**
 * Find unknown terms in a block. "Unknown" here means: not in the project
 * dictionary, not a character name, not a tiny common word, and presenting
 * a proper-noun shape (capitalized mid-sentence or unusual caps). We never
 * propose replacements — only candidates the writer can accept/ignore.
 */
export function analyzeUnknownTerms(
  text: string,
  ctx: LanguageContext,
): LanguageDecision[] {
  if (!text) return [];
  // Don't flag formatted-uppercase blocks — they're structural, not prose.
  if (
    ctx.blockType === "scene_heading" ||
    ctx.blockType === "transition" ||
    ctx.blockType === "shot" ||
    ctx.blockType === "character"
  ) {
    return [];
  }

  const decisions: LanguageDecision[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  WORD_RE.lastIndex = 0;
  while ((m = WORD_RE.exec(text)) !== null) {
    const term = m[0];
    const lower = term.toLowerCase();
    if (term.length < 3) continue;
    if (DICTIONARY_BLOCKLIST.has(lower)) continue;
    if (ctx.characterNames?.has(lower)) continue;
    if (ctx.projectDictionary?.has(lower)) continue;
    if (seen.has(lower)) continue;
    seen.add(lower);

    // Proper-noun shape: capital letter not at sentence start, or unusual
    // mixed case.
    const isCapitalized = /^\p{Lu}/u.test(term);
    const sentenceStart = m.index === 0 || /[.!?]\s+$/.test(text.slice(0, m.index));
    if (!isCapitalized) continue;
    if (sentenceStart) continue;

    decisions.push({
      term,
      start: m.index,
      end: m.index + term.length,
      kind: "unknown_term",
      confidence: "medium",
      reason: "Capitalized mid-sentence and not in project dictionary",
    });
  }
  return decisions;
}

export function shouldPreserveUnknownTerm(term: string, ctx: LanguageContext): boolean {
  const lower = term.toLowerCase();
  return (
    ctx.characterNames?.has(lower) === true ||
    ctx.projectDictionary?.has(lower) === true
  );
}
