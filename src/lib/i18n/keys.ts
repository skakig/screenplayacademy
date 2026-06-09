// Central map of user-facing strings used by the editor's auto-format
// indicator. A real i18n framework can later replace this map; for now it
// keeps copy out of components so it's translation-ready.
export const i18nStrings = {
  "editor.autoFormat.indicator": "Auto-formatted to {{result}}",
  "editor.autoFormat.indicatorGeneric": "Auto-formatted",
  "editor.autoFormat.dismiss": "Dismiss",
  "editor.autoFormat.whyTitle": "Why did this change?",
  "editor.autoFormat.whyBody":
    "Screenplays follow strict industry formatting. We automatically uppercase scene headings, character names, and transitions, wrap parentheticals, and capitalize the start of sentences in action and dialogue — so your script reads like a pro's.",
} as const;

export type I18nKey = keyof typeof i18nStrings;
