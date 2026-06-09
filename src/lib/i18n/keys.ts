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

  "settings.language.title": "Languages",
  "settings.language.knownLanguages": "Languages I know",
  "settings.language.knownHint": "Pick every language you can read or write. We use this to silently accept cognates and warn about false friends.",
  "settings.language.uiLanguage": "Interface language",
  "settings.language.screenplayLanguage": "Screenplay language",

  "editor.language.softPrompt.title": "Writing in {{lang}}?",
  "editor.language.softPrompt.body": "Tell us which languages you know so we stop flagging familiar words.",
  "editor.language.softPrompt.cta": "Set my languages",
  "editor.language.softPrompt.dismiss": "Not now",

  "editor.language.blockOverride.label": "Block language",
  "editor.language.blockOverride.useProject": "Use project language",

  "editor.language.unknownTerm.foreignWord": "New word",
  "editor.language.falseFriend.warning": "Heads up — {{note}}",
} as const;

export type I18nKey = keyof typeof i18nStrings;
