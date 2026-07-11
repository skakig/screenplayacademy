## Emergency Character Route Repair Plan

### Goal
Restore access to the existing Character Builder and Character routes without changing the visual design or rebuilding unrelated character features.

### Scope for this pass
- Fix the broken route composition.
- Stop invalid character URLs from creating phantom records.
- Add explicit builder states: loading, not found, permission/query error, ready.
- Add an Identity first step to the guided builder.
- Make portrait generation configuration visible and non-silent.
- Add focused route-flow tests.

Out of scope for this emergency pass: multi-candidate portrait approval, relationship graph redesign, and full adaptive coaching rewrites. Those should come after routing is proven working.

### Implementation steps

1. **Refactor Characters route hierarchy**
   - Convert `characters.$projectId.tsx` into a layout route that renders only `<Outlet />`.
   - Move the current cast landing/grid page into `characters.$projectId.index.tsx`.
   - Keep the existing landing behavior and styling intact.
   - Ensure child routes can render under:
     ```text
     /characters/$projectId
     /characters/$projectId/build
     /characters/$projectId/build/$characterId
     /characters/$projectId/$characterId
     /characters/$projectId/edit/$characterId
     /characters/$projectId/profile/$characterId
     ```

2. **Add explicit build resolver route**
   - Create `characters.$projectId.build.index.tsx` for `/characters/$projectId/build`.
   - This route is the only route allowed to auto-find or create a character.
   - Behavior:
     - If project has at least one character, redirect to that character’s builder.
     - If project has none, create one intentionally, show a success toast, then redirect to its builder.
     - If creation fails, show an actionable error and return link to Characters.

3. **Remove unsafe auto-create from `$characterId` builder route**
   - Delete the effect that creates `New Character` when `characterId` does not resolve.
   - A stale, deleted, invalid, unauthorized, or failed query must never create a character.
   - The builder route should only load the requested character and render an appropriate state.

4. **Add route-level states to the builder**
   - Add distinct UI paths for:
     - Loading character.
     - Character not found.
     - Access/query error.
     - Ready.
   - Validate that loaded character belongs to the current project before rendering.
   - Provide “Return to Characters” and “Create Character” actions where appropriate.
   - Keep all user-facing strings in translation keys.

5. **Add Identity as guided step 1**
   - Insert a first step before Role:
     - Name
     - Importance
     - Story function
   - Save these fields through the existing character save flow.
   - Update progress/health calculations so Identity counts correctly.
   - Preserve the current builder layout and visual language.

6. **Surface portrait configuration clearly**
   - Wire the existing image-generation status function into the Portrait step.
   - Before generation, show either:
     - Image generation ready, or
     - Image generation is not configured.
   - Disable the generate button when not configured.
   - If the server returns `configured: false`, show a clear message instead of appearing idle.
   - For this emergency pass, keep current single-image generation but prevent silent no-op behavior.

7. **Fix portrait storage durability if schema supports it safely**
   - Audit existing character/asset columns before changing storage shape.
   - If suitable permanent path fields already exist, store and render via permanent path plus fresh signed/render URL.
   - If not, defer the schema migration to the next portrait-workflow pass rather than destabilizing this emergency route repair.
   - Do not keep expanding portrait workflow until routing is verified.

8. **Add focused automated coverage**
   - Add tests for the route hierarchy and menu/link destinations:
     - Characters landing renders at `/characters/$projectId`.
     - “Open Character” / “Guided build” navigate to `/build/$characterId`.
     - Builder route content replaces the grid.
     - Legacy profile/edit routes redirect to builder.
     - Invalid IDs render not-found/error state and do not call create.
     - `/characters/$projectId/build` is the only resolver route that may create.
   - Use existing test conventions and avoid broad unrelated test rewrites.

### Validation checklist
- Open Character visibly leaves the grid.
- Guided Build opens the full-screen builder.
- Save, exit, and reopen persist character data.
- Invalid character IDs do not create records.
- Portrait configuration status is visible.
- If image generation is configured, generated portrait appears on the builder/card.
- No visual redesign, no unrelated Character feature expansion.