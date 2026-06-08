## Audit of the previous plan against your 8 corrections

| # | Correction | Status in current code |
|---|---|---|
| 1 | Ghost line creates block on **focus/click**, not on first keystroke | NOT met. `ScreenplayDocumentEditor` still uses `onBeforeInput` to stash the first character and forward it. |
| 2 | Single owner of temp-id + pending content | Partially met. Route owns `pendingTempContent` + temp-id swap. But the ghost line also routes typed characters through `initialContent`, which is a second buffering path. |
| 3 | Never invalidate `["blocks", projectId]` after ordinary insert/save | NOT met. `saveBlock` invalidates when `patch.metadata` is set, `deleteBlock.onSuccess` invalidates, `restoreRecovery` invalidates. |
| 4 | Local focused text always wins | Mostly met (focusedRef + dirtyRef guards in BlockEditor). Save-in-flight guard not explicit. |
| 5 | Brand-new project: auto-create scene heading, focus immediately | NOT met. Empty state focuses the ghost line; first block is created only when the user types/clicks. |
| 6 | Trailing line must not look/feel like a button | Partially met (it's a textarea), but it still shows "Enter · Tab change type · / menu" as a visible affordance next to the caret. |
| 7 | Slim route, preserve all features | Met. |
| 8 | Manual acceptance test | Not verified against current code; gaps above will cause regressions. |

## Fix plan

### A. Editor corrections (corrections 1, 2, 5, 6, plus 3 & 4 cleanup)

**1. `src/routes/_authenticated/editor.$projectId.tsx`**

- **Auto-seed first block (correction 5).** Add a one-shot effect: when `!blocksLoading && blocks.length === 0`, call `addBlock.mutate({ block_type: "scene_heading" })` and set `focusBlockId` to its temp id. Guard with a ref so it runs at most once per project mount.
- **Stop invalidating on writes (correction 3).**
  - Remove `qc.invalidateQueries({ queryKey: ["blocks", projectId] })` from `saveBlock` (the metadata branch) — patch the cache in place for metadata too.
  - Replace `deleteBlock.onSuccess` invalidation with a `qc.setQueryData` filter that removes the deleted row.
  - In `restoreRecovery`, replace the trailing `invalidateQueries` with `qc.setQueryData` patches per restored row.
- **Save-in-flight guard (correction 4).** Track `inFlightSaves: Set<string>` in `saveBlock`; skip cache-driven prop updates for those ids by exposing the set down to `BlockEditor` via a prop (`isSaving(blockId)`), and have `BlockEditor`'s sync effect early-return when `isSaving(block.id)` is true (in addition to `focusedRef`/`dirtyRef`).

**2. `src/components/editor/ScreenplayDocumentEditor.tsx`**

- **Ghost line creates on focus, not first keystroke (correction 1).**
  - Replace the `<textarea data-ghost-line>` with a focusable element (a zero-width `<button type="button">` styled as a caret line, OR a `<div tabIndex={0}>`) that, on `focus` or `mousedown`, calls `handleGhostInsert("")` and immediately blurs itself. No `onBeforeInput`, no character stashing, no `initialContent` from the ghost.
  - `handleGhostInsert` keeps its current signature for paste support but is no longer called with typed characters during normal typing — only `""` on focus/click, or pasted text on paste.
  - Result: focus → insert mutation → optimistic temp block → `setFocusBlockId(tempId)` → `BlockEditor`'s `focusBlockId` effect focuses the real textarea before the user's first keystroke lands. Single buffering path (the existing `pendingTempContent` in the route, used only for paste).
- **Tone down trailing affordance (correction 6).** Remove the "Enter · Tab change type · / menu" hint from the ghost row. Keep only the blinking caret. The keyboard legend already exists elsewhere (toolbar / shortcut sheet) — that's where hints belong.
- **Empty-state copy.** With correction 5 above, the empty state will rarely show; keep the "Start your screenplay" header only for the brief skeleton window. Optional: move it into the route and gate on `addBlock.isPending && blocks.length === 0`.

**3. Manual acceptance test (correction 8).** After the changes above:
- New project → caret already blinking on a real scene-heading line (no ghost involved).
- Typing `int african desert day` flows into that real line directly → no first-character risk.
- Enter creates Action line via `insertBlockAfter`; `setFocusBlockId(tempId)` + sync save-in-flight guard keep focus and value stable across the temp→real swap.
- 30s typing test: no cache invalidations fire on insert/save, so no remount/blur.

### B. Google OAuth redirect fix

Root cause: `handleGoogle` passes `redirect_uri: window.location.origin`. After Google returns, the user lands on `/` (Landing page), which has no auth check, so it looks like a reload that "did nothing." The session is set, but no navigation happens.

Fix in `src/routes/auth.tsx`:
- Change `redirect_uri` to `` `${window.location.origin}/dashboard` ``. That sends the OAuth completion straight into the authenticated subtree, whose `_authenticated/route.tsx` gate now sees the user and renders the dashboard.
- Keep the existing `getUser()` mount check so the auth page itself still redirects already-signed-in users.

No changes to `lovable.auth` integration, providers, or env. No backend changes.

### Files touched

- `src/routes/_authenticated/editor.$projectId.tsx` — auto-seed first block; drop invalidations on insert/save/delete/restore; add `inFlightSaves` set + `isSaving` prop.
- `src/components/editor/ScreenplayDocumentEditor.tsx` — replace ghost textarea with focus-trigger element; remove visible keyboard hint on ghost row; thread `isSaving` into `BlockEditor` sync guard.
- `src/routes/auth.tsx` — `redirect_uri` → `/dashboard`.

No DB / RLS / dependency changes.

### Acceptance

1. Brand-new project loads → caret blinks on a scene-heading line with **no** ghost click required. Type immediately; no character is lost.
2. Enter / Tab / `/` behavior unchanged.
3. Continuous 30s typing: no blur, no caret reset, save indicator flips quietly.
4. Click below last line → focus jumps onto a freshly created real block (focus event creates the block, not the keystroke).
5. Google sign-in → after Google's redirect, user lands on `/dashboard` without manual reload.
