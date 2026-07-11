## Two fixes in one pass

### A) Focus Mode toolbar alignment + clarity

**Problem (from screenshot):**

- The Scene Heading chip strip renders inside the page column, wrapping raw placeholder text (``INT. . . . . AFRICAN DESERT`)` into the toolbar and colliding with the black chip pill above it.
- The bottom accessory row stacks three separate floating clusters (`NOW: Parenthetical`, `Focus Mode / Exit Focus / Press Esc`, `AI continue`, `Vault (0)`, language pill) that were positioned independently, so on tablet widths they overlap the "AI continue" button and the Vault chip.
- In Focus Mode the user cannot tell what each toolbar does — labels are truncated and the block-type pills are cut off at the top of the page.

**Solution — single "Keyboard Accessory Bar" pattern (industry standard: iOS/Notion/Highland):**

1. Introduce `FocusAccessoryBar.tsx` — one fixed bottom bar, safe-area padded, `env(safe-area-inset-bottom)`, height 56px, that hosts three grouped zones with clear dividers:
  - **Left — Context**: current block-type pill (`Parenthetical`) + inline block-type cycler (chevrons ← → replacing the top floating cycler).
  - **Center — Contextual chips**: SceneHeadingChips / RecentCharacterChips render *inside* this bar (not inside the page column) when the active block calls for them. Chips scroll horizontally with fades on both sides so nothing wraps.
  - **Right — Actions**: `AI Continue`, `Vault`, language — collapsed into a single overflow menu on <900px so nothing overlaps.
2. Remove the in-page chip strip render path in Focus Mode. The chips only live in the accessory bar; the manuscript page stays clean (matches iA Writer / Highland behavior).
3. Replace the current three floating clusters with one `FocusToolbar` at the top center: `Focus Mode · Exit Focus · ⌘. toggle`, sized to content, never overlapping content because the manuscript gains `padding-top: 56px` in Focus.
4. Add a subtle 1px border-t and `bg-background/85 backdrop-blur` so the bar reads as chrome, not content — same treatment top and bottom for visual pair.
5. All strings routed through `t(...)` (`editor.focus.*`) — no hardcoded labels.
6. Aria: bar gets `role="toolbar"` + `aria-label="Focus mode toolbar"`; chip strip inside is a nested `role="group"`.

**Files touched (UI only):**

- New: `src/components/editor/FocusAccessoryBar.tsx`, `src/components/editor/FocusToolbar.tsx`
- Edit: `src/routes/_authenticated/editor.$projectId.tsx` (render new bars only when `focus === true`; drop the three legacy floaters in that branch).
- Edit: `src/components/editor/ScreenplayLine.tsx` — suppress in-page `SceneHeadingChips` / `RecentCharacterChips` when `focus === true` (they render in the bar instead).
- Add i18n keys under `editor.focus.*` in `src/lib/i18n/keys.ts`.

**Out of scope:** the regular (non-Focus) editor chrome. No behavior change to typing, Enter/Tab, save, or coach.

---

### B) Character Builder — Portrait becomes the final step, powered by the full profile

**Problem:** Portrait is currently a mid-flow step. Users generate before they've defined wound/lie/voice/arc, so images drift and re-generation is wasted credits. There's also no shared style contract, so two characters from the same project don't visually belong to the same film.

**Best-in-class solution (mirrors Midjourney "sref" + Character.ai "definition" pattern):**

1. **Reorder steps.** Move `portrait_url` to the last position in `STEPS[]` inside `characters.$projectId.build.$characterId.tsx`. Identity → Role → Want → Pressure → Fear → Wound → Lie → Relationships → Voice → Arc → **Portrait**.
2. **Portrait step gate.** Show a readiness meter: portrait unlocks with a soft "Recommended: complete 7+ steps for a truthful portrait." Users can still generate early with a warning toast, but the default CTA only lights up when strengths ≥ 7.
3. **Project Style Contract (new, project-scoped).** Store one row per project on `projects.visual_style` (jsonb) with:
  - `medium` (photographic / painterly / graphic novel / anime)
  - `era` + `region` (auto-suggested from scene headings)
  - `palette` (3 hex tokens)
  - `lighting` (natural / high-key / chiaroscuro / neon)
  - `lens` (35mm / 50mm / 85mm / anamorphic)
  - `grain`, `aspect`, `negative_prompt`
   First character generation opens a one-time "Set your film's look" dialog; subsequent characters inherit it (editable per-project from Settings → Look).
4. **Prompt Composer (`src/lib/characters/portraitPrompt.ts`).** Deterministic builder that merges Style Contract + character profile into a single prompt:
  ```
   {medium} portrait of {name}, {age_hint from role}, {physicality from voice/role},
   {emotional_truth from wound + lie}, {wardrobe from era/region + importance},
   {lens} lens, {lighting}, {palette} palette, {grain}, aspect {aspect}.
   Negative: {negative_prompt}, no text, no logos, no watermark.
  ```
   Same builder is reused for every character so the cast looks like one film.
5. **Seed reuse for consistency.** Store `portrait_seed` (int) per character; regeneration keeps the seed unless the user clicks "Reroll seed". Cross-character consistency comes from Style Contract + shared negative prompt; individual identity comes from the character-specific tokens + fixed seed.
6. **Model & endpoint.** Use existing `generatePortrait` server fn — swap its internal prompt assembly to call the composer. Model stays `openai/gpt-image-2`, `quality: "low"`, `stream: true`, `partial_images: 1`, so users see progressive frames with the blur→sharp reveal.
7. **Permanent storage.** Upload each finalized PNG to `character-portraits` bucket at `projects/{projectId}/characters/{characterId}/{seed}.png`; store `portrait_path` (permanent) + `portrait_url` (signed, refreshed on read). Fixes the "expired URL" fallback we already ship.
8. **UI on the Portrait step.**
  - Left: live preview with 3 partial → final frames.
  - Right: the composed prompt shown read-only with an "Edit style" link that opens the Style Contract dialog (not the raw prompt — protects consistency).
  - Bottom: "Regenerate (same seed)" and "Reroll seed" split button; credit cost surfaced.
9. Use character information created in the Character Builder to suggest a good voice from ElevenLabs so it's auto selected, and each character must have a unique ID so we don't get duplicate voices... (Hans already has voiceID: 97493o098u, etc... so that's reserved for Hans. Stephan needs a different voiceID so he is unique.)

**Files touched:**

- Edit: `src/routes/_authenticated/characters.$projectId.build.$characterId.tsx` (reorder STEPS, gate + new Portrait panel).
- New: `src/lib/characters/portraitPrompt.ts` + tests.
- New: `src/components/characters/StyleContractDialog.tsx`.
- Edit: `src/lib/characters.functions.ts` — `generatePortrait` uses composer, writes `portrait_path` + `portrait_seed`.
- Migration: add `projects.visual_style jsonb`, `characters.portrait_path text`, `characters.portrait_seed int`, `character-portraits` storage bucket with owner RLS + `service_role` ALL grant.
- i18n: `characters.builder.portrait.*` and `characters.style.*` keys.

**Out of scope:** multi-candidate portrait grids, video, storyboard reuse — a follow-up pass once the single-portrait + style contract flow is proven.

---

### Validation checklist

- Focus Mode on tablet width shows exactly two chrome bars (top pill, bottom accessory) with no overlap; chips scroll horizontally, never wrap.
- No in-page chip strip appears while Focus is active.
- Portrait step is step 10 of 10; disabled state explains the gate.
- Second character in the same project inherits the Style Contract and produces a visually related portrait.
- Reload restores the stored portrait via `portrait_path` + fresh signed URL.