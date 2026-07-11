## Audit findings

1. **The Studio Menu still routes Characters to the cast grid**
   - `src/components/StudioMenu.tsx` and `src/components/studioMenuManifest.ts` still define Characters as `/characters/$projectId`.
   - That explains why clicking the editor/top Studio Menu can still show the grid instead of the guided builder.

2. **The Characters route is incorrectly gated by “needs characters”**
   - The menu manifest marks Characters with `needsData: "characters"`.
   - `RouteReadinessGate` wraps `/characters/$projectId` and the new builder route, so empty projects can block the exact flow that should create the first character.

3. **There is no “open/create first character” route for menu links**
   - `/characters/$projectId/build/$characterId` requires a character ID.
   - Menu links often only know the project ID, so they need a resolver route like `/characters/$projectId/build` that finds or creates the first character, then redirects to `/characters/$projectId/build/$characterId`.

4. **Some internal links still point to the cast overview**
   - `StoryBuilderPanel`, `CoachPane`, and Table Read empty-state links still point to `/characters/$projectId`.
   - Those should point to the builder resolver when the action is “create/open a character.”

5. **Builder AI/portrait functions are at risk of runtime failure**
   - `src/lib/characters.functions.ts` server function handlers reference module-scope helper functions in the same file. TanStack Start can strip those during server-function splitting, causing runtime `ReferenceError` even when TypeScript passes.
   - This especially affects “Help me write this” and portrait generation.

## Recovery plan

1. **Add a builder resolver route**
   - Create `/characters/$projectId/build`.
   - It will:
     - list existing project characters,
     - create “New Character” if none exist,
     - show a clear success toast for the first character,
     - navigate to `/characters/$projectId/build/$characterId`.

2. **Make the editor/top Character menu open the guided builder**
   - Update `StudioMenu.tsx` and `studioMenuManifest.ts` so the Characters menu item points to `/characters/$projectId/build`.
   - Remove `needsData: "characters"` from the Characters item because Characters is the tool used to create that data.
   - Keep the cast grid as a secondary “Cast Overview” surface, not the main Character editor destination.

3. **Fix route gating deadlocks**
   - Remove or bypass `RouteReadinessGate` on:
     - `/characters/$projectId`, because it must work even with zero characters,
     - `/characters/$projectId/build/$characterId`, because an empty/new character should be buildable.
   - Keep project/tier gates where appropriate, but do not block on missing character data.

4. **Update every internal character CTA**
   - Links that mean “add/open/build a character” should use `/characters/$projectId/build`.
   - Links tied to a specific character should use `/characters/$projectId/build/$characterId`.
   - Links that explicitly mean “review the whole cast/inbox” can remain `/characters/$projectId`.

5. **Stabilize the guided builder itself**
   - Add a first-class identity/name step or make the first step clearly capture both name and role, so “New Character” can become a real character immediately.
   - Add not-found handling if a character ID is invalid.
   - Ensure Save, Save & Continue, AI suggestions, and portrait generation all refresh the right character query.

6. **Refactor character server-function helpers safely**
   - Move AI/helper logic used by server functions into a `.server.ts` helper module or inside each handler.
   - This prevents TanStack server-function splitting from breaking Help-me-write, generation, delete/undo, and portrait flows at runtime.

7. **Add regression coverage**
   - Test that the Studio Menu Characters item is not marked “Needs characters.”
   - Test that empty-project character entry creates the first character and resolves to `/characters/$projectId/build/$characterId`.
   - Test that no old tabbed dialog import remains.
   - Test that legacy routes still redirect to the guided builder.

8. **Verify in the preview**
   - Fresh project: click Character from editor menu → first character is created → guided builder opens.
   - Existing project: click Character from editor menu → guided builder opens for an existing character.
   - Cast grid: Open Character and card portrait clicks open the guided builder.
   - Builder: save text, use starter prompts, generate a suggestion, and attempt portrait generation with proper error/success messaging.