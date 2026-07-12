# World / Character / Universe Integration Audit & Plan

Stop-line: audit + plan only. No UI redesign, no Atlas, no maps, no AI gen. Nothing is implemented until you approve each phase.

---

## 1. System-of-Record Diagram

```text
                    projects
                       │ user_id (owner) / project_members
                       │
              default_universe_id
                       ▼
                 story_universes ─────────────┐
                       │                      │
   ┌────────── source_documents ── source_segments ── import_evidence
   │                   │                      │
   │              import_extraction_runs      │
   │                   ▼                      │
   │            import_candidates ── promoted_ref ─┐
   │            (character | world_*)              │
   │                                               ▼
   ├─► characters ◄────────── character_aliases    world_locations
   │       │                                        world_factions
   │       ├─ character_relationships               world_events
   │       ├─ character_scene_states                world_rules
   │       ├─ character_arcs                        world_artifacts
   │       └─ character_evidence_events             world_threads
   │                                                world_timeline_entries
   ├─► scenes ── script_blocks (scene_heading = location string)
   │
   └─► character_bibles (versioned snapshot)
```

Two writer surfaces (manual character creation, script-detected location strings) currently do NOT reach the World Hub or Bible. Two importer surfaces (candidates, evidence) reach them but bypass the manual side.

---

## 2. Source-of-Truth Audit (per table)

For each table: purpose · linkage · create · update · evidence · UI reads · UI writes · convergence · duplication risk · missing links · RLS · tests.


