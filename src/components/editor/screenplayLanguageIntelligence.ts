// Pure language intelligence — see docs/SCREENPLAY_LANGUAGE_INTELLIGENCE.md
// and the language-transfer-bridge-engine skill.
//
// No React, no DOM, no network. Safe to call from the hot typing path
// because callers only invoke it on Enter / blur / explicit moments.

import { coerceLanguage, type LanguageCode } from "@/lib/language/types";
import { isScriptMismatch } from "@/lib/language/scriptDetection";
import {
  findFalseFriendWarning,
  isKnownCognate,
} from "@/lib/language/cognates";

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

  // ── Multilingual additions ────────────────────────────────────────────
  /**
   * Default language for the project's screenplay text.
   * Per-block overrides take precedence via `blockLanguageOverride`.
   */
  screenplayLanguage?: LanguageCode;
  /** Per-block override (a Russian dialogue line in an English script). */
  blockLanguageOverride?: LanguageCode | null;
  /** Languages the writer reads/writes, strongest first. Drives cognate logic. */
  knownLanguages?: LanguageCode[];

  /** Legacy field — preferred shape is `screenplayLanguage`. */
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
    | "location_candidate"
    | "false_friend";
  confidence: "high" | "medium" | "low";
  reason: string;
};

// Tokens our minimal dictionary would otherwise flag — never propose them.
const DICTIONARY_BLOCKLIST = new Set([
  "i","im","ive","ill","id","ok","okay","oh","ah","uh","hmm","yeah","yes","no",
]);

/** Resolve the language to use for this block. */
export function effectiveLanguage(ctx: LanguageContext): LanguageCode {
  if (ctx.blockLanguageOverride) return ctx.blockLanguageOverride;
  if (ctx.screenplayLanguage) return ctx.screenplayLanguage;
  return coerceLanguage(ctx.language, "en");
}

/**
 * Capitalize standalone English `i` and its contractions (i'm, i'll, i've, i'd).
 * EN-only. Idempotent.
 */
export function capitalizeStandaloneI(text: string, ctx: LanguageContext): string {
  if (!text) return text;
  if (ctx.blockType === "note") return text;
  if (effectiveLanguage(ctx) !== "en") return text;

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
 * Locale-aware via `\p{Ll}` / `\p{Lu}` Unicode property classes — works for
 * Latin AND Cyrillic. German nouns are intentionally left alone: this rule
 * only touches sentence-initial characters, never mid-sentence words.
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
    (_m, p1: string, p2: string) => p1 + p2.toLocaleUpperCase(),
  );
  out = out.replace(
    /([.!?]\s+["'(\[]*)(\p{Ll})/gu,
    (_m, p1: string, p2: string) => p1 + p2.toLocaleUpperCase(),
  );
  return out;
}

/**
 * Compose every safe (high-confidence) language fix.
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
 * Find unknown terms in a block. Multilingual-aware:
 *   - tokens whose script differs from the effective language are skipped
 *     (clearly a foreign-language insert)
 *   - tokens that match a known cognate for the writer's known languages
 *     are skipped (they already understand it)
 *   - false-friend tokens are surfaced as `false_friend` decisions
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

  const lang = effectiveLanguage(ctx);
  const known = ctx.knownLanguages ?? [];
  const decisions: LanguageDecision[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  WORD_RE.lastIndex = 0;
  while ((m = WORD_RE.exec(text)) !== null) {
    const term = m[0];
    const lower = term.toLocaleLowerCase();
    if (term.length < 3) continue;
    if (DICTIONARY_BLOCKLIST.has(lower)) continue;
    if (ctx.characterNames?.has(lower)) continue;
    if (ctx.projectDictionary?.has(lower)) continue;
    if (seen.has(lower)) continue;
    seen.add(lower);

    // Cross-script token → foreign insert, never flag.
    if (isScriptMismatch(term, lang)) continue;

    // False friend? Surface before anything else — even if the writer would
    // otherwise consider this word "known".
    const ff = findFalseFriendWarning(term, lang, known);
    if (ff) {
      decisions.push({
        term, start: m.index, end: m.index + term.length,
        kind: "false_friend", confidence: "high", reason: ff,
      });
      continue;
    }

    // Already a known cognate → silently accept.
    if (isKnownCognate(term, lang, known)) continue;

    // Proper-noun shape: capital letter not at sentence start.
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

/**
 * Should we preserve `term` as-is (skip all correction)? Yes if it's a
 * character name, project-dictionary entry, or a cross-script foreign insert.
 */
export function shouldPreserveUnknownTerm(term: string, ctx: LanguageContext): boolean {
  const lower = term.toLocaleLowerCase();
  if (ctx.characterNames?.has(lower)) return true;
  if (ctx.projectDictionary?.has(lower)) return true;
  if (isScriptMismatch(term, effectiveLanguage(ctx))) return true;
  return false;
}
