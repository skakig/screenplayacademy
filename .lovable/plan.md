# Phases 3 & 4 — Story Integration Plan

Building on Phases 1–2 (unified read model in `projectStoryIntelligence.functions.ts`, World Hub Overview showing truthful counts + "Needs Connection" diagnostics), we now unify the Character Bible and make World a first-class connected surface. I'll ship Phase 3 first, verify, then move to Phase 4.

---

## Phase 3 — Character Bible Unification

**Problem today:** `character_bibles` only includes candidates promoted through Importation. Manually created characters never appear, and there's no single "who is in this project's bible" answer.

**Goal:** Every project character (manual or imported) becomes a first-class Bible entry, with source + evidence provenance preserved.

### 3.1 Data model

- New table `character_bible_entries` keyed by `(bible_id, character_id)` — one row per project character per Bible version.
- Columns: `source` (`manual` | `imported`), `evidence_count`, `alias_count`, `scene_appearance_count`, `promoted_candidate_id` (nullable), `snapshot` (jsonb — name/importance/story_function/wound/lie/arc frozen at version time).
- Migration includes GRANTs + RLS (owner/project-member SELECT; service_role writes; INSERT/UPDATE/DELETE via server function only).
- Backfill: on migration, for each existing `character_bibles` row, populate entries from current `characters` + `character_candidates` (promoted refs).

### 3.2 Regeneration server function

- `regenerateCharacterBible(projectId, universeId)`:
  - Loads all non-quarantined `characters` for the project.
  - Joins each to `character_candidates` (via `promoted_ref`) for evidence lineage; manual characters have `source = 'manual'` and `evidence_count = 0`.
  - Writes a new `character_bibles` row (version = latest + 1) and inserts `character_bible_entries` in the same transaction.
  - Idempotent: if inputs haven't changed since latest version (checksum on entry snapshots), returns latest without a new row.

### 3.3 UI updates

- `/character-bible/$projectId/$universeId`: entries list now shows manual + imported, with a `Source` chip and evidence count. Filter tabs: All / Manual / Imported / Missing evidence.
- World Hub Overview "Chars w/ Evidence" and "Needs Connection" now read the latest Bible entries (source of truth), not derived counts.
- Pitch deck bible slides (`characterBiblePdf.ts`) already read `character_bibles`; no code change needed, but content now includes manuals.

### 3.4 Verification

- Unit test: `regenerateCharacterBible` includes manual + imported and dedupes on second call.
- Integration: create project → add manual character → regenerate → confirm entry appears with `source=manual`.
- All existing 946 tests still pass.

---

## Phase 4 — World Builder Action Plan

**Problem today:** `/world/$projectId` is a read-only counter dashboard. Scene headings don't resolve to `world_locations`. World entities have no backlinks to scenes or evidence. No way to create/edit world entities from the UI.

**Goal:** Make World Hub a real builder that connects scenes ↔ locations, exposes evidence for every entity, and lets users create/edit locations/factions/events with proper linkage.

### 4.1 Scene ↔ Location resolution

- Add `scene_location_links` table: `(scene_id, world_location_id, confidence, source)` where `source ∈ {auto_heading, manual, imported_candidate}`.
- Migration + GRANTs + RLS scoped via `is_project_member(project_id)`.
- Server function `resolveSceneLocations(projectId)`:
  - For each scene with `scene_heading`, parse via existing `parseLocationFromHeading`.
  - Match against `world_locations.normalized_key` for the project's universe.
  - Auto-link when exact normalized match; propose (not auto-link) on fuzzy match ≥0.85.
- Read model (`projectStoryIntelligence`) uses these links instead of ad-hoc matching. Diagnostic `sceneLocationsWithoutWorldLink` now becomes actionable proposals.

### 4.2 World entity CRUD (locations first, then factions/events)

- Server functions in `src/lib/importation/world-entities.functions.ts`:
  - `createWorldLocation`, `updateWorldLocation`, `deleteWorldLocation` (soft delete).
  - Analogous fns for factions and events.
  - All validate `can_edit_project`.
- New route `/world/$projectId/locations/$locationId`:
  - Details form (name, description, tags, aliases).
  - "Appears in Scenes" list from `scene_location_links`.
  - "Evidence" tab pulling from `import_evidence` via `candidate_id`.
  - "Merge with…" action for duplicate locations.
- Overview tab gets "New location" / "New faction" buttons for owners/editors.

### 4.3 World Hub Overview upgrades

- "Needs Connection" card gains actionable rows: each unlinked scene shows a "Link to…" dropdown of `world_locations` matches.
- Duplicate-entity diagnostic added (mirroring character duplicate proposals).
- Story Intelligence snapshot cached (React Query, 30s stale) — same pattern as Character Bible.

