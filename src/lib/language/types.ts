// Canonical language types used by the Language Intelligence engine.
// See docs/SCREENPLAY_LANGUAGE_INTELLIGENCE.md and the
// language-transfer-bridge-engine skill.

export const SUPPORTED_LANGUAGES = [
  "en", "es", "fr", "de", "pt", "it", "pl", "uk", "ru",
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number];

export const LANGUAGE_LABEL: Record<LanguageCode, string> = {
  en: "English",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
  pt: "Português",
  it: "Italiano",
  pl: "Polski",
  uk: "Українська",
  ru: "Русский",
};

/** Latin or Cyrillic — the two scripts we currently distinguish. */
export type ScriptCode = "latin" | "cyrillic" | "other";

export const LANGUAGE_SCRIPT: Record<LanguageCode, ScriptCode> = {
  en: "latin", es: "latin", fr: "latin", de: "latin",
  pt: "latin", it: "latin", pl: "latin",
  uk: "cyrillic", ru: "cyrillic",
};

export type LanguageProfile = {
  /** Known languages in order of proficiency (strongest first). */
  knownLanguages: LanguageCode[];
  /** UI language the writer reads the app in. */
  uiLanguage: LanguageCode;
};

export function isSupportedLanguage(value: unknown): value is LanguageCode {
  return typeof value === "string"
    && (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

export function coerceLanguage(
  value: unknown,
  fallback: LanguageCode = "en",
): LanguageCode {
  return isSupportedLanguage(value) ? value : fallback;
}
