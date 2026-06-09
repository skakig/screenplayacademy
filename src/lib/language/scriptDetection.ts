// Lightweight Unicode-block heuristics. Returns the dominant script of a
// token. Used to protect cross-script tokens (e.g. a Cyrillic name in a
// Latin-script screenplay) from auto-correction.

import type { LanguageCode, ScriptCode } from "./types";
import { LANGUAGE_SCRIPT } from "./types";

const LATIN_RE = /\p{Script=Latin}/u;
const CYRILLIC_RE = /\p{Script=Cyrillic}/u;

export function detectScript(token: string): ScriptCode {
  if (!token) return "other";
  let latin = 0;
  let cyrillic = 0;
  for (const ch of token) {
    if (LATIN_RE.test(ch)) latin++;
    else if (CYRILLIC_RE.test(ch)) cyrillic++;
  }
  if (latin === 0 && cyrillic === 0) return "other";
  return cyrillic > latin ? "cyrillic" : "latin";
}

export function scriptOf(lang: LanguageCode): ScriptCode {
  return LANGUAGE_SCRIPT[lang] ?? "latin";
}

/**
 * True if the token's script does not match the effective language. Such
 * tokens are almost always foreign-language inserts (e.g. Russian dialogue
 * in an English screenplay) and must never be flagged or corrected.
 */
export function isScriptMismatch(token: string, lang: LanguageCode): boolean {
  const tokenScript = detectScript(token);
  if (tokenScript === "other") return false;
  return tokenScript !== scriptOf(lang);
}