| #   | Table                                                              | Purpose                                             | Owner link                      | Create path                                                                                | Update path                                              | Evidence path                                                                | Read UI                                                | Write UI              | Manual+Imported converge?                                                                | Duplicate risk                                                                                                             | Missing links                                                     | RLS                | Tests            |
| --- | ------------------------------------------------------------------ | --------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------ | --------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------ | ---------------- |
| 1   | `projects`                                                         | Project root                                        | `user_id`                       | Projects new                                                                               | Project edit                                             | —                                                                            | Everywhere                                             | Projects              | n/a                                                                                      | —                                                                                                                          | `default_universe_id` optional                                    | owner+members      | route matrix     |
| 2   | `characters`                                                       | Canonical cast                                      | `project_id`                    | Manual (`characters.functions`), Import promotion (`promoteApprovedCharactersForDocument`) | Builder, cleanup, quarantine                             | via `character_evidence_events` + `import_evidence`→candidate→`promoted_ref` | Cast, Builder, Editor chips, Truth Engine              | Builder, Inbox        | **Both write here, but Bible only reads promoted subset**                                | name collisions (relies on `identityEngine`)                                                                               | no direct FK to `story_universes`; no scene-location FK           | project-member RLS | identity tests   |
| 3   | `character_relationships`                                          | Cast graph                                          | `project_id` + 2 character_ids  | Builder, imports (none)                                                                    | Builder                                                  | none                                                                         | Cast, Bible                                            | Builder               | manual only                                                                              | orphan on delete                                                                                                           | not exposed in World Hub                                          | member RLS         | —                |
| 4   | `character_scene_states`                                           | Per-scene beat state                                | scene_id + character_id         | Editor beat panel, arc adapter                                                             | same                                                     | none                                                                         | ArcSidebar, Truth Engine                               | ArcSidebar            | manual                                                                                   | none                                                                                                                       | not surfaced in World Hub                                         | member RLS         | —                |
| 5   | `scenes`                                                           | Structural scene list                               | `project_id`                    | Scenes route, script parse                                                                 | Editor, scenes route                                     | derived from script_blocks headings                                          | Editor, Storyboard, Cast usage                         | Editor, Scenes        | manual                                                                                   | none                                                                                                                       | **scene ↔ world_locations** unlinked                              | member RLS         | —                |
| 6   | `script_blocks`                                                    | Editor text (incl. SCENE HEADING → location string) | `scene_id`                      | Editor autosave                                                                            | Editor                                                   | none                                                                         | Editor                                                 | Editor                | manual                                                                                   | duplicate heading strings                                                                                                  | no location entity extraction                                     | member RLS         | screenplay tests |
| 7   | `story_universes`                                                  | World workspace                                     | `project_id` (+ owner)          | `ensureDefaultUniverse`                                                                    | universe funcs                                           | none                                                                         | World Hub, Importation, Character Bible                | Importation, ensure   | n/a                                                                                      | multiple universes possible; only "default" used                                                                           | project has no FK back                                            | member RLS         | universe unit    |
| 8   | `source_documents`                                                 | Uploaded corpus                                     | universe+project                | Importation upload                                                                         | Importation                                              | is evidence root                                                             | Importation, World Hub sources tab                     | Importation           | n/a                                                                                      | duplicate uploads                                                                                                          | not visible on characters/scenes                                  | member RLS         | —                |
| 9   | `source_segments`                                                  | Parsed segments                                     | document_id                     | ingestion                                                                                  | ingestion                                                | contains excerpts                                                            | Segment renderer, Importation                          | ingestion             | n/a                                                                                      | none                                                                                                                       | —                                                                 | member RLS         | —                |
| 10  | `import_candidates`                                                | Extraction proposals (character/world)              | universe+project(+document+run) | extractor                                                                                  | inbox accept/reject/merge (`accept_character_candidate`) | via `import_evidence`                                                        | Character Inbox, Importation                           | Inbox, world importer | promoted → `characters` / `world_*` via `promoted_ref`                                   | **candidate accepted → no manual character reuse for existing manual by name unless normalized name match already in RPC** | world candidates flow to `world_*` inconsistently                 | member RLS         | promotion.test   |
| 11  | `import_evidence`                                                  | Excerpt + confidence                                | candidate_id → segment_id       | extractor                                                                                  | —                                                        | itself                                                                       | Bible peek, Importation                                | —                     | evidence keyed to candidate not character; **manual characters have zero evidence rows** | —                                                                                                                          | no direct `character_id` FK; join only via candidate.promoted_ref | member RLS         | —                |
| 12  | Identity resolution (`import_identity_decisions` + `promoted_ref`) | Which candidate = which character                   | candidate+decision              | inbox merge                                                                                | inbox                                                    | via decision row                                                             | Inbox                                                  | Inbox                 | partial                                                                                  | **no reverse index from `characters` → decisions**                                                                         | manual characters never surface here                              | member RLS         | identity test    |
| 13  | `character_bibles`                                                 | Versioned snapshot                                  | universe+project                | `generateCharacterBible`                                                                   | regenerate                                               | reads `import_evidence`                                                      | Character Bible page, World Hub bible tab, Pitch (Pro) | Bible page            | **NO — only promoted candidates**                                                        | version churn on regenerate                                                                                                | manual characters missing                                         | member RLS         | —                |
| 14  | `world_locations`                                                  | Canon locations                                     | `universe_id`                   | manual (none exposed) + import promotion                                                   | none exposed                                             | via candidate                                                                | World Hub locations tab (read-only)                    | **no writer UI**      | manual side missing                                                                      | duplicates on re-import                                                                                                    | **not linked to `scenes` or script heading strings**              | member RLS         | —                |
| 15  | `world_factions`                                                   | Groups                                              | universe_id                     | import promotion                                                                           | none exposed                                             | via candidate                                                                | World Hub tab                                          | none                  | manual missing                                                                           | —                                                                                                                          | not linked to characters                                          | member RLS         | —                |
| 16  | `world_events`                                                     | Story-world events                                  | universe_id                     | import promotion                                                                           | none                                                     | via candidate                                                                | Hub tab                                                | none                  | manual missing                                                                           | —                                                                                                                          | not linked to scenes/timeline_entries                             | member RLS         | —                |
| 17  | `world_rules`                                                      | Physics/magic/law                                   | universe_id                     | import promotion                                                                           | none                                                     | via candidate                                                                | Hub tab                                                | none                  | manual missing                                                                           | —                                                                                                                          | no consumer surface                                               | member RLS         | —                |
| 18  | `world_artifacts`                                                  | Objects                                             | universe_id                     | import promotion                                                                           | none                                                     | via candidate                                                                | Hub tab                                                | none                  | manual missing                                                                           | —                                                                                                                          | not linked                                                        | member RLS         | —                |
| 19  | `world_threads`                                                    | Plot threads                                        | universe_id                     | import promotion                                                                           | none                                                     | via candidate                                                                | Hub tab                                                | none                  | manual missing                                                                           | —                                                                                                                          | not linked to scenes/arcs                                         | member RLS         | —                |
| 20  | `world_timeline_entries`                                           | Ordered events                                      | universe_id                     | import promotion                                                                           | none                                                     | via candidate                                                                | Hub tab                                                | none                  | manual missing                                                                           | —                                                                                                                          | not linked to `world_events` explicitly                           | member RLS         | —                |


---

## 3. Confirmed Defects (files + functions)

1. **Bible excludes manual characters.**
  `src/lib/importation/character-bible.functions.ts` (lines ~70–110): reads `import_candidates` where `status in (accepted, approved)`, then loads only those `characters.id`. Manually created cast rows never enter a version.
2. **World Hub misuses `character_bibles.count` as cast size.**
  `src/routes/_authenticated/world.$projectId.tsx` uses the "Character bibles" count where the human would read "Characters". `src/lib/importation/world-hub.functions.ts` never selects from `characters`.
3. **Script-detected locations invisible.**
  No pipeline reads `script_blocks` `scene_heading` INT/EXT strings into `world_locations` (not even as candidates). Scenes and world are disjoint.
4. **World Hub is read-only.** No create/update/merge/defer UIs for `world_*`. `world-hub.functions.ts` returns counts + 25 sample rows; nothing writes.
5. **No reverse index** from `characters` → the identity decision / promoting candidate. Bible cannot reconstruct provenance for a manual character (there is none) and cannot show "writer-created" tag.
6. `**import_evidence` has no `character_id` FK.** Evidence follows candidates only; once a candidate is merged into an existing manual character, evidence is reachable only through the historical candidate row.
7. **World entities lack backlinks** to `scenes`, `characters`, `character_arcs`, `world_events → world_timeline_entries`.
8. **RLS is member-scoped everywhere** — correct — but no policy currently blocks a project from writing into another project's universe entities; verify universe_id ownership in write paths added in Phase 4.

---

## 4. Phase 1 — Unified Project Story Read Model (proposed contract)

New pure server function, no schema change:

`src/lib/story-intelligence/projectStoryIntelligence.functions.ts`

```ts
export type ProjectStoryIntelligence = {
  project: { id: string; title: string; owner_id: string };
  universe: { id: string | null; name: string | null; is_default: boolean };

  characters: {
    id: string; name: string; importance: string | null;
    quarantined: boolean;
    source: 'manual' | 'imported' | 'both';
    latest_bible_version: number | null; // null = missing from Bible
    evidence_count: number;              // via candidates.promoted_ref = this id
    alias_count: number;
    relationship_count: number;
    scene_state_count: number;
  }[];

  relationships: { id: string; a_id: string; b_id: string; type: string | null }[];

  scenes: {
    id: string; heading: string | null; order_index: number;
    detected_location_string: string | null;   // parsed from heading
    linked_world_location_id: string | null;   // null today; Phase 4 target
    character_ids: string[];
  }[];

  sources: {
    id: string; title: string; status: string;
    candidate_totals: { pending: number; accepted: number; rejected: number; merged: number };
  }[];

  candidates: {
    unresolved: number;
    by_kind: Record<'character' | 'location' | 'faction' | 'event' | 'rule' | 'artifact' | 'thread' | 'timeline', number>;
    duplicates_suspected: number;
  };

  world: {
    locations: { count: number; without_evidence: number; without_scene_link: number };
    factions:  { count: number; without_evidence: number };
    events:    { count: number; without_evidence: number };
    rules:     { count: number };
    artifacts: { count: number };
    threads:   { count: number };
    timeline:  { count: number };
  };

  bibles: { latest_version: number | null; versions: { version: number; created_at: string }[] };

  diagnostics: {
    manual_characters_missing_from_bible: string[];   // character ids
    imported_candidates_unresolved: string[];          // candidate ids
    scene_locations_without_world_link: string[];      // scene ids
    world_entities_without_evidence: { table: string; id: string }[];
    possible_character_duplicates: { a_id: string; b_id: string; reason: string }[];
    possible_location_duplicates: { a_id: string; b_id: string; reason: string }[];
  };
};

export const getProjectStoryIntelligence = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ projectId: z.string().uuid() }).parse)
  .handler(async ({ data, context }) => { /* pure reads, RLS-scoped */ });
```

Tests: `projectStoryIntelligence.test.ts` — fixtures with 3 manual + 2 imported characters, 1 duplicate suspicion, 1 unlinked scene location.

No table writes. No schema change in Phase 1.

---

## 5. Phase 2 — World Hub Overview Correction (bounded)

Files to change (small):

- `src/lib/importation/world-hub.functions.ts` — remove use of `character_bibles.count` as character count; add `characters` count, evidence coverage, and read-through of `getProjectStoryIntelligence.diagnostics` (or call it directly).
- `src/routes/_authenticated/world.$projectId.tsx` — Overview stat grid rewritten to the distinct concepts you listed; add "Needs Connection" card driven by diagnostics; keep existing tabs.

No new tabs. No AI. No Atlas. Read-only stays read-only in Phase 2.

Acceptance: Overview shows Project Characters, Characters w/ Evidence, Unresolved Candidates, Bible Versions, Script-Detected Locations, Approved World Locations, Unresolved World Candidates, Scenes, Sources, Continuity Questions — each derived from Phase 1 contract. Never uses bible version count as character count.

---

## 6. Phase 3 — Character Bible Unification (plan only)

Approach (implement only after approval):

1. In `character-bible.functions.ts`, replace "start from promoted candidates" with **"start from `characters` where `project_id = X AND quarantined_at IS NULL`"**.
2. For each character, attempt to attach evidence via existing `import_candidates.promoted_ref->id = character.id` join (works for imported/promoted). Manual characters get `evidence: []` and `provenance: 'writer_created'`.
3. Aliases: continue to read `character_aliases`; manual entries produce no aliases unless the writer added some.
4. Do not fabricate first-appearance. If no evidence, first_appearance = null (rendered as "Writer-created — no source appearance").
5. Version bump only if the resulting entry set differs from previous version (hash of stable JSON). Prevents churn on regenerate.
6. Preserve prior versions unchanged — reproducibility guaranteed.
7. No auto-merge, no cross-character evidence copy.
8. Add tests: (a) manual-only project produces a bible with N entries and zero evidence; (b) mixed project preserves imported evidence and adds manual entries; (c) re-running with no changes does not create a new version.

Risks: previous bibles omit manual characters — that is the current bug, not a regression. Rollback = feature flag `bible.include_manual` defaulting to true; flip false to restore old behavior.

No schema migration required. Optional (deferred) migration: add `characters.origin` enum for faster provenance queries.

---

## 7. Phase 4 — World Builder (smallest safe CRUD, plan only)

Per entity table (`world_locations`, `world_factions`, `world_events`, `world_rules`, `world_artifacts`, `world_threads`, `world_timeline_entries`):

- `list(universeId)` — already covered by Phase 1.
- `create(universeId, fields)` — manual, writes `origin='manual'`.
- `update(id, fields)` — owner/editor role only.
- `acceptCandidate(candidateId)` — promote via existing pattern, mirrors `accept_character_candidate` RPC.
- `rejectCandidate` / `deferCandidate` / `mergeIntoExisting(candidateId, targetId)`.
- `linkToScene(entityId, sceneId)` — join table `world_entity_scene_links(entity_table, entity_id, scene_id)` (single new table).
- `linkToCharacter(entityId, characterId)` where meaningful (faction, artifact).
- Edit history via `world_entity_revisions` (single generic revision table) OR reuse pattern from `character_snapshots` — decide during Phase 4 spec.

UI: replace read-only tab body with `EntityListPanel` (list · create · edit · candidate inbox side panel · evidence drawer). Loading/error/retry/empty states standardized via existing `RouteReadinessGate`/`AppShell` patterns.

Proposed schema deltas (Phase 4, not now):

- Add nullable `origin text` + `created_by uuid` + `updated_at` to each `world_*` table (idempotent migration).
- Add `world_entity_scene_links` table (entity_table, entity_id, scene_id, project_id, universe_id, note).
- Add `world_entity_revisions` table (entity_table, entity_id, before jsonb, after jsonb, author_id, created_at).
- All new tables with GRANTs to `authenticated`+`service_role`, RLS via `is_project_member(project_id)`, deny direct client writes to `entity_table` mismatched with `universe_id`.

Deferred: Atlas, maps, AI world generation, visual assets.

---

## 8. Risks & Rollback

- Phase 1 is pure additive read → zero risk; delete file to roll back.
- Phase 2 is UI/query change → revert two files.
- Phase 3 changes bible content shape; guard with `bible.include_manual` flag; previous versions immutable.
- Phase 4 adds tables → each migration standalone, additive; drop tables to roll back.

---

## 9. Acceptance Tests (must pass before Phase merges)

- Unit: `projectStoryIntelligence` returns correct counts on fixture project.
- Unit: bible generation includes manual characters and preserves imported evidence.
- Unit: no-op regenerate does not bump version.
- Integration: `world.$projectId` Overview shows Characters count = `characters` table count (never `character_bibles`).
- Integration: "Needs Connection" lists a manual character absent from latest bible and disappears after regenerate.
- RLS: cross-project user cannot read another project's `story_intelligence`.
- Regression: 946 existing tests still pass; route matrix unchanged.

---

## 10. Wireframe — Corrected World Overview

```text
┌ World Hub · <Project Title> ─────────────────────────────────┐
│ Overview | Sources | Bible | Locations | Factions | ...      │
├──────────────────────────────────────────────────────────────┤
│  Characters       12    Chars w/ Evidence     7              │
│  Unresolved Cast   3    Bible Versions        4              │
│  Script Locations  9    Approved Locations    5              │
│  Unresolved World  6    Scenes                42             │
│  Sources           3    Continuity Questions  4              │
├─ Needs Connection ───────────────────────────────────────────┤
│  • 5 project characters missing from latest Bible  [Regen]   │
│  • 3 imported candidates unresolved               [Inbox]    │
│  • 4 scene locations not linked to world_locations [Link]    │
│  • 2 world entities without evidence              [Review]   │
│  • 1 possible duplicate character (JOHN / JOHN D.) [Merge]   │
└──────────────────────────────────────────────────────────────┘
```

---

## 11. Proposed File List (audit + Phase 1 only)

- `src/lib/story-intelligence/projectStoryIntelligence.functions.ts` (new)
- `src/lib/story-intelligence/projectStoryIntelligence.test.ts` (new)
- (Phase 2) `src/lib/importation/world-hub.functions.ts` (edit)
- (Phase 2) `src/routes/_authenticated/world.$projectId.tsx` (edit — Overview + Needs Connection card only)
- (Phase 3) `src/lib/importation/character-bible.functions.ts` (edit, flagged)
- (Phase 4) new `world-entities.functions.ts` per entity, `EntityListPanel.tsx`, migrations for links + revisions + origin.

---

**Waiting for approval on Phases 1 & 2 before any code changes. Phases 3 and 4 require separate go-ahead.**

&nbsp;

This is a **good recovery plan**, and Lovable correctly found the core architectural problem rather than merely proposing prettier cards.

I would approve **Phases 1 and 2**, but not exactly as written. There are several factual inconsistencies and a few design choices that could create another layer of technical debt.

**What the plan gets right**

The central diagnosis is correct:

Manual creation, import intelligence, generated Bibles, scenes, and world entities currently converge only partially.

The proposed unified read model is the right first move because it gives SceneSmith one project-facing interpretation of its data without prematurely rewriting every table.

The sequence is also appropriate:

Understand the fragmented data

→ create one unified read model

→ correct the World Overview

→ unify Character Bible generation

→ add controlled World Builder writes

That is much safer than immediately building Atlas, maps, or more isolated panels.

**Corrections Lovable should make before implementation**

**1. The audit contradicts the current universe model**

The table says:

story_universes → project_id (+ owner)

But the implementation we inspected links the project through:

projects.default_universe_id

and ensureDefaultUniverse() creates the universe with:

{

  owner_id: userId,

  name: universeName

}

It does not insert a project_id into story_universes.

The audit also says:

project has no FK back

but the recent migration explicitly added:

projects.default_universe_id → story_[universes.id](http://universes.id)

Those statements cannot both be true.

Lovable must verify the live schema before writing the unified model. Otherwise, the new function could be built on an imagined relationship.

**2.**

**projects.owner_id**

**is likely incorrect**

The proposed contract says:

project: {

  id: string;

  title: string;

  owner_id: string;

}

The existing code consistently refers to:

projects.user_id

The unified contract should either use the real column name:

user_id

or normalize it deliberately:

ownerId

It should not invent owner_id unless that column actually exists.

**3. The timeline audit appears inaccurate**

The plan says:

world timeline entries are not linked to world events explicitly

But the world schema previously showed:

world_timeline_entries.event_id

→ world_[events.id](http://events.id)

It is nullable, but it is an explicit relationship.

This matters because the audit must distinguish:

Relationship absent

from:

Relationship exists but is optional, underused, or not surfaced

Those require different repairs.

**4. “RLS is member-scoped everywhere” is too confident**

That statement should be changed to:

Existing RLS appears intended to be project/member scoped; each table and write path must be verified independently.

The audit itself says the universe ownership enforcement on future writes still needs verification. Therefore, it cannot simultaneously claim RLS is correct everywhere.

**Changes to the Phase 1 contract**

The contract is directionally strong, but I would revise several fields.

**Character Bible membership**

This:

latest_bible_version: number | null

inside each character record is ambiguous.

A Bible version is project-wide, not character-specific.

Use:

latest_bible: {

  version: number;

  included: boolean;

} | null;

That answers:

- Is there a current Bible?
- Is this character included in it?
- Which version was checked?

**Character provenance**

This is good:

source: "manual" | "imported" | "both";

But it must be derived from evidence, not guessed from whether evidence exists.

Suggested logic:

manual:

created through writer-facing character workflow and no promoted candidate

&nbsp;

imported:

created exclusively through approved promotion

&nbsp;

both:

existing character was later connected to one or more imported candidates

A manually created character may later gain source evidence, becoming both.

**Scene locations**

This:

detected_location_string: string | null

may be too narrow.

A scene can have:

- a stored scene_heading,
- multiple heading blocks,
- aliases,
- sublocations,
- montage locations,
- changing locations.

Use:

detectedLocations: {

  rawText: string;

  normalizedKey: string;

  sourceBlockId: string | null;

  confidence: number;

}[];

Even if v1 usually has one entry, the contract should not hard-code one location forever.

**Scene-character participation**

This:

character_ids: string[];

must define how it is calculated.

Possible sources include:

- character_scene_states,
- dialogue speaker resolution,
- manually assigned scene characters,
- imported mentions.

The model should return both the IDs and their basis:

characters: {

  characterId: string;

  basis: "scene_state" | "dialogue" | "mention" | "manual";

}[];

Otherwise, a future consumer will treat an inferred mention as equivalent to confirmed scene presence.

**Diagnostics must remain proposals**

These are useful:

possible_character_duplicates

possible_location_duplicates

But they must include:

confidence

evidence

reasonCode

and they must never trigger automatic merging.

For example:

{

  aId,

  bId,

  confidence: 0.72,

  reasonCode: "normalized_name_similarity",

  evidence: [...]

}

**Phase 2 is necessary—but still not enough for the user experience**

Phase 2 will make the page truthful. It will no longer say:

Characters: 0

when the project actually contains characters.

That is important.

But it will still be mostly read-only. After Phases 1 and 2, you will see a more intelligent dashboard, but you still will not truly be “building the world.”

Therefore, I would approve Phases 1 and 2 as a short repair pass, with Phase 3 queued immediately afterward.

The visible call-to-action should not say things like:

[Regen]

[Link]

[Merge]

unless those actions genuinely work.

During read-only Phase 2, use:

[Open Character Bible]

[Open Candidate Inbox]

[View Scenes]

[Review Evidence]

Do not create fake action buttons that lead nowhere.

**Phase 3 is strong**

The Character Bible unification proposal is one of the best parts of the plan.

Starting from:

all active project characters

instead of:

only approved imported characters

is exactly right.

Imported characters retain evidence.

Manually created characters remain valid and display:

Writer-created

No imported evidence yet

The no-op regeneration rule is also good:

Do not create another version if the stable content has not changed.

I would add two requirements:

1. The generated snapshot must record the generator/schema version.
2. The content hash should be stored with the Bible row rather than recalculated only in application memory.

That supports reproducibility and prevents accidental version churn.

The feature flag may be unnecessary unless the repository already has a reliable flag system for server behavior. A clean, tested implementation with rollback through Git is probably safer than introducing another hidden switch.

**Phase 4 needs redesign before approval**

I would **not approve Phase 4’s schema yet**.

The proposed generic join table:

world_entity_scene_links

(entity_table, entity_id, scene_id)

has a serious weakness: PostgreSQL cannot enforce a normal foreign key where entity_table dynamically determines which table entity_id belongs to.

That allows invalid combinations such as:

entity_table = "world_locations"

entity_id = an artifact UUID

The same issue affects a generic revision table.

Better options include:

**Option A — Unified world entity root**

Create:

world_entities

with a shared entity ID and type:

world_entities

- id

- universe_id

- project_id

- entity_type

- name

- canon_status

- origin

Then specialized tables extend it:

world_locations.entity_id

world_factions.entity_id

world_events.entity_id

All links can safely point to:

world_[entities.id](http://entities.id)

This is architecturally strongest for World Graph, evidence, links, Atlas, search, and revisions.

**Option B — Typed link tables**

Use:

world_location_scene_links

world_event_scene_links

world_artifact_character_links

faction_character_memberships

This is more verbose but gives proper foreign keys and domain meaning.

I would lean toward a **shared world_entities root**, because your long-term doctrine already requires a real World Graph across many entity types.

Do not let Lovable implement entity_table + entity_id merely because it is faster.

**One missing concept: one project, one default universe, but possibly many projects per universe**

The current model appears to make a project point to a default universe.

That works for one story.

But your epic-fantasy/shared-universe doctrine requires:

One universe

→ multiple books

→ multiple screenplays

→ multiple seasons

→ adaptations

A single projects.default_universe_id supports many projects pointing to one universe, which is good.

However, all new queries must avoid assuming:

universe belongs exclusively to this one project

World entities may belong to the universe and be referenced by several projects.

The unified read model should distinguish:

Universe-wide world data

Project-specific story data

Project-specific evidence and appearances

For example:

world.locations[]

may be universe-wide, while:

projectLocationUsage[]

describes which locations this project actually uses.

That distinction becomes essential for franchises.

**Recommended approval message**

Send Lovable this:

Approved for Phases 1 and 2 only, subject to the following corrections:

1. Verify the actual live schema before coding. The audit currently contradicts the repository regarding story_universes.project_id, projects.default_universe_id, and the project owner column.
2. Correct the timeline audit: verify whether world_timeline_entries.event_id already links to world_events.
3. Do not state that RLS is correct everywhere until each relevant table and write path has been tested.
4. Normalize project ownership in the TypeScript contract using the actual schema column or a deliberate camelCase field.
5. Replace per-character latest_bible_version with an explicit latest-Bible membership structure.
6. Model scene locations as an array of detected references with raw text, normalized key, evidence/source block, and confidence.
7. Model scene-character participation with its basis: scene state, dialogue, mention, or manual assignment.
8. Duplicate diagnostics must contain confidence, reason codes, and evidence, and must remain review-only proposals.
9. Phase 2 must not display buttons for operations that are not yet implemented. Link only to working surfaces.
10. Keep universe-wide World data distinct from project-specific appearances and usage so multiple projects can share a universe safely.

Implement Phase 1 and Phase 2, run the full test suite, and stop with:

- the verified system-of-record diagram,
- actual schema findings,
- changed files,
- test results,
- a screenshot of the corrected World Overview,
- sample output from getProjectStoryIntelligence,
- and remaining known disconnections.

Do not implement Phase 3 or Phase 4 until separately approved.

For Phase 4 planning, do not use an unconstrained polymorphic entity_table + entity_id join. Evaluate a canonical world_entities root table or typed relationship tables with enforceable foreign keys.

**Verdict**

**Approve Phases 1 and 2 after those corrections.**

The plan now addresses the real problem:

Not “make the World Hub prettier”

but

“make SceneSmith understand that all of these records belong to one story system.”

Phase 3 should follow immediately because that is what will finally make your existing Character list and Character Bible behave like one connected product.

Phase 4 should be redesigned around a proper World Graph entity root before any CRUD tables are added.