# SCREENPLAY_LANGUAGE_INTELLIGENCE.md

## Purpose

This document defines the difference between spell checking, screenplay auto-formatting, and SceneSmith's language intelligence layer.

The editor should help the writer produce clean screenplay text without behaving like a generic spell checker that mangles names, invented words, historical terms, foreign words, character voice, or world-specific vocabulary.

The goal is not to make the script sound like autocorrect.

The goal is to preserve the writer's voice while fixing obvious mechanical issues and learning the vocabulary of the project.

## Prime Rule

SceneSmith must not blindly correct unknown words.

Unknown does not mean wrong.

A strange word may be:

- a character name
- a place name
- a fictional object
- a historical term
- a foreign-language word
- a joke
- dialect
- slang
- intentional voice
- invented worldbuilding vocabulary

The editor should distinguish between mechanical corrections and authorial choices.

## What Should Be Automatic

Only high-confidence mechanical fixes should happen automatically.

Safe automatic fixes include:

- lowercase standalone `i` to uppercase `I`
- sentence-start capitalization when clearly appropriate
- Character block uppercase formatting
- known screenplay format normalization
- transition capitalization when block type is Transition
- scene heading normalization when block type is Scene Heading
- simple repeated-space cleanup outside intentional formatting

## What Should Not Be Automatic

Do not automatically rewrite:

- character voice
- dialect
- slang
- invented names
- fictional vocabulary
- foreign-language terms
- intentional misspellings
- jokes based on spelling
- historical terms
- proper nouns not in the dictionary

Example:

If the writer types:

```text
Kubelweinsteinman
```

Do not change it to:

```text
Kubelweinsteinfrau
```

Do not guess a replacement merely because the word is unknown.

Instead, mark it as unknown only if needed and offer an optional action:

- Add to Project Dictionary
- Add as Character Name
- Add as Location
- Ignore
- Suggest alternatives

## Language Intelligence vs Spell Checker

A normal spell checker asks:

> Is this word in the dictionary?

SceneSmith should ask:

> Is this word wrong in this screenplay's context?

That requires project-aware vocabulary.

## Project Dictionary

Every project should have a custom dictionary.

The Project Dictionary stores terms that should not be corrected.

Possible categories:

```ts
type ProjectDictionaryEntry = {
  id: string;
  project_id: string;
  term: string;
  normalized_term?: string;
  category:
    | "character"
    | "location"
    | "organization"
    | "object"
    | "fictional_term"
    | "foreign_word"
    | "historical_term"
    | "slang"
    | "dialect"
    | "custom";
  language?: string;
  notes?: string;
  created_from?: "manual" | "character_bible" | "script_detection" | "import" | "ai_suggestion";
  approved: boolean;
};
```

## Dictionary Sources

The Project Dictionary should learn from:

- Character Bible names
- aliases and nicknames
- locations
- scene headings
- cast list
- recurring unusual words
- writer-approved unknown terms
- imported glossary
- historical/fantasy/science-fiction terminology

## Character Bible Integration

Character names should be protected from spell correction.

If a character exists in the Character Bible, the editor should recognize:

- canonical name
- uppercase screenplay name
- nicknames
- aliases
- possessives
- voice modifiers such as `(V.O.)`, `(O.S.)`, `(CONT'D)`

Example:

```text
Stephan
STEPHAN
Stephan's
STEPHAN (V.O.)
```

These should not be treated as spelling errors.

## Proper Noun Handling

Unknown capitalized words should be treated carefully.

Rules:

1. If capitalized mid-sentence, likely proper noun.
2. If repeated multiple times, likely intentional.
3. If used in Scene Heading, Character, or Location context, likely project vocabulary.
4. If found in Character Bible or project dictionary, never correct.
5. If unknown and lowercase in a normal sentence, suggest softly, do not force.

## Dialogue Is Voice

Dialogue must preserve character voice.

Do not overcorrect dialogue.

Characters may speak with:

- poor grammar
- fragments
- dialect
- accent markers
- slang
- broken English
- repetition
- intentional lowercase or odd phrasing

The editor may gently flag obvious mechanical issues, but it should not sanitize the voice.

Example:

```text
i ain't going back there.
```

A generic editor might change this aggressively.

SceneSmith should know:

- `i` may become `I` if safe
- `ain't` should remain if it is character voice
- the rest should not be rewritten without permission

## Standalone I Rule

The pronoun `I` should usually be capitalized automatically.

Examples:

| Typed | Result |
|---|---|
| `i am lost` | `I am lost` |
| `what am i doing?` | `what am I doing?` |
| `i'll go` | `I'll go` |
| `i'm tired` | `I'm tired` |
| `if i were you` | `if I were you` |

Rules:

- Only capitalize standalone English pronoun `i`.
- Do not capitalize `i` inside words.
- Do not change Roman numerals or intentional stylized text.
- Do not affect non-English text unless language context supports it.

## Sentence Start Capitalization

The editor may capitalize the first letter of a sentence when confidence is high.

Examples:

| Typed | Result |
|---|---|
| `the sun rises.` | `The sun rises.` |
| `wait. he stops.` | `Wait. He stops.` |
| `what now? he looks up.` | `What now? He looks up.` |

Do not force sentence capitalization when:

- the line is a Note
- the line intentionally begins lowercase for style
- the line begins with a brand/term that is intentionally lowercase
- the line is in a non-English language where rules differ
- the writer previously undid the capitalization

## Foreign Language and Multilingual Scripts

SceneSmith should support scripts containing multiple languages.

Rules:

- Do not spell-correct foreign words using English rules.
- Allow per-project and per-character language tags.
- Allow inline foreign-language dialogue.
- Preserve diacritics.
- Do not replace Ukrainian, Russian, Polish, German, Italian, or other foreign names with English approximations.

The editor should eventually detect language context, but until confidence is high, it should preserve text.

## Historical and Genre Vocabulary

War films, fantasy, sci-fi, historical dramas, and comedies often use specialized vocabulary.

Examples:

- military terms
- invented technologies
- foreign place names
- vehicle names
- ranks
- period slang
- fictional religions
- made-up brands

These should be learned into the project dictionary instead of repeatedly flagged.

## Confidence Model

Language intelligence decisions should use confidence.

```ts
type LanguageDecision = {
  originalText: string;
  proposedText: string;
  decisionType:
    | "mechanical_fix"
    | "spelling_suggestion"
    | "dictionary_candidate"
    | "character_name_candidate"
    | "location_candidate"
    | "style_suggestion";
  confidence: "high" | "medium" | "low";
  reason: string;
  applyAutomatically: boolean;
};
```

### High Confidence

Can apply automatically.

Examples:

- standalone English pronoun `i` to `I`
- `i'm` to `I'm`
- `i'll` to `I'll`
- obvious sentence start capitalization in Action or Dialogue

### Medium Confidence

Suggest, do not force.

Examples:

- unknown lowercase word that resembles a typo
- repeated term that may be project vocabulary
- unusual capitalized word not yet in dictionary

### Low Confidence

Do nothing.

Preserve the writer's text.

## User Controls

The writer must be able to control language intelligence.

Required actions:

- Accept suggestion
- Reject suggestion
- Ignore once
- Ignore always
- Add to Project Dictionary
- Add as Character
- Add as Location
- Undo correction
- Disable automatic language fixes for this project
- Disable automatic language fixes for this character's dialogue

## Do Not Fight the Writer

If the writer edits an automatic correction back to the original, SceneSmith should remember that choice.

Example:

1. Editor changes `kubelweinsteinman` to something else.
2. Writer changes it back.
3. Editor should stop correcting it.
4. Offer to add it to Project Dictionary.

## Block-Specific Rules

### Action

Allowed automatic fixes:

- standalone `i` capitalization
- sentence start capitalization
- simple repeated-space cleanup

Avoid:

- rewriting style
- replacing unknown nouns
- changing invented terms

### Dialogue

Allowed automatic fixes:

- standalone `i` capitalization
- very obvious punctuation spacing fixes

Avoid:

- sanitizing dialect
- changing slang
- rewriting grammar
- making every character sound the same

### Character

Allowed automatic fixes:

- uppercase character names
- normalize voice modifiers
- recognize Character Bible names

Avoid:

- spell-correcting character names
- changing names not in dictionary

### Scene Heading

Allowed automatic fixes:

- uppercase scene heading
- normalize `INT.`, `EXT.`, `INT./EXT.`
- recognize location names from project dictionary

Avoid:

- changing location names because they are unusual

### Note

Minimal corrections only.

Notes are private. Do not overcorrect.

## Learning Signals for ITS/PfHU

Language intelligence should produce learning signals later.

Track:

- repeated lowercase `i` corrections
- repeated rejection of spelling suggestions
- frequent character-name inconsistencies
- frequent manual additions to project dictionary
- dialogue grammar patterns by character
- action lines with many mechanical errors
- writer preference for light, medium, or heavy correction

Possible coaching:

> You often write speaker names in dialogue or action lines. Want a quick lesson on Character and Dialogue formatting?

Or:

> This project uses many invented terms. Would you like to build a project glossary so SceneSmith stops flagging them?

## Recommended Implementation Location

Create a pure helper module:

```text
src/components/editor/screenplayLanguageIntelligence.ts
```

Recommended exports:

```ts
capitalizeStandaloneI(text: string, context: LanguageContext): string
capitalizeSentenceStarts(text: string, context: LanguageContext): string
analyzeUnknownTerms(text: string, context: LanguageContext): LanguageDecision[]
applySafeLanguageFixes(text: string, context: LanguageContext): string
shouldPreserveUnknownTerm(term: string, context: LanguageContext): boolean
createDictionaryCandidate(term: string, context: LanguageContext): ProjectDictionaryEntry
```

Do not bury language intelligence inside route files.

Do not mix language intelligence with screenplay block transition logic.

## Integration Order

When the writer presses Enter:

1. Apply safe language fixes for the current block.
2. Apply screenplay auto-formatting for the current block.
3. Compute next block type from screenplay structure.
4. Insert next local block.
5. Focus next block.

Order matters.

Language fixes should happen before screenplay formatting when they affect text casing inside the block.

## Acceptance Tests

Add these tests:

1. Dialogue `i am lost` becomes `I am lost`.
2. Dialogue `what am i doing?` becomes `what am I doing?`.
3. Dialogue `i ain't going` becomes `I ain't going`, preserving `ain't`.
4. Action `the sun rises.` may become `The sun rises.` if safe.
5. Unknown proper noun `Kubelweinsteinman` is not changed.
6. Repeated unknown proper noun is offered as Project Dictionary candidate.
7. Character Bible name is never spell-corrected.
8. Foreign words with diacritics are preserved.
9. Writer can undo or reject a language fix.
10. Rejected fixes are not immediately reapplied.
11. Dialogue voice is preserved.
12. Language fixes do not blur the textarea or move the caret.

## Final Rule

SceneSmith should be language-aware, not spell-checker stupid.

Correct the obvious. Preserve the intentional. Ask when unsure.
