# Casting Wall Stabilization + Character Builder v1.0

Scope is Characters, Scene cleanup, and related tests. **Screenplay editor, typing engine, Enter/Tab/slash/autosave — untouched.**

## Pass 1 — "Review Detected Cast" cleanup panel

**New file:** `src/components/characters/CastCleanupPanel.tsx`

- Reuses `looksLikeStructuralLine` + `isLikelyCharacterName` from `src/lib/editor/manuscriptAnalyzer.ts` (extend that module with a shared `looksLikeSuspiciousCharacterName(name)` helper — one source of truth).
- Fetches `characters` for the project, filters to suspicious rows:
  - name matches structural regex (INT/EXT/EST/CUT TO/FADE/ACT/SCENE/OPENING SCENE/MIDPOINT/SEQUENCE)
  - ends in DAY/NIGHT/DAWN/DUSK/MORNING/EVENING/CONTINUOUS/LATER
  - fails `isLikelyCharacterName`
  - OR has zero completeness + zero relationships + zero scene states
- Row actions: Keep, Rename (inline), Delete. Header actions: Select all, Bulk delete (confirmation dialog).
- Mounted on Characters page above the grid, collapsible, hidden when list is empty.
- Never touches `script_blocks`.

## Pass 2 — Obvious deletion on `characters.$projectId.tsx`

- Card gets a persistent `•••` `DropdownMenu` trigger (Open, Rename, Duplicate, Delete) visible on all viewports — no hover requirement.
- Add bulk-select mode toggle in page header; when active, cards render a checkbox and a floating action bar shows "Delete N".
- All destructive actions use `AlertDialog` confirmation.
- On success invalidate: `["characters", projectId]`, `["relationship-counts", projectId]`, `["scene-counts", projectId]`.

## Pass 3 — Cast vs Detected Speakers vs Cleanup

Restructure page into three labeled sections (tabs or stacked):

1. **Cast** — rows from `characters` table (current grid).
2. **Detected Speakers** — from `tallyCharacters(blocks)` for this project's script; each row shows line count + "Add to Cast" / "Ignore".
3. **Cleanup** — the Pass 1 panel.

Anywhere `tallyCharacters` output is rendered, label it "Detected Speakers", never "Characters".

## Pass 4 — Guided Character Builder in `CharacterProfileDialog`

- New default tab: **Build this character** (shown first for empty/new; toggle to switch back).
- 9 steps (Story role → Want → Need → Wound → Lie → Secret → Voice → Visual identity → Arc), one at a time with progress dots.
- Each step: short explainer, one example, single input (textarea or select), buttons: **Help me write this** (calls existing AI assist server fn with step-specific prompt), **Skip for now**, **Back / Next**.
- Existing tabs (Identity, Psychology, Voice, Visual, Arc, Relationships, Scenes) preserved behind an **Advanced Profile** toggle. No fields removed.
- Persists to same `characters` columns via existing `upsertCharacter`.

## Pass 5 — Visual/image generation clarity

In the Visual tab of `CharacterProfileDialog`:

- Add a config status pill via a lightweight server fn `getImageGenStatus()` that reports whether `LOVABLE_API_KEY` is present.
- If not configured: banner "Portrait generation is not configured in this preview." — disable Generate button.
- Portrait generation flow:
  - Require `image_prompt`; if empty, auto-generate one from character summary/visual fields first (existing helper or new small AI call), show it to user before submitting.
  - After image call, if response contains neither `b64_json` nor `url`, throw `Error("Image generation returned no data")`.
  - Never write `portrait_url = null` on failure — leave prior value intact.
  - Inline failure card in the Visual tab (message + retry), in addition to toast.

## Pass 6 — Scene cleanup on Scene Board / StoryPulse

**New:** `src/components/scenes/SceneCleanupPanel.tsx` mounted on `scenes.$projectId.tsx`.

- Lists scenes marked auto-detected (e.g. `metadata.source = 'auto'` or scenes with no manual edits) separately.
- Row actions: Delete (confirm), Open source line in editor (deep-link to `editor/$projectId?block=<id>`).
- Header actions: **Resync scenes from manuscript** (runs existing sceneSync), **Delete selected**.
- Manual scenes require confirmation; auto scenes require confirmation only for bulk delete.