### 4.4 Verification

- Unit tests: `resolveSceneLocations` auto-links exact matches, proposes fuzzy, ignores headings that can't parse.
- Route test: World Hub renders new "New location" CTA only for editors.
- Full 946+ test run must stay green.

---

## Sequencing & Checkpoints

1. Ship Phase 3.1 + 3.2 (migration + regeneration fn + tests). **Stop and confirm** the migration before touching UI.
2. Ship Phase 3.3 + 3.4 (Bible route UI + verification).
3. **Checkpoint:** confirm Phase 3 works end-to-end before starting Phase 4.
4. Ship Phase 4.1 (scene-location resolution migration + fn + tests). Stop at migration approval.
5. Ship Phase 4.2 (CRUD + location detail route).
6. Ship Phase 4.3 + 4.4 (Overview upgrades + verification).

### Explicitly out of scope for this pass

- Faction hierarchies, event timelines beyond simple lists, map/coordinate visualizations, world-canon versioning (analogous to Bible versions) — these are follow-ups.
- Any change to the screenplay editor typing path.
- Any change to Arena, Academy, or payment flows.

If you approve, I'll start with **Phase 3.1** — the migration for `character_bible_entries` — as the next step.

&nbsp;

Yes. Phase 4 is important enough that Lovable should not improvise the data model.

The prompt should force Lovable to design the **World Graph foundation first**, then build the smallest usable World Builder on top of it.

Here is the prompt I would use:

&nbsp;

**Lovable Prompt — Phase 4 World Graph and World Builder Foundation**

Read first:

