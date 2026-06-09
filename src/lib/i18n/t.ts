import { i18nStrings, type I18nKey } from "./keys";

/**
 * Minimal translation helper. Looks up the English fallback string and
 * substitutes `{{name}}` tokens. Designed to be swapped for a real i18n
 * library later without touching call sites.
 */
export function t(key: I18nKey, vars?: Record<string, string | number>): string {
  let out: string = i18nStrings[key];
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      out = out.replace(new RegExp(`{{\\s*${k}\\s*}}`, "g"), String(v));
    }
  }
  return out;
}