## Pass 7 — Tests

Extend `src/lib/editor/manuscriptAnalyzer.test.ts` and add `src/lib/characters/cleanup.test.ts`:

- Structural lines (`CUT TO:`, `INT. HOUSE - DAY`, `EXT. FIELD`, `ACT ONE`, `SCENE 12`, `OPENING SCENE`) never pass `isLikelyCharacterName`.
- `tallyCharacters` returns only speakers with ≥1 dialogue block.
- Cleanup detector flags: `CUT TO`, `INT. LIBRARY`, `EXT.`, `ACT II`, `SCENE 3`, `FADE IN`.
- Valid names pass: `STEPHAN`, `HANS`, `HANS (V.O.)`, `COMMANDER`, `J.T.`, `MARY-ANNE`.
- Extend `src/lib/import/parser.test.ts` to assert scene-heading lines are not emitted as character blocks.

## Pass 8 — Stability gate

Run and fix any failures:

- `npm run build`
- `npm run lint`
- `npm run test`

Manual acceptance (documented in `.lovable/plan.md`): Characters page loads, profile opens, create/delete works on touch, bulk cleanup deletes junk, Generate Full + Generate Portrait either succeed or show clear config/failure state, Scene Board cleanup works.

&nbsp;

Approved with amendments:

1. Cleanup confidence levels

Do not treat “zero completeness + zero relationships + zero scene states” as automatic junk. Flag it as low-confidence only. High-confidence junk is structural text like CUT TO:, INT., EXT., ACT, SCENE, FADE IN.

2. Safe deletion

Update delete behavior so deleting a character also removes or safely handles related character_relationships and character_scene_states. Verify DB cascade or delete related rows first in the server function.

3. Scene cleanup source tracking

Current scene sync does not store metadata.source or source block id. If schema supports metadata/source_block_id, write it during sync. If not, infer auto scenes from current manuscript outline and do not promise source-line deep links unless a block id exists.

4. Detected Speakers data source

Characters page must fetch screenplay blocks and derive Detected Speakers from tallyCharacters(blocks). Add ignored detected speaker persistence so ignored names do not keep reappearing.

5. Guided Character Builder safety

“Help me write this” must suggest or fill empty fields only. Never overwrite existing user-written fields without confirmation.

6. Remove Duplicate from the card menu for this pass unless already implemented cleanly. Keep menu to Open / Rename / Delete.

Everything else is approved:

- CastCleanupPanel

- obvious delete

- bulk cleanup

- Cast vs Detected Speakers vs Cleanup

- GuidedCharacterBuilder

- Visual/image generation clarity

- tests

- stability gate

## Files touched

**New**

- `src/components/characters/CastCleanupPanel.tsx`
- `src/components/characters/GuidedCharacterBuilder.tsx`
- `src/components/characters/DetectedSpeakersPanel.tsx`
- `src/components/scenes/SceneCleanupPanel.tsx`
- `src/lib/characters/cleanup.ts` + `.test.ts`
- `src/lib/imageGenStatus.functions.ts`

**Edited**

- `src/lib/editor/manuscriptAnalyzer.ts` (export `looksLikeSuspiciousCharacterName`)
- `src/lib/editor/manuscriptAnalyzer.test.ts`
- `src/lib/import/parser.test.ts`
- `src/components/characters/CharacterProfileDialog.tsx` (guided mode + Visual tab clarity)
- `src/routes/_authenticated/characters.$projectId.tsx` (••• menu, bulk-select, three sections)
- `src/routes/_authenticated/scenes.$projectId.tsx` (mount SceneCleanupPanel)

**Untouched (explicit)**

- `src/components/editor/**`, `useScreenplayDocument`, `ScreenplayLine`, `screenplayKeymap`, `screenplayPersistence`, autosave, entitlements, payments, webhook.

## Not doing (unless you ask)

- Migrating character schema.
- Rebuilding relationships/scene-usage tabs.
- Live multiplayer on characters.