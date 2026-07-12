# Studio Menu Repair + World Hub + Owner-Only Arena Preview

Scope-locked pass. No new feature streams. Make already-implemented systems visible/testable to the owner; consolidate the duplicate Editor/Producer menu links behind a real destination map; keep unfinished features owner-gated.

## Phase 1 — Certification (report first, no code)

Run and capture output, before touching anything:

1. `bun run build`
2. `bunx vitest run`
3. `bun scripts/generate-route-matrix.ts` (route matrix)
4. `bun scripts/i18n-verify.ts`
5. `/editor-lab` acceptance (typing / Enter / Tab transitions per AGENTS.md)
6. `/editor/$projectId` production acceptance (same script)
7. Importation smoke: extraction → resolution → render
8. `src/lib/importation/promotion.test.ts` (character promotion + idempotency)
9. Character Bible generation + PDF (`character-bible-export.functions.ts`, `characterBiblePdf.ts`)

Report failures verbatim. Do not proceed to Phase 2 code changes if any fail; fix in place with the smallest change and re-run.

## Phase 2 — Project ↔ Default Universe Resolver

Fix the "everything goes to the same link" root cause: several menu items point at project routes that don't exist yet because there's no universe to route to.

- New server fn `resolveDefaultUniverse({ projectId })` in `src/lib/importation/universe.functions.ts`:
  - `requireSupabaseAuth` middleware; RLS enforces ownership.
  - Look up `story_universes` where `project_id = $1` ordered by `created_at asc`; return the first.
  - If none exists, do NOT auto-create — return `{ universeId: null, canCreate: true }`.
- New server fn `ensureDefaultUniverse({ projectId, title })` — explicit, idempotent:
  - `INSERT ... ON CONFLICT (project_id) WHERE is_default DO NOTHING RETURNING id` (add `is_default boolean` + partial unique index in a migration).
  - Returns the existing or newly-created universe id.
- Migration: add `is_default` column + partial unique index `(project_id) WHERE is_default` on `story_universes`. Backfill: mark the earliest per project as default.
- Client hook `useDefaultUniverse(projectId)` wraps the resolver; caller decides whether to prompt the user to create one.
- Preserve existing `/importation/$projectId/$universeId(/$documentId)` and `/character-bible/$projectId/$universeId` routes untouched.

## Phase 3 — World Hub (read-only)

New route: `src/routes/_authenticated/world.$projectId.tsx`.

- On mount: `useDefaultUniverse(projectId)`.
  - No universe → empty state with single "Create world workspace" button calling `ensureDefaultUniverse`. Nothing else visible.
  - Universe present → tabbed shell.
- Tabs (all read/proposal only — no canon writes, no new AI extraction):
  1. **Overview** — counts + latest activity from existing tables.
  2. **Sources** — list `source_documents` with status; links into existing Importation Center.
  3. **Character Bible** — latest version summary + link to existing bible route.
  4. **Locations / Factions / Events / Rules / Artifacts / Story Threads / Timeline** — render whatever rows already exist in the DB (or graceful empty state). Each row shows source/evidence chips when present.
- Every tab: explicit loading, empty, error+retry, and permission-denied states.
- No Atlas, no map generator, no cosmology builder, no new AI extraction system, no silent promotion.
- Any "promote" affordances route through existing approval flows only; if none exists for that entity type, the tab stays read-only with a "Proposals only" badge.

## Phase 4 — Menu Wiring (fix the duplicate-links problem)

Root cause today: several Editor/Producer manifest entries map to project routes that share a fallback destination, so with-project users see multiple items that navigate to effectively the same place.

Edit `src/components/studioMenuManifest.ts` only (StudioMenu already consumes the manifest):

- Audit each Editor/Producer entry — confirm `to`, `iconName`, `desc`, `needsData`, and the resolved gate destination in `resolveMenuGate` are all distinct. Fix any that resolve to the same href when a project is selected. Any menu item without a real distinct destination is removed rather than duplicated.
- Add ONE project-level entry: **World** → `/world/$projectId` (needs project). Do NOT list Locations/Factions/Timeline/etc. in the main menu — they live inside the hub.
- Move Importation and Character Bible entry points into the World Hub (drop them from the top-level menu; StudioMenu keeps only the World row for that surface).
- Add a **Snapshot & Confirm Distinct Destinations** test in `src/components/StudioMenu.destinations.test.tsx` that fails if any two items with the same `needsData: "project"` resolve to the same href for a fixed projectId.
- No changes to `resolveMenuGate` semantics, subscription tiers, entitlements, or pricing.

## Phase 5 — Arena Owner Preview (gated)

Only after GitHub Issue #26 gates pass locally:

- Completed Results reopen
- Past rounds selectable
- Collaborator names + avatars resolve
- Blind self-entry marked without revealing identity
- Self-voting controls hidden for own entry
- Loading / empty / error / retry states pass
- Mobile + tablet layouts pass
- Arena may create Suggestions only — never mutate screenplay blocks directly

Then:

- New route `src/routes/_authenticated/arena.$projectId.tsx` reusing existing Arena components.
- Menu entry appears only when `useIsAdmin()` is true; labeled **"Arena — Owner Preview (Alpha)"**. Non-admins never see it. No tier/pricing/entitlement changes.

Explicitly NOT in this pass: SceneSmith Studio Score, Fan Votes, Round 2/3 progression, Voice Studio, Review Intelligence, Atlas, audiobook production, Scene-to-Screen.

## Technical Details

- **Files touched (expected):**
  - `supabase/migrations/*_story_universes_default.sql` (new)
  - `src/lib/importation/universe.functions.ts` (new)
  - `src/hooks/useDefaultUniverse.ts` (new)
  - `src/routes/_authenticated/world.$projectId.tsx` (new)
  - `src/routes/_authenticated/arena.$projectId.tsx` (new, admin-only render)
  - `src/components/studioMenuManifest.ts` (edit — dedupe + add World + admin Arena)
  - `src/components/StudioMenu.destinations.test.tsx` (extend)
  - `src/components/world/*` (thin read-only tab views)
- **RLS:** all new server fns use `requireSupabaseAuth`; `story_universes` policies unchanged; migration only adds column + partial unique index + backfill.
- **No** edits to auto-generated files, no `.env` changes, no new secrets, no subscription/pricing changes.

## Deliverables at end of build pass

- Phase 1 test/build output pasted back
- List of changed files
- Screenshots of `/world/$projectId` (empty + populated) and the Studio Menu showing the deduped Editor/Producer groups + owner-only Arena row
- Known risks (e.g. universes without `is_default` after backfill, tabs with zero rows)
- Acceptance results for Issue #26 gates
- Recommended next bounded pass (likely: promote-from-hub UX or Arena Round 2 gating)
