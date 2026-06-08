# Phase 1.5 — Mobile Stabilization for /editor-lab

Goal: make `/editor-lab` writable on iPhone Safari/Chrome with the Null adapter, without touching production `/editor/:projectId` or any other product surface. Stop after desktop + mobile Pass 1 both pass.

## Scope

Only these files change:

- `src/components/editor/ScreenplayDocumentEditor.tsx` — paper tap handler.
- `src/components/editor/ScreenplayLine.tsx` — first-line visibility, slash menu + toolbar focus retention.
- `src/routes/editor-lab.tsx` — small mobile-friendly hint, no behavioral change to adapter logic.
- `src/styles.css` — one or two `.screenplay` mobile rules (min-height for empty first line, placeholder contrast).

Out of scope (do NOT touch): `editor.$projectId.tsx`, `useScreenplayDocument.ts` logic, SupabaseAdapter, StoryPulse, storyboard, table read, Academy, pitch, character engine, AI.

## Problems being fixed

1. On iPhone, the lab page shows a blank paper rectangle — the first empty `scene_heading` textarea has no visible height and no readable placeholder against the warm paper, so users can't see where to tap.
2. The paper-level `onMouseDown` calls `e.preventDefault()` before programmatically focusing a textarea. On iOS Safari, preventing default in a synthetic mouse event during a touch sequence frequently blocks the soft keyboard from opening.
3. The slash menu uses `onClick` with `e.stopPropagation()` — on mobile this blurs the textarea before the command executes, closing the keyboard.
4. The block-type toolbar buttons use `onMouseDown(e.preventDefault())` (good on desktop) but the textarea is not explicitly refocused after the type change, which on mobile can leave the keyboard closed.
5. Lab currently encourages testing Supabase mode before Null mode is confirmed.

## Changes

### 1. First line is visibly writable (ScreenplayLine.tsx + styles.css)

- Add a mobile-safe minimum tap height to empty textareas: `min-h-[2.25em]` (or via a `.screenplay textarea[data-block-editor]:placeholder-shown { min-height: 2.5rem; }` rule in `styles.css`). Applies to all empty lines, not just the first.
- Raise placeholder contrast inside `.screenplay`: `placeholder:text-foreground/40` (currently `muted-foreground/60` which disappears on the warm paper). Verified visually on mobile.
- For the very first empty `scene_heading` (no content, only block in doc), use a friendlier placeholder via prop or by detecting `isFirstEmpty` in `ScreenplayLine`: `"INT. LOCATION - DAY  ·  tap to start"`. Falls back to the existing per-type placeholder for every other case.

No DOM structure change. Still a real `<textarea>`. No ghost div. No button.

### 2. Mobile tap-to-focus (ScreenplayDocumentEditor.tsx)

Rewrite `handlePaperMouseDown` as a `pointerdown` (or `click`) handler with these rules:

- If `e.target` is already inside a textarea/button/input/menu/toolbar → do nothing, let native focus run.
- Else: do NOT call `preventDefault()` on the synthetic event. Find the nearest textarea by Y (existing logic) OR, if the tap is below the last line, call `insertBlockAfter(last, nextBlockTypeAfter(last.block_type))` and then `requestAnimationFrame(() => textarea.focus())`.
- The new block + focus must happen synchronously inside the user gesture so iOS allows the keyboard to open.

Switch the event from `onMouseDown` to `onClick` (or `onPointerUp`) on the paper container — clicks fire after touch on iOS and reliably allow programmatic focus inside the same gesture. Keep desktop behavior intact.

### 3. Slash menu retains focus (ScreenplayLine.tsx)

- Replace slash menu item `onClick` with `onMouseDown={(e) => { e.preventDefault(); executeSlash(t.value); }}` — `preventDefault` on mousedown prevents blur, keeps keyboard open on mobile, and the textarea stays focused after the type change.
- After `executeSlash`, explicitly refocus the textarea (`ref.current?.focus()`).

### 4. Toolbar retains focus (ScreenplayLine.tsx)

- Quick-type toolbar buttons already use `onMouseDown(e.preventDefault())`. Add an explicit `ref.current?.focus()` after `onChangeType(t)` so the keyboard does not close on mobile.

### 5. Lab adapter default + copy (editor-lab.tsx)

- Default remains `null` (already correct). Add a one-line hint: "Verify Null mode first. Switch to Supabase only after Null passes."
- No logic change to the toggle, status pill, or adapter factory.

## Technical notes

- `useScreenplayDocument` already seeds an initial empty `scene_heading` block and sets it active. That call path is unchanged. The fix is purely making that block *visible and tappable* on mobile.
- Programmatic `.focus()` opens the iOS keyboard only when called synchronously inside a user gesture (touchend/click). We must not break that chain with `preventDefault` on the originating event, async timers, or microtask deferrals between the gesture and `.focus()`.
- All styling tokens stay semantic (`text-foreground/40`, etc.) — no hard-coded colors.

## Acceptance — must pass before stop

Desktop (existing Pass 1 from `docs/EDITOR_ACCEPTANCE_TESTS.md`):

- Type the full Stephan/Commander script for 30s, no first-character loss, no blur, no caret jump, no duplicates.

Mobile (new — iPhone Safari at 430×777, Null adapter):

1. Open `/editor-lab` → first writing line is visibly present with a readable placeholder.
2. Tap the first line → keyboard opens, caret appears.
3. Type `int african desert day` → Return → new Action line appears focused, keyboard stays open.
4. Type the sand-sea line → Return → use inline toolbar to set Character → keyboard stays open.
5. Type `STEPHAN` → Return → Dialogue line appears focused.
6. Type for 30s straight, no blur, no duplicates, no swallowed first character.

Verified via the browser tool at 430×777 viewport after the edits.

## Stop condition

Stop after both desktop and mobile Pass 1 pass with the Null adapter. Do NOT proceed to Phase 3 (production `/editor/:projectId` integration) in this pass.
