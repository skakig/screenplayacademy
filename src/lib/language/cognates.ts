// Seed cognate + false-friend table. Pure data — no I/O.
//
// Each entry maps a *target-language token* to one or more *source-language*
// equivalents the writer might already know. `falseFriend` marks pairs that
// look alike but mean different things — surface those proactively.
//
// This is a *starter* corpus, not an exhaustive dictionary. The engine must
// degrade gracefully when a token is not present: no entry ≠ error.

import type { LanguageCode } from "./types";

export type CognateEntry = {
  /** Lowercased token as it appears in `target`. */
  token: string;
  /** Language the token belongs to. */
  target: LanguageCode;
  /** Map from a writer's known language → equivalent token in that language. */
  knownEquivalents: Partial<Record<LanguageCode, string>>;
  /**
   * If present, pairing with these languages produces a misleading look-alike.
   * e.g. ES "embarazada" is a false friend for EN/PT writers ("pregnant",
   * not "embarrassed").
   */
  falseFriend?: {
    /** Languages where the writer will likely misread this. */
    forLanguages: LanguageCode[];
    /** One-line explanation suitable for an inline chip. */
    note: string;
  };
};

// Compact authoring helper.
function e(
  token: string,
  target: LanguageCode,
  knownEquivalents: Partial<Record<LanguageCode, string>>,
  falseFriend?: CognateEntry["falseFriend"],
): CognateEntry {
  return { token, target, knownEquivalents, falseFriend };
}

export const COGNATES: CognateEntry[] = [
  // ── EN ↔ Romance — high-frequency screen vocabulary
  e("lamp", "en", { es: "lámpara", pt: "lâmpada", it: "lampada", fr: "lampe", de: "Lampe", pl: "lampa", uk: "лампа", ru: "лампа" }),
  e("door", "en", { es: "puerta", pt: "porta", it: "porta", fr: "porte", de: "Tür" }),
  e("street", "en", { es: "calle", pt: "rua", it: "strada", fr: "rue", de: "Straße" }),
  e("night", "en", { es: "noche", pt: "noite", it: "notte", fr: "nuit", de: "Nacht" }),
  e("day", "en", { es: "día", pt: "dia", it: "giorno", fr: "jour", de: "Tag" }),
  e("car", "en", { es: "coche", pt: "carro", it: "auto", fr: "voiture", de: "Auto" }),
  e("house", "en", { es: "casa", pt: "casa", it: "casa", fr: "maison", de: "Haus" }),
  e("man", "en", { es: "hombre", pt: "homem", it: "uomo", fr: "homme", de: "Mann" }),
  e("woman", "en", { es: "mujer", pt: "mulher", it: "donna", fr: "femme", de: "Frau" }),
  e("hotel", "en", { es: "hotel", pt: "hotel", it: "hotel", fr: "hôtel", de: "Hotel" }),

  // ── Classic false friends
  e("embarazada", "es", { en: "pregnant" }, {
    forLanguages: ["en", "pt"],
    note: "Means 'pregnant', not 'embarrassed'.",
  }),
  e("éxito", "es", { en: "success" }, {
    forLanguages: ["en", "pt"],
    note: "Means 'success', not 'exit'.",
  }),
  e("ropa", "es", { en: "clothes", pt: "roupa" }, {
    forLanguages: ["en"],
    note: "Means 'clothes', not 'rope'.",
  }),
  e("librería", "es", { en: "bookstore" }, {
    forLanguages: ["en"],
    note: "Means 'bookstore', not 'library' (= biblioteca).",
  }),
  e("gift", "de", { en: "poison" }, {
    forLanguages: ["en"],
    note: "Means 'poison' in German, not 'present'.",
  }),
  e("rat", "de", { en: "advice" }, {
    forLanguages: ["en"],
    note: "Means 'advice/council' in German.",
  }),
  e("chef", "de", { en: "boss" }, {
    forLanguages: ["en", "fr"],
    note: "Means 'boss', not 'cook'.",
  }),
  e("preservativo", "it", { en: "condom" }, {
    forLanguages: ["en"],
    note: "Means 'condom', not 'preservative'.",
  }),

  // ── Slavic cluster cognates (Polish/Ukrainian/Russian)
  e("matka", "pl", { uk: "мати", ru: "мать", en: "mother" }),
  e("ojciec", "pl", { uk: "батько", ru: "отец", en: "father" }),
  e("dom", "pl", { uk: "дім", ru: "дом", en: "house" }),
  e("noc", "pl", { uk: "ніч", ru: "ночь", en: "night" }),
  e("дім", "uk", { pl: "dom", ru: "дом", en: "house" }),
  e("мати", "uk", { pl: "matka", ru: "мать", en: "mother" }),
  e("дом", "ru", { pl: "dom", uk: "дім", en: "house" }),
  e("ночь", "ru", { pl: "noc", uk: "ніч", en: "night" }),

  // ── Slavic false friends
  e("uroda", "pl", { ru: "красота", en: "beauty" }, {
    forLanguages: ["ru", "uk"],
    note: "Means 'beauty' in Polish — opposite of Russian/Ukrainian 'урод' (= ugly person).",
  }),
  e("zapomnieć", "pl", { en: "to forget" }, {
    forLanguages: ["ru", "uk"],
    note: "Means 'to forget', not 'to remember'.",
  }),
];

// Indexed for O(1) lookup. Key is `${lang}:${lowercased token}`.
const INDEX = new Map<string, CognateEntry>();
for (const c of COGNATES) {
  INDEX.set(`${c.target}:${c.token.toLowerCase()}`, c);
}

/** Get the cognate entry for a token written in `targetLang`, if any. */
export function findCognate(token: string, targetLang: LanguageCode): CognateEntry | undefined {
  return INDEX.get(`${targetLang}:${token.toLowerCase()}`);
}

/**
 * Is `token` a known cognate the writer should already recognize given their
 * known languages? Used to silently accept unknown-looking words.
 */
export function isKnownCognate(
  token: string,
  targetLang: LanguageCode,
  knownLanguages: LanguageCode[],
): boolean {
  const c = findCognate(token, targetLang);
  if (!c) return false;
  return knownLanguages.some((l) => l in c.knownEquivalents);
}

/** Return a false-friend warning for this token if the writer is at risk. */
export function findFalseFriendWarning(
  token: string,
  targetLang: LanguageCode,
  knownLanguages: LanguageCode[],
): string | null {
  const c = findCognate(token, targetLang);
  if (!c?.falseFriend) return null;
  const risky = c.falseFriend.forLanguages.some((l) => knownLanguages.includes(l));
  return risky ? c.falseFriend.note : null;
}