[AGENTS.md](http://AGENTS.md)

docs/SCENESMITH_WORLD_[BUILDING.md](http://BUILDING.md)

docs/SCENESMITH_EPIC_FANTASY_UNIVERSE_[PLATFORM.md](http://PLATFORM.md)

docs/ITS_PfHU_[Importation.md](http://Importation.md)

docs/CHARACTER_TRUTH_[ENGINE.md](http://ENGINE.md)

docs/CHARACTER_TRUTH_ENGINE_SOURCE_[SYSTEMS.md](http://SYSTEMS.md)

Also review the completed outputs from:

Phase 1 — getProjectStoryIntelligence

Phase 2 — corrected World Overview

Phase 3 — unified Character Bible

Do not begin implementation until the Phase 1–3 tests pass.

**Objective**

Build the smallest safe and coherent World Builder foundation.

This phase must unify manual creation, imported proposals, project characters, scenes, evidence, and universe-wide world entities.

Do not build Atlas, generated maps, video, image generation, cosmology simulation, military simulation, or advanced AI world generation in this phase.

The result must be a genuinely usable World Builder—not another read-only counter dashboard.

**Core architectural rule**

Do not use an unconstrained polymorphic relationship pattern such as:

entity_table

entity_id

unless PostgreSQL can enforce the referenced entity.

Use a canonical shared World Graph root.

**Phase 4A — Canonical World Entity Root**

Design and implement:

world_entities

Suggested minimum fields:

id uuid primary key

universe_id uuid not null

entity_type text not null

name text not null

normalized_key text not null

description text

canon_status text not null

origin text not null

visibility text not null

created_by uuid

created_at timestamptz

updated_at timestamptz

archived_at timestamptz

metadata jsonb

Supported initial entity_type values:

location

faction

event

rule

artifact

thread

timeline_entry

Do not add future entity types merely to appear comprehensive.

Requirements:

- universe_id must be enforced with a foreign key.
- created_by must reference the authenticated user where appropriate.
- origin must distinguish at least:
  - writer_created
  - imported
  - ai_proposed
  - system_derived
- canon_status must distinguish at least:
  - proposal
  - approved
  - rejected
  - superseded
  - archived
- Do not silently mark imported or AI-generated entities as approved canon.
- Preserve current IDs and records from existing world_* tables.

**Phase 4B — Migration strategy**

Audit the existing tables:

world_locations

world_factions

world_events

world_rules

world_artifacts

world_threads

world_timeline_entries

Choose one of these strategies and justify it before implementation:

**Preferred strategy**

Keep specialized tables and add:

entity_id uuid unique not null

references world_entities(id)

Each specialized table remains responsible for type-specific fields.

Examples:

world_locations.entity_id

world_factions.entity_id

world_events.entity_id

**Alternative strategy**

Migrate common fields entirely into world_entities and retain only type-specific extension tables.

Do not duplicate mutable fields such as name, canon status, origin, or description across both layers unless synchronization is guaranteed.

Requirements:

- Existing records must be backfilled.
- Existing IDs and links must not be lost.
- Migration must be idempotent.
- Provide rollback SQL.
- No destructive table drops in this phase.
- Existing World Hub reads must continue to work during migration.

**Phase 4C — Typed relationships**

Add a canonical relationship table:

world_entity_relationships

Suggested fields:

id uuid primary key

universe_id uuid not null

source_entity_id uuid not null

target_entity_id uuid not null

relationship_type text not null

directionality text not null

valid_from text

valid_to text

canon_status text not null

origin text not null

evidence_count integer

created_by uuid

created_at timestamptz

updated_at timestamptz

metadata jsonb

Foreign keys must reference:

world_[entities.id](http://entities.id)

Examples:

located_in

member_of

controls

opposes

allied_with

created

destroyed

owns

uses

governed_by

caused

precedes

succeeds

connected_to

Do not use unrestricted free-text relationship types without validation.

Create a versioned registry or validated constant set.

Relationship direction must be explicit.

For example:

Faction A controls Location B

must not be indistinguishable from:

Location B controls Faction A

**Phase 4D — Project-specific usage and backlinks**

Universe entities and project usage must remain separate.

Add typed linking tables or a properly constrained common table for:

world entity ↔ scene

world entity ↔ character

world entity ↔ project

Preferred shared linking design:

world_entity_project_links

world_entity_scene_links

world_entity_character_links

Each table must have real foreign keys.

Minimum requirements:

**Project links**

entity_id

project_id

usage_type

first_appearance_scene_id

notes

**Scene links**

entity_id

scene_id

link_type

source_block_id

confidence

origin

canon_status

Possible link_type values:

setting

mentioned

affected

created

destroyed

used

revealed

**Character links**

entity_id

character_id

link_type

valid_from

valid_to

canon_status

Examples:

member

leader

owner

creator

resident

enemy

worshipper

knows_about

Do not automatically convert text mentions into approved links.

Detected links must begin as proposals unless deterministically confirmed.

**Phase 4E — Evidence and provenance**

Do not attach evidence only through historical import candidates.

Add a shared evidence-link model:

world_entity_evidence_links

Suggested fields:

id

entity_id

source_document_id

source_segment_id

import_candidate_id

evidence_type

direct_or_inferred

confidence

excerpt

created_at

Requirements:

- Evidence may support a manually created entity.
- Imported evidence must remain traceable to its source.
- Writer-created entities may have zero evidence.
- Zero evidence must not mean invalid.
- AI inferences must be labeled as inferred.
- Evidence must never be fabricated.
- Rejecting a proposal must not delete source evidence.

**Phase 4F — Revision and audit history**

Add an enforceable revision model.

Preferred:

world_entity_revisions

Fields:

id

entity_id

revision_number

before_state jsonb

after_state jsonb

change_type

author_id

created_at

reason

Requirements:

- Every canonical create, update, archive, merge, approve, reject, and supersede action must be auditable.
- Revisions must not expose data across projects or universes.
- Restore may be deferred, but history must be readable.
- Merges must preserve both source IDs and evidence lineage.

**Phase 4G — Manual creation and editing**

Create a bounded World Builder UI using the existing /world/$projectId route.

Initial editable entity types:

Locations

Factions

Events

Rules

Artifacts

Story Threads

Timeline Entries

Each tab must support:

Create

View

Edit

Archive

Review proposals

Inspect evidence

Link to scenes

Link to characters

Do not implement permanent deletion through the normal UI.

Use archive or supersede.

Each entity form must contain only fields appropriate to its type.

Examples:

**Location**

Name

Description

Location type

Parent location

Interior / exterior

Era or validity range

Aliases

Canon status

Linked scenes

Linked characters

Evidence

**Faction**

Name

Description

Faction type

Leaders

Members

Allies

Enemies

Controlled locations

Beliefs or goals

Era

Evidence

**Event**

Name

Summary

Time or sequence

Location

Participants

Causes

Consequences

Evidence

**Rule**

Name

Statement

Scope

Cost

Constraint

Exception

Known by

Evidence

**Artifact**

Name

Description

Type

Creator

Owner or custodian

Current location

Capabilities

Limits

History

Evidence

**Story Thread**

Name

Question

Status

Introduced in

Linked characters

Linked entities

Payoff target

Evidence

**Timeline Entry**

Label

Linked event

Sequence

Date or calendar expression

Era

Evidence

**Phase 4H — Proposal Review Inbox**

Add a World Review Inbox inside the World Hub.

Supported actions:

Accept as new entity

Merge into existing entity

Reject

Defer

Open evidence

Edit before approval

Requirements:

- Acceptance must be idempotent.
- Merge must not discard candidate or evidence history.
- Reject must not delete the candidate.
- Defer must preserve the proposal.
- Every action must create an audit record.
- No automatic merge based only on name similarity.
- Duplicate suggestions must show confidence, reason, and evidence.

**Phase 4I — Scene-derived location proposals**

Build only the minimal deterministic bridge from screenplay headings.

Read scene headings from:

scenes

script_blocks

Produce normalized location proposals.

Example:

INT. HOTEL LOBBY - NIGHT

may produce:

HOTEL LOBBY

Requirements:

- Preserve the original heading text.
- Store the source block or scene.
- Do not automatically create approved locations.
- Match against existing locations by normalized key and aliases.
- Exact match may be suggested as a link.
- Fuzzy matches remain review proposals.
- One scene may contain multiple detected locations.
- Montages, intercuts, and compound headings must not be silently flattened.

**Phase 4J — Character integration**

World entities must use the existing canonical characters table.

Do not create a separate World Character table.

The World Builder should be able to:

link characters to factions

link characters to locations

link characters to artifacts

link characters to events

link character knowledge to rules or world facts

Manual and imported characters must behave identically once they exist in characters.

Imported provenance remains additional metadata, not a separate identity.

**Phase 4K — UX requirements**

The World Builder must not feel like a database admin panel.

World Hub Overview should show:

World at a glance

Needs review

Recently changed

Entities used in the current project

Unlinked story elements

Continuity concerns

Each entity card should show:

name

type

canon status

origin

evidence coverage

linked scenes

linked characters

last updated

Provide clear empty states:

No factions yet

Create one manually or review detected proposals

Do not display empty grids filled with zeros as the primary experience.

On tablet and mobile:

- tabs may scroll horizontally,
- forms must fit without sideways page overflow,
- evidence drawers must become full-screen sheets,
- actions must remain reachable.

**Phase 4L — RLS and authorization**

Before implementing writes, document and test:

Owner

Editor

Commenter

Viewer

Suggested capabilities:


|           |          |                 |                   |              |             |
| --------- | -------- | --------------- | ----------------- | ------------ | ----------- |
| **Role**  | **Read** | **Create/Edit** | **Approve Canon** | **Merge**    | **Archive** |
| Owner     | Yes      | Yes             | Yes               | Yes          | Yes         |
| Editor    | Yes      | Yes             | Configurable      | Configurable | No          |
| Commenter | Yes      | No              | No                | No           | No          |
| Viewer    | Yes      | No              | No                | No           | No          |


All writes must verify:

project access

universe access

entity belongs to universe

linked character belongs to allowed project

linked scene belongs to allowed project

Do not rely only on client-side role checks.

Add RLS tests for cross-project and cross-universe access.

**Phase 4M — Tests**

Required before completion:

Migration backfill preserves existing world records

Manual location creation works

Manual faction creation works

Proposal acceptance is idempotent

Merge preserves evidence

Rejected proposal remains auditable

Scene link enforces valid foreign keys

Character link enforces valid foreign keys

Cross-project writes fail

Cross-universe writes fail

Archived entity no longer appears in active lists

Existing World Hub routes still work

Existing Character and Editor tests still pass

Add one full integration test:

Writer creates a location

→ links an existing character

→ links a scene

→ imports a source mentioning that location

→ reviews the proposal

→ merges the evidence into the existing location

→ World Overview updates

→ no duplicate canonical location is created

**Implementation sequence**

Implement in this order only:

4A World entity root

4B migrations and backfill

4C relationships

4D project/scene/character links

4E evidence

4F revisions

4G manual CRUD

4H proposal inbox

4I scene-location proposals

4J character integration

4K UX refinement

4L RLS

4M acceptance

Stop after each numbered subphase and report:

changed files

migration result

tests

screenshots

known risks

next subphase

Do not combine the entire phase into one uncontrolled implementation.

**Deliverables before coding**

Before implementing Phase 4A, return:

1. Verified live schema.
2. Proposed ER diagram.
3. Migration/backfill plan.
4. Decision on common versus specialized fields.
5. Relationship-type registry.
6. RLS matrix.
7. Exact files to create or modify.
8. Rollback plan.
9. Phase 4A acceptance tests.

Stop and wait for approval.

&nbsp;

That gives Lovable a very narrow path:

one canonical World identity layer

→ enforceable relationships

→ evidence

→ project usage

→ manual creation

→ proposal review

→ integrated characters and scenes

It also prevents the two most likely mistakes:

building another disconnected set of tables

and:

using generic entity_table/entity_id links with no foreign-key safety

&nbsp;

Proceed with Phase 3.1

&nbsp;