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

  // Import wizard
  "import.title": "Import existing screenplay",
  "import.description":
    "Bring your work in. SceneSmith parses it, shows you exactly what it found, and never rewrites a line you didn't approve.",
  "import.source.tab.paste": "Paste text",
  "import.source.tab.upload": "Upload file",
  "import.source.paste.placeholder":
    "Paste your screenplay, treatment, or rough draft here…",
  "import.source.paste.cta": "Parse text",
  "import.source.upload.cta": "Drop a file or click to choose",
  "import.source.upload.formats": ".txt · .fountain · .md (more formats coming next pass)",
  "import.source.upload.parsing": "Parsing…",
  "import.error.empty": "Nothing to import yet.",
  "import.error.unsupportedFormat":
    "This format is coming in the next pass. Try .txt, .fountain, .md — or paste the text.",
  "import.error.start": "Couldn't start import",
  "import.error.save": "Couldn't save change",
  "import.error.commit": "Couldn't commit import",
  "import.error.approveOne": "Approve at least one block first.",
  "import.error.newTitle": "Give the new project a title.",

  "import.review.filter.all": "All ({{count}})",
  "import.review.filter.needsReview": "Needs review ({{count}})",
  "import.review.filter.approved": "Approved ({{count}})",
  "import.review.approveHigh": "Approve all high-confidence",
  "import.review.approveHigh.toast": "All high-confidence blocks approved",
  "import.review.empty": "Nothing in this filter.",
  "import.review.empty.placeholder": "(empty)",
  "import.review.badge.review": "review",
  "import.review.aria.approve": "Approve block",
  "import.review.aria.remove": "Remove block",
  "import.review.detected": "Detected",
  "import.review.scenes": "{{count}} scenes",
  "import.review.characters": "{{count}} characters",
  "import.review.approvedCount": "{{approved}} / {{total}} blocks approved",
  "import.review.cast": "Cast",
  "import.review.castMore": "+{{count}} more",

  "import.commit.ready": "Ready to commit {{count}} blocks.",
  "import.commit.safetyNote":
    "Your current draft is automatically slated as a Take before any replace — you can roll back any time.",
  "import.commit.mode.replace.title": "Replace current draft",
  "import.commit.mode.replace.body":
    "Swap your current screenplay with the imported one. Current draft is captured as a Take first.",
  "import.commit.mode.append.title": "Append to current draft",
  "import.commit.mode.append.body":
    "Add the imported blocks at the end of your current screenplay.",
  "import.commit.mode.new.title": "Import as a new project",
  "import.commit.mode.new.body":
    "Create a new project and put the imported screenplay there. Your current project is untouched.",
  "import.commit.newTitle.placeholder": "New project title",
  "import.commit.cta": "Commit import",
  "import.commit.takeName": "Before import — {{when}}",
  "import.commit.success": "Imported {{count}} blocks",

  "import.done.title": "Import complete",
  "import.done.loading": "Loading your screenplay…",

  "import.nav.back": "Back",
  "import.nav.continue": "Continue",

  "import.blockType.scene_heading": "scene heading",
  "import.blockType.action": "action",
  "import.blockType.character": "character",
  "import.blockType.dialogue": "dialogue",
  "import.blockType.parenthetical": "parenthetical",
  "import.blockType.transition": "transition",
  "import.blockType.shot": "shot",
  "import.blockType.note": "note",

  "import.confidence.high": "high",
  "import.confidence.medium": "medium",
  "import.confidence.low": "low",
} as const;

export type I18nKey = keyof typeof i18nStrings;
