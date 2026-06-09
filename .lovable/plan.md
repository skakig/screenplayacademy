## Pass 3 — Production Integration of the Local-First Screenplay Engine

### Current state (verified)

`src/routes/_authenticated/editor.$projectId.tsx` already:
- Mounts `ScreenplayDocumentEditor` with `initialBlocks={blocks}`, `onActiveBlockChange`, `onSaveStatus`, `onLastSaved`, `onBlockCreated`.
- Holds only `activeMeta` (localId/serverId/type/orderIndex) for side panes — no longer owns `addBlock`, `saveBlock`, `pendingTempContent`, `inFlightSaves`, `focusBlockId`, or temp-ID juggling.
- Uses `editorRef` (`changeActiveType`, `insertAtEnd`, `insertAfterActive`, `jumpToServer`) for toolbar / command bar / nav actions.
- Keeps the Logline vs. manuscript fork via `shouldUseLoglineComposer(guidedStep)`.
- Fires `block_created` / `scene_created` writer events via `onBlockCreated`.

`useScreenplayDocument` already supports an injected `persistence` adapter; when none is passed it runs a legacy built-in Supabase path. Production currently passes none, so it uses the legacy path — that is the gap.

`SupabasePersistenceAdapter` (Pass 2) is proven in `/editor-lab` and matches the contract: single-flight inserts, deferred updates, fire-and-forget deletes, in-place `queryClient.setQueryData(["blocks", projectId], …)` patching, **never** `invalidateQueries` during typing.

### Goal

Make the production editor use the same proven adapter, and make export read from local blocks. Nothing else moves.

### Scope of changes

1. **Wire `SupabasePersistenceAdapter` into the production editor**
   - In `editor.$projectId.tsx`, build the adapter once per `(projectId, queryClient)` with `useMemo`:
     ```ts
     const persistence = useMemo(
       () => createSupabasePersistenceAdapter({
         projectId, queryClient: qc,
         onSaveStatus: setSaveStatus, onLastSaved: setLastSavedAt,
       }),
       [projectId, qc]
     );
     ```
   - Pass `persistence={persistence}` to `<ScreenplayDocumentEditor />`.
   - Remove `onSaveStatus`/`onLastSaved` props from the editor element (the adapter now owns the status stream); the hook's legacy status callbacks become inert when adapter is supplied.
   - Result: typing path no longer touches the hook's legacy Supabase branch in production.

2. **Expose local blocks for export**
   - Add to `ScreenplayEditorHandle`: `getBlocks: () => LocalBlock[]`.
   - Implement in `ScreenplayDocumentEditor` via `useImperativeHandle` returning `doc.localBlocks` through a ref (read-on-call, not snapshot).
   - In the route, change Copy and Download .txt buttons to call `editorRef.current?.getBlocks()` and feed those to `formatExport`. Keep server-blocks fallback only if the ref is unavailable (defensive).

3. **Retire the legacy Supabase path in the hook (safe cleanup)**
   - In `useScreenplayDocument.ts`, since both production and lab will now pass an adapter, remove `runInsert` / `runUpdate` / `runDelete` and the inline `supabase` import.
   - `deleteBlock` already calls `persistence.queueDelete` when adapter present; remove the `void runDelete(target.serverId)` else branch.
   - Removes the "two paths" risk and ensures all I/O flows through the adapter contract.
   - If safer for one pass, keep the legacy path but guarantee production always supplies an adapter; recommend removal in this pass to honor the contract ("editor hook owns local state only").

4. **Side panes & analyzers stay on the React Query cache (no change)**
   - `StoryNavigatorPane`, `CoachPane`, `useManuscriptAnalyzer`, `buildOutline`, `estimatePages`, `currentPage`, `cmdAiContinue`, `runAi` continue to read `blocks` from `useQuery(["blocks", projectId])`. The adapter patches that cache in place after each successful sync, so these refresh without interrupting typing. **No `invalidateQueries(["blocks", projectId])` is added anywhere in the typing path.**
   - `insertTemplate` (bulk AI/template insert) still invalidates `["blocks", projectId]`. That is intentional and only fires on explicit user actions (AI draft, opening template) — never during typing. Acceptable for Pass 3; flagged as a follow-up if it ever causes a race.

5. **Active-block plumbing already correct**
   - `activeBlockId = activeMeta?.serverId ?? null` is used only by side panes / outline / jump — not by the editor itself. Pre-persistence blocks won't highlight in nav for a brief moment; acceptable and matches lab behavior.

6. **Guided / Logline behavior preserved** — no change to the `isLoglineStep` branch.

7. **Mobile** — the editor component itself carries the Pass 1.5 mobile fixes (paper `onClick` focus, min-height, placeholder contrast, slash/toolbar `onMouseDown`+focus restore). Production picks them up automatically by mounting the same component.

### Files touched

- `src/routes/_authenticated/editor.$projectId.tsx` — add adapter import + `useMemo`, pass `persistence`, switch Copy/Download to `getBlocks()`.
- `src/components/editor/ScreenplayDocumentEditor.tsx` — extend `ScreenplayEditorHandle` with `getBlocks`, implement.
- `src/components/editor/useScreenplayDocument.ts` — remove legacy Supabase branch (`runInsert`/`runUpdate`/`runDelete` + `supabase` import); keep adapter path only.

No other files modified. No DB migrations. No new dependencies.

### Out of scope (do not touch)

StoryPulse, storyboard, table read, Academy, pitch, pricing, auth, onboarding, Character Engine ITS/PfHU, new AI features, visual redesigns, FeatureDock, EditorCommandBar internals, GuidedRail.

### Acceptance test (run after the change)

On `/editor/$projectId`, desktop + iPhone 14 Pro Max:
1. Open a project. Type `int african desert day` → Enter.
2. Type `The sun burns across an endless sea of sand.` → Enter.
3. Tab to Character, type `STEPHAN` → Enter.
4. Type `Just a few more clicks.` → Enter.
5. Type `COMMANDER` → Enter → `You are lost, soldier.`
6. Keep typing ~30 s.

Expected: no first-character loss, no caret jump, no blur, no duplicate blocks, correct Scene Heading → Action and Character ↔ Dialogue transitions, refresh restores all content, autosave pill cycles `dirty → saving → saved`, side panels (page count, scene list, coach) update without interrupting typing, Copy/Download produce the just-typed text. Mobile keyboard opens on tap, first line visible.

### Stop condition

Stop after production `/editor/$projectId` passes the same acceptance test as `/editor-lab`. Do not begin StoryPulse, storyboard, table read, Academy, pitch, AI, or Character Engine work.
