# Pass 10 — Language Intelligence Core: multilingual + transfer-aware

Goal: graduate `screenplayLanguageIntelligence.ts` from an English-only helper into a profile-aware engine that handles 9 languages (EN, ES, FR, DE, PT, IT, PL, UK, RU), respects the writer's known languages, and never applies English rules to non-English text.

Anchored in `docs/SCREENPLAY_LANGUAGE_INTELLIGENCE.md` and the Language Transfer Bridge doctrine: capture the full language profile, compute transfer distance per (source, target) pair, never assume a monolingual baseline.

## Scope

In: persistence, language-aware mechanical fixes, per-block detection, cognate/false-friend metadata, character-name protection across scripts (Latin/Cyrillic), settings + soft onboarding prompt.

Out (later passes): AI prompt bridge-language routing (10C), real ML language detection beyond heuristics, full localization of UI strings to all 9 languages, automatic glossary import.

## Decisions locked from clarifying questions

- Scope: 10A + 10B in this pass.
- Languages: EN, ES, FR, DE, PT, IT, PL, UK, RU.
- Onboarding: optional, soft prompt (no hard step).
- Detection: project-level default with per-block override.

## Architecture

```text
profiles.preferred_languages[]  ─┐
projects.screenplay_language     ├─► LanguageContext ─► screenplayLanguageIntelligence
script_blocks.language (nullable)┘                       ├─ capitalizeStandaloneI (EN-only gate)
                                                         ├─ capitalizeSentenceStarts (locale rules)
                                                         ├─ analyzeUnknownTerms (cognate-aware)
                                                         └─ shouldPreserveUnknownTerm (script-aware)

src/lib/language/
  transferMatrix.ts        — typology table for the 9 langs
  cognates.ts              — seed cognate / false-friend lists per (src,tgt)
  scriptDetection.ts       — Unicode-block heuristics (Latin vs Cyrillic)
  bridgeSelector.ts        — pick nearest viable known language for scaffolding
```

## Database (single migration)

1. `profiles.preferred_languages text[]` default `'{en}'`, `profiles.ui_language text` default `'en'`.
2. `projects.screenplay_language text` default `'en'`, `projects.project_language text` default `'en'`.
3. `script_blocks.language text` nullable (per-block override; falls back to project).
4. `project_dictionary`: add `language text`, `cognate_of jsonb` (`{en: "lamp", pl: "lampa"}`), `false_friend_risk text[]` (list of language codes where the term means something different).
5. Extend RLS only where new tables added — none here, all alters; existing policies cover new columns.

## Code work

### Foundation (10A)
- **`src/lib/language/types.ts`**: `LanguageCode` union, `LanguageProfile`, expanded `LanguageContext` (`uiLanguage`, `screenplayLanguage`, `knownLanguages`, `blockLanguageOverride?`).
- **`src/components/editor/screenplayLanguageIntelligence.ts`** rewrite:
  - `capitalizeStandaloneI` already gated on EN — keep but also block when block language ≠ EN.
  - `capitalizeSentenceStarts` becomes a registry of per-language rules. EN/ES/FR/DE/PT/IT/PL/UK/RU all do sentence-case, but DE preserves noun capitalization (skip mid-word changes), and Cyrillic uses `\p{Lu}/\p{Ll}` Unicode classes already.
  - New `applySafeLanguageFixes(text, ctx)` dispatches by `ctx.effectiveLanguage`.
  - New `shouldPreserveUnknownTerm` consults: project dictionary + character bible + script mismatch (Cyrillic token in EN screenplay → preserve, do not flag).
- **`src/hooks/useLanguageContext.ts`**: builds the effective `LanguageContext` for a block by merging profile → project → block override.
- **`src/components/editor/ScreenplayLine.tsx`**: pass new context shape; no behavior change to keystrokes.
- **`src/components/editor/ScreenplayDocumentEditor.tsx`** and **`src/routes/_authenticated/editor.$projectId.tsx`**: fetch project's `screenplay_language` and pass down.
- **Settings**: tiny "Languages I know" chip-strip on `/settings` (uses existing i18n keys via `t()`); writes to `profiles.preferred_languages`.
- **Soft onboarding nudge**: one-time toast on first editor open if `preferred_languages.length === 1` and screenplay language differs from UI language — "We can help you write in {{lang}} better. Tell us which languages you know." Links to settings.

### Transfer table (10B)
- **`src/lib/language/transferMatrix.ts`**: pure data — 9×9 matrix with `{script, morphology, syntax, lexicon}` distances on 0–3 scale per the doctrine. Exports `transferDistance(src, tgt)` and `nearestBridge(known[], target)`.
- **`src/lib/language/cognates.ts`**: seed list (~50 high-value entries per neighbor pair: EN↔ES, EN↔FR, EN↔DE, ES↔PT, ES↔IT, FR↔IT, PL↔UK, PL↔RU, UK↔RU). Each entry tagged with `false_friend_risk` where applicable (e.g. ES `embarazada` vs EN `embarrassed`).
- **`analyzeUnknownTerms`** consults cognate table: a Polish writer typing English `lamp` is silently accepted because `lampa` is the known cognate; an unfamiliar term that matches a false-friend pattern surfaces a chip with a one-line warning.
- **Character / location preservation across scripts**: `shouldPreserveUnknownTerm` recognizes that a token whose script ≠ effective language's script is almost certainly a foreign-language insert (Cyrillic char name in a Latin-script script) → never flag, never auto-correct.

### Bridge selector (groundwork for 10C)
- **`src/lib/language/bridgeSelector.ts`**: pure function `pickScaffoldLanguage({uiLanguage, knownLanguages, screenplayLanguage})`. Returns the nearest viable bridge. Not yet wired into AI prompts — exported for later.

## i18n keys to add (en stubs only, parity later)

```text
settings.language.title
settings.language.knownLanguages
settings.language.uiLanguage
settings.language.screenplayLanguage
editor.language.softPrompt.title
editor.language.softPrompt.cta
editor.language.blockOverride.label
editor.language.unknownTerm.foreignWord
editor.language.falseFriend.warning
```

## Acceptance tests

1. Polish writer, screenplay language = pl, types `lampa` → no "unknown word" chip.
2. Same writer types `kubelweinsteinman` → chip appears once, "Add to dictionary" works, never re-flagged.
3. English writer, screenplay language = en, types `i'm tired` → auto-capitalizes to `I'm tired`.
4. Russian writer, screenplay language = ru, types lowercase Cyrillic sentence start → capitalizes to Cyrillic capital, no Latin `I` rule fires.
5. German writer, screenplay language = de, types `der Hund läuft.` → sentence start capitalizes; noun `Hund` is NOT lowercased mid-line.
6. English screenplay with one Russian dialogue block: per-block override = `ru`. Cyrillic text in that block is never flagged; English rules don't fire inside it.
7. Spanish writer types `embarazada` in an English Action block → false-friend chip warns "means 'pregnant', not 'embarrassed'".
8. Refresh: project's `screenplay_language` persists; block-level overrides persist.
9. Writer with only `preferred_languages=['en']` opens a Polish project for the first time → soft toast appears once, dismissible, never repeats.
10. All existing Pass 8 acceptance tests still pass for English projects.

## Risks / open notes

- Sentence-start regex for Polish needs care around proper nouns like `Łódź` — handled by Unicode-class regex but worth a manual smoke test.
- Seed cognate list will be incomplete; the engine must degrade gracefully (no cognate match ≠ flag as error).
- We are NOT shipping bridge-language AI prompts yet (that is 10C). The selector exists so AI work can land later without re-plumbing.
