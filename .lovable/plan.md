## Pass 5 — what's already shipped vs. what remains

Earlier passes already delivered from `.lovable/plan.md`:

- Section A (Focus Mode `FocusAccessoryBar` + suppressing in-page chips) — done.
- Section B partially: Portrait is the final builder step, `portraitPrompt.ts` composer exists, per-project `cast_style_preset` and 7 presets (Ultra-Realistic, Cinematic Noir, Painterly Art, Concept Art, Graphic Comic, Anime, Watercolor), plan-based portrait metering, retry toast.

This pass closes the four gaps left in Section B.

---

### 1. Seed reuse + Reroll seed

- Migration: `characters.portrait_seed int`.
- `generatePortrait` accepts optional `rerollSeed: boolean`. If no seed exists or reroll is requested, generate a new int; otherwise reuse. Include `seed: <int>` in the prompt tail (Gemini image models honor it as a stability hint) and persist.
- Portrait step UI: split button "Regenerate (same seed)" / "Reroll seed" replaces the current single button, both share the plan-cap gate.

### 2. Permanent storage path

- Migration: `characters.portrait_path text`.
- `generatePortrait` writes to `storyboards/{projectId}/characters/{characterId}/{seed}.png` (keep existing bucket — already owner-scoped), stores `portrait_path`, and returns a fresh 30-day signed URL on every read.
- New `refreshPortraitUrl` server fn (auth) that, given a character with `portrait_path`, returns a new signed URL. Character builder calls it on mount when `portrait_url` is missing or a load `onError` fires. Fixes the expired-URL fallback.

### 3. Style Contract dialog (project-level look override)

- New `src/components/characters/StyleContractDialog.tsx`: opens from an "Edit style" link on the Portrait step. Fields: `medium`, `era`, `region`, `palette` (3 hex swatches), `lighting`, `lens`, `grain`, `aspect`, `negative_prompt`. Preset dropdown seeds initial values; user overrides persist to `projects.metadata.visual_style` via a new `setProjectVisualStyle` server fn.
- `composePortraitPrompt` already merges `{ ...preset.contract, ...visual_style }`; no change to composer. Read-only prompt preview stays as-is with the new "Edit style" link.
- All strings under `characters.style.*` i18n keys.

### 4. ElevenLabs voice auto-assign (unique per character)

- Migration: `characters.voice_id text` (nullable) with a `UNIQUE (project_id, voice_id)` partial index (where `voice_id is not null`) so no two characters in a project share a voice.
- New `suggestCharacterVoice` server fn: reads character (age, gender/role hints, voice_notes, wound/lie tone), pulls the current ElevenLabs voice list via existing integration, filters out voice IDs already reserved by any character in the same project, ranks by tag match (gender, age, timbre keywords from `voice_notes`), returns top choice + 3 alternates. Called automatically the first time the user enters the Portrait step if `voice_id` is null; user can accept, pick an alternate, or open the full picker.
- Table Read reads `characters.voice_id` directly — dedupe is now enforced at write time instead of at synthesis time.

---

### Files touched

- Migration: `characters.portrait_seed int`, `characters.portrait_path text`, `characters.voice_id text`, `UNIQUE (project_id, voice_id)` partial index.
- Edit: `src/lib/characters.functions.ts` — seed handling, `portrait_path` write, `refreshPortraitUrl`, `setProjectVisualStyle`, `suggestCharacterVoice`.
- Edit: `src/routes/_authenticated/characters.$projectId.build.$characterId.tsx` — split regenerate/reroll button, "Edit style" link, voice auto-suggest on Portrait step mount, portrait URL refresh on error.
- New: `src/components/characters/StyleContractDialog.tsx`.
- New: `src/components/characters/VoicePickerInline.tsx` (accept/alternates/open full picker).
- i18n: `characters.style.*`, `characters.builder.portrait.reroll*`, `characters.voice.*`.

### Out of scope

- Multi-candidate portrait grids, video, storyboard reuse.
- Cross-project cast style import.
- Real-time voice preview inside the builder (Table Read remains the audition surface).

### Acceptance

- Regenerate keeps the same face across takes; Reroll seed visibly changes it.
- Portrait survives a hard refresh even after the previous signed URL expires.
- Editing the Style Contract on one character re-composes prompts for every future portrait in that project.
- Creating a second character in the same project never assigns Hans's voice ID; the picker excludes reserved voices.
