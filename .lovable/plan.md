
# Scene Vault — Implementation Plan

A dedicated workshop inside each project where writers stash scenes, dialogue fragments, set pieces, and alternate takes before knowing where they belong — then integrate them into the timeline with an AI-assisted safety check.

## 1. Data model (one migration)

New table `public.vault_scenes`:

- `id uuid pk`
- `project_id uuid → projects` (RLS via `is_project_member` / `can_edit_project`)
- `kind text` — one of: `vault_scene | dialogue_fragment | set_piece | alternate_take`
- `title text`
- `content text` (scene/fragment body)
- `notes text`
- `location text`
- `emotional_tone text`
- `estimated_position text` — one of: `act_1 | act_2a | midpoint | act_2b | act_3 | unsure`
- `tags text[]`
- `status text` — one of: `vaulted | candidate | integrated | alternate | needs_rewrite | locked | deleted` (default `vaulted`)
- `linked_scene_id uuid → scenes(id)` nullable (populated on integration — Copy + link)
- `linked_character_ids uuid[]` (references characters by id, kept as array for corkboard simplicity)
- `alternate_of uuid → vault_scenes(id)` nullable (for Alternate Takes)
- `archived_at timestamptz` nullable
- `created_by uuid`, `created_at`, `updated_at` (+ trigger)

RLS: SELECT/INSERT/UPDATE/DELETE gated by `is_project_member` / `can_edit_project`. GRANTs to `authenticated` + `service_role`.

Also: add nullable `source_vault_scene_id uuid` column on `public.scenes` so an integrated timeline scene links back to its Vault origin.

## 2. Server functions (`src/lib/vault/`)

Client-safe `.functions.ts` files, all `requireSupabaseAuth`:

- `vaultScenes.functions.ts` — `listVaultScenes`, `getVaultScene`, `createVaultScene`, `updateVaultScene`, `archiveVaultScene`, `deleteVaultScene`, `duplicateAsAlternate`.
- `vaultIntegration.functions.ts`
  - `integrateVaultScene({ vaultSceneId, destination, referenceSceneId?, position: 'before'|'after' })` → creates a `scenes` row at chosen order_index (recomputed), sets `vault_scenes.status='integrated'`, `linked_scene_id`, and mirrors the vault content into the new scene's opening `script_blocks` (action block seeded from vault `content`). Never overwrites an existing scene.
- `vaultAi.functions.ts` — Lovable AI Gateway (`google/gemini-3-flash-preview`) via existing `ai-gateway.server.ts`:
  - `suggestPlacement({ vaultSceneId })` → returns ranked `{ act, beforeSceneId?, afterSceneId?, rationale, confidence }[]`. Context: existing scenes list (heading, order, tone), characters, arc beats, vault scene body/tags/tone.
  - `integrationCheck({ vaultSceneId, destination, referenceSceneId? })` → returns categorized warnings: `timeline_contradiction | motivation_mismatch | emotional_continuity | duplicated_beat | premature_reveal | missing_setup | payoff_opportunity`, each with severity + explanation.

Structured output via `Output.object` + Zod (Gemini path — no `structuredOutputs` flag). Handle `NoObjectGeneratedError` with graceful fallback.

## 3. UI

### Vault page — new route `src/routes/_authenticated/vault.$projectId.tsx`

Corkboard aesthetic (not a table): masonry of index-card tiles on a warm paper/cork background, subtle rotation, pushpin accents, tag chips. Uses existing Playfair/Inter tokens.

- Filter bar: kind, status, character, tag, tone, estimated position.
- New card button opens `VaultSceneDialog` (create/edit) with all fields, character multi-select, tag input, tone/position dropdowns.
- Card actions: Open, Suggest Placement, Integrate into Timeline, Duplicate as Alternate, Archive.
- Empty state: "Every great scene starts in the vault." with prominent create CTA.

Components under `src/components/vault/`:
- `VaultCorkboard.tsx`
- `VaultSceneCard.tsx`
- `VaultSceneDialog.tsx` (create/edit form)
- `SuggestPlacementDialog.tsx` (shows AI-ranked destinations, click-to-select)
- `IntegrateDialog.tsx` (destination picker: Act I / II-A / Midpoint / II-B / III / custom before-or-after scene; runs Integration Check; renders categorized warnings; requires explicit "Integrate" confirmation)
- `IntegrationWarningList.tsx`

### Writer's Desk — editor route

In `src/routes/_authenticated/editor.$projectId.tsx` (top-of-editor toolbar area, non-intrusive), add a **New…** dropdown:
- Timeline Scene (existing add-scene behavior)
- Vault Scene
- Dialogue Fragment
- Set Piece
- Alternate Take (requires selecting an existing timeline or vault scene)

Vault items open `VaultSceneDialog` directly with `kind` preselected — no editor context switch. Also add a small "Vault (N)" pill linking to the Vault page.

### Nav

Add "Vault" entry to `ProjectNav.tsx`.

## 4. Integration flow (Copy + link)

1. User clicks Integrate → picks destination.
2. Run `integrationCheck` — show warnings grouped by severity.
3. User confirms → `integrateVaultScene`:
   - Recompute `order_index` for target position.
   - Insert new `scenes` row (`source_vault_scene_id = vault.id`, heading derived from title/location/tone).
   - Seed one `script_blocks` action block from vault content (writer edits from there).
   - Update vault row: `status='integrated'`, `linked_scene_id=<new scene>`. Vault row is preserved.
4. Toast with "Open new scene" link.

## 5. Feel & polish

- Corkboard bg: warm paper texture via CSS gradient + subtle noise; cards use `bg-card` with slight rotation `[--r:-1.2deg]`, soft shadow, pushpin SVG.
- Status chips color-coded (Vaulted=neutral, Candidate=amber, Integrated=emerald, Alternate=violet, Needs Rewrite=rose, Locked=slate, Deleted=muted).
- Micro-copy leans creative ("Pinned to the board", "Sent to the timeline") not database-y.

## 6. Tests

- `src/lib/vault/vaultScenes.test.ts` — server-fn shape + validators.
- `src/lib/vault/integrationCheck.test.ts` — deterministic warning normalization/mapping given a mocked AI payload.
- `src/lib/vault/placement.test.ts` — placement suggestion normalization + ranking clamp.

## Files to create

- Migration (via `supabase--migration`).
- `src/lib/vault/vaultScenes.functions.ts`
- `src/lib/vault/vaultIntegration.functions.ts`
- `src/lib/vault/vaultAi.functions.ts`
- `src/lib/vault/schemas.ts` (Zod)
- `src/lib/vault/*.test.ts` (3 files)
- `src/routes/_authenticated/vault.$projectId.tsx`
- `src/components/vault/VaultCorkboard.tsx`
- `src/components/vault/VaultSceneCard.tsx`
- `src/components/vault/VaultSceneDialog.tsx`
- `src/components/vault/SuggestPlacementDialog.tsx`
- `src/components/vault/IntegrateDialog.tsx`
- `src/components/vault/IntegrationWarningList.tsx`

## Files to edit

- `src/routes/_authenticated/editor.$projectId.tsx` — add "New…" dropdown + Vault pill.
- `src/components/ProjectNav.tsx` — add Vault nav entry.
- `src/routeTree.gen.ts` — regenerated by plugin (do not hand-edit).

## Out of scope

- Real-time collab on vault cards.
- Drag-to-reorder integration onto a visual timeline (destination picker only).
- Bulk integration.
- Auto-integration without confirmation.
- Vault version history (relies on `updated_at` only for now).
- Import/export of vault items.
- Cross-project vault sharing.

## Risks

- AI cost/latency on large projects — mitigate by trimming context to scene headings + short summaries, cap at ~60 scenes.
- Order-index recomputation collisions — wrap in a single transaction and re-fetch after insert.
- Corkboard visual on mobile — fall back to single-column stacked cards, keep rotation subtle.
- `linked_character_ids` as array bypasses FK integrity — acceptable for a workshop surface; clean up dangling ids on read.
