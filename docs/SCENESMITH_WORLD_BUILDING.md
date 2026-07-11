# SceneSmith World Building

## Status

Canonical long-term product doctrine and implementation compass.

This document defines how SceneSmith Studio must help creators discover, import, organize, visualize, expand, and protect the worlds in which their stories take place.

It exists to prevent worldbuilding from drifting into:

- a disconnected lore wiki
- a collection of empty database forms
- a screenplay-only location list
- an AI image gallery with no story meaning
- a map tool detached from characters and events
- an automatic canon generator
- a provider-specific image or video feature
- an import process that treats uncertain extraction as truth
- a production asset system that loses connection to the source story

This is not a request to implement the entire World Building platform in one pass.

Use it to guide product architecture, UX, import behavior, canon governance, continuity, visual generation, series support, pricing, and implementation sequence.

---

## Read first

Before implementing World Building work, read:

1. `AGENTS.md`
2. `docs/SCENESMITH_INTELLIGENCE_PLATFORM_VISION.md`
3. `docs/SCENESMITH_STORY_PRODUCTION_PLATFORM.md`
4. `docs/SCENESMITH_ACADEMY.md`
5. `docs/CHARACTER_TRUTH_ENGINE.md`
6. `docs/CHARACTER_TRUTH_ENGINE_SOURCE_SYSTEMS.md`
7. `docs/ITS_PfHU_Importation.md` when importing prior works, building continuation packages, populating Character/World candidates, adapting series onboarding, or reviewing a new draft against imported canon
8. `docs/SCENESMITH_VOICE_STUDIO.md` when spoken worldbuilding or voice import is involved
9. the relevant import, editor, collaboration, privacy, database, assets, i18n, and project-type documents

The Writer's Desk remains the center of gravity.

World Building must help the creator see and understand the world while writing. It must not force the creator to complete an encyclopedia before returning to the story.

---

# 1. Executive thesis

SceneSmith World Building is not merely a place to store lore.

It is a story-aware world intelligence system that helps a creator move from:

```text
source material or imagination
→ detected world elements
→ evidence-backed proposals
→ reviewed canon
→ connected World Graph
→ contextual writing support
→ continuity protection
→ visual and production-ready world assets
```

The central product promise is:

> As you write or import a story, SceneSmith helps you see the world taking shape, understand how its parts connect, and protect its continuity without taking authorship away from you.

World Building must support:

- feature screenplays
- television episodes, seasons, and long-running series
- novels, novellas, and short stories
- book series and shared universes
- audiobooks and audio dramas
- skits and short films
- YouTube channels and recurring creator formats
- podcasts
- stage plays
- animation
- interactive fiction and games
- educational and documentary storytelling
- AI-native and hybrid production

The full platform must scale from:

```text
one room, three characters, and a single scene
```

to:

```text
a multi-era, multi-location, multi-series universe managed by many writers
```

---

# 2. Product identity

World Building is a cross-cutting platform capability.

It is not one giant menu destination containing every possible field.

It should appear contextually through:

- Writer's Desk
- Story Spine
- Scene Board
- Scene Vault
- Characters / Character Bible
- Academy guided paths
- Writers' Room
- Editorial Review
- Pitch Deck
- Shot Wall and future cinematography tools
- Location intelligence
- Voice Studio
- production planning
- generator export workflows

A dedicated **World** workspace may provide the complete overview, but writers should encounter the world in small, relevant ways while creating.

Examples:

- writing a new scene heading proposes a new location
- mentioning an institution proposes a faction or organization
- introducing a historical event proposes a timeline entry
- contradicting an established rule produces an evidence-backed warning
- changing a city's government creates a time-bound world-state proposal
- importing a prior season proposes existing characters, locations, relationships, rules, and unresolved threads

World Building should feel like a living story atlas and series bible, not a content-management system.

---

# 3. Prime directives

## 3.1 Canon is explicit

SceneSmith must distinguish:

```text
raw source statement
extracted candidate
inferred relationship
proposed world fact
approved canon
superseded canon
character belief or rumor
historical uncertainty
alternate continuity
production interpretation
```

No imported, inferred, or generated world fact becomes canon automatically.

The creator or authorized editorial role must approve promotion to canon.

## 3.2 Evidence must remain attached

Every extracted or inferred world proposal should answer:

```text
Where did this come from?
Which source, draft, episode, chapter, scene, or transcript supports it?
What exact passage or timestamp supports it?
How confident is the extraction?
Was it stated directly, implied, or inferred?
Who approved it?
What later superseded it?
```

A world fact without provenance cannot support professional continuity.

## 3.3 Imports create candidates, not truth

Uploading a screenplay, teleplay, book, manuscript, audiobook transcript, production bible, or prior episode must create reviewable candidates.

The import pipeline must not silently:

- create canonical characters
- merge similarly named people
- establish a definitive timeline
- decide that a rumor is factual
- convert dialogue into objective world truth
- treat one character's belief as universal canon
- erase contradictory source material
- overwrite the current project's approved world

For corpus ingestion, source authority, adaptive series onboarding, writer knowledge mapping, Character/World population proposals, and imported-canon editorial review, `docs/ITS_PfHU_Importation.md` is authoritative.

## 3.4 The story remains primary

A writer must be able to write before the World Bible is complete.

World Building should answer the next relevant question, not demand exhaustive completion.

Correct:

```text
writer creates a scene
→ SceneSmith notices a new location or rule
→ quiet proposal appears
→ writer continues writing
→ proposal can be reviewed later
```

Never:

```text
writer creates a scene
→ blocking modal demands 40 location fields
→ writing stops
```

## 3.5 Provider neutrality is mandatory

The canonical world model must not be designed around one map, image, video, language, or generation provider.

SceneSmith may use adapters for:

- document extraction
- OCR where necessary
- speech transcription
- entity recognition
- semantic linking
- maps and geocoding
- image generation
- video generation
- 3D or spatial generation
- translation
- pronunciation
- external production and location databases

Providers will change.

The World Graph, canon, provenance, approvals, and asset lineage must survive them.

## 3.6 Human rights and source rights matter

SceneSmith should support importing material the user owns, created, licensed, or is otherwise authorized to use.

The product must not encourage unauthorized scraping, piracy, or circumvention of access controls.

---

# 4. Operating modes

World Building should support six modes.

```text
IMPORT    Understand existing authorized works.
DISCOVER  Notice the world emerging from current writing.
BUILD     Guide the creator through meaningful world decisions.
EXPLORE   See locations, history, factions, rules, and relationships.
PROTECT   Detect canon, chronology, and continuity conflicts.
PRODUCE   Translate approved world canon into visual and production assets.
```

These modes share one evidence and canon model.

They must not become six disconnected tools.

---

# 5. Import and corpus workflow

World Building must eventually support authorized source corpora containing:

- screenplays and teleplays
- episode and season scripts
- novels and manuscripts
- series bibles
- lore documents
- transcripts
- audiobook and audio-drama transcripts
- production notes
- approved editorial decisions

The full corpus pipeline is defined by `docs/ITS_PfHU_Importation.md`.

At the world level, importation may propose:

- locations
- regions
- factions
- institutions
- cultures
- languages
- technologies
- magic systems
- species
- artifacts
- historical events
- laws
- political control
- travel constraints
- unresolved lore

No proposal becomes canon before review.

---

# 6. World Graph

The World Graph represents structured, time-aware world knowledge.

Possible entity types include:

- universe
- world
- region
- territory
- location
- building
- room
- route
- faction
- institution
- culture
- language
- religion or belief system
- species
- technology
- magic system
- law
- social rule
- artifact
- object
- resource
- event
- era
- myth
- secret

Possible relationship types include:

- contains
- borders
- controls
- occupies
- founded
- destroyed
- rebuilt
- allied with
- at war with
- trades with
- worships
- speaks
- prohibits
- requires
- created
- owns
- hides
- knows
- believes
- travels through
- changed by

Every relationship may be time-bound and evidence-backed.

---

# 7. Conceptual data model

The exact schema may evolve, but these conceptual separations are mandatory.

## 7.1 Universes

```text
story_universes
- id
- owner_id
- title
- summary
- canon policy
- current era
- project links
```

## 7.2 World entities

```text
world_entities
- id
- universe_id
- entity_type
- canonical_name
- display_name
- aliases
- summary
- status
- created_by
- approved_by
- supersedes_id
```

## 7.3 World facts

```text
world_facts
- id
- entity_id
- fact_type
- value
- valid_from
- valid_to
- certainty
- status
- source authority
- approved_by
- supersedes_id
```

## 7.4 World relationships

```text
world_relationships
- id
- from_entity_id
- to_entity_id
- relationship_type
- direction
- valid_from
- valid_to
- status
- evidence ids
```

## 7.5 World events

```text
world_events
- id
- universe_id
- title
- description
- event_type
- start time
- end time
- certainty
- chronology position
- affected entities
- status
```

## 7.6 World proposals

```text
world_proposals
- id
- project_id
- universe_id
- proposal_type
- target_entity_id
- proposed payload
- source evidence ids
- confidence
- status
- resolved_by
- resolved_at
- supersedes_id
```

## 7.7 World evidence

```text
world_evidence
- id
- source_id
- segment_id
- excerpt
- timestamp range
- evidence_type
- extraction_run_id
- confidence
```

## 7.8 Continuity findings

```text
world_continuity_findings
- id
- universe_id
- project_id
- finding_type
- severity
- entity_ids
- scene / chapter / source references
- evidence_ids
- explanation
- status
- resolved_by
- resolution
```

## 7.9 World assets

```text
world_assets
- id
- entity_id
- asset_type
- storage_path
- provider
- model
- prompt package version
- source canon snapshot
- generation settings
- cost metadata
- status
- approved_by
- supersedes_id
```

Do not store temporary signed URLs as canonical asset identity.

---

# 8. The World Building user experience

## 8.1 First principle: help the writer see the world

The first useful experience should not be a blank encyclopedia.

It should reveal what already exists in the story.

For an imported or active project, the World Overview may show:

```text
12 locations
4 factions
2 historical events
3 world rules
7 unresolved questions
5 items awaiting review
```

The page should feel like a living atlas and story bible.

## 8.2 World Overview

The overview should answer:

- What kind of world is this?
- Where does the story spend its time?
- Which powers shape events?
- What rules matter most?
- What changed before the story began?
- What is changing now?
- Where are the contradictions or gaps?
- Which world elements are underdeveloped?

Recommended visual hierarchy:

- world identity and visual tone
- current project/era context
- key locations
- factions and power relationships
- timeline highlights
- rules and systems
- unresolved questions
- recent discoveries
- continuity alerts

## 8.3 Contextual writer support

Inside the Writer's Desk, World Building should appear as optional contextual support.

Examples:

- autocomplete established location names
- show a compact location card for the active scene
- show current era and political control
- warn when travel time is impossible
- show which characters know a secret world fact
- propose a new location when an unknown place is typed
- show established spelling and pronunciation

It must not steal focus or block typing.

## 8.4 Guided World Builder

The guide should adapt to project scope.

A short skit may need:

- setting
- social rule
- visual distinction

A feature screenplay may need:

- major locations
- institutions
- story-relevant history
- practical production implications

A fantasy series may need:

- regions
- cultures
- languages
- political history
- magic rules
- technology
- religion
- species
- chronology

The creator should choose depth or allow ITS/PfHU to recommend it.

## 8.5 Entity pages

A world entity page should default to **Read**, not Edit.

Recommended modes:

```text
READ      Understand the entity.
EDIT      Change approved canon.
ANALYZE   Review evidence, continuity, and story use.
VISUALIZE Generate or manage visual references.
```

## 8.6 Candidate and review inbox

Imported and detected items should enter one World Review Inbox.

Categories may include:

- new locations
- new factions
- possible duplicates
- spelling variants
- timeline proposals
- world-rule proposals
- contradictory facts
- mentioned-only entities
- visual discoveries
- ignored items

Every item should explain why it appeared and what approval will do.

## 8.7 Maps

Maps may be:

- geographic
- political
- transit/network
- relationship-based
- conceptual
- floorplan or local
- fictional
- real-world reference

SceneSmith must not require a geographic map when a network or relationship view is more useful.

Generated maps are visual interpretations unless approved as canon.

## 8.8 Timeline

The timeline must support:

- absolute dates
- relative dates
- episode/chapter order
- story time versus release order
- uncertain dates
- simultaneous events
- alternate timelines
- eras
- flashbacks and flashforwards

Timeline conflicts must link to source evidence.

---

# 9. World and Character integration

Characters do not exist separately from their world.

The World Graph and Character Bible should share structured links for:

- birthplace
- residence
- nationality or cultural membership
- language
- faction allegiance
- rank and title
- legal status
- religion or belief
- social class
- education
- access to technology or magic
- known locations
- owned objects
- historical participation
- knowledge of secrets
- prejudice, loyalty, and worldview

Character identity resolution and world entity resolution must coordinate.

Example:

```text
THE MAJOR
MAJOR FRIEDRICH
FRIEDRICH VON KLINKER
```

may be one character.

```text
THE CAPITAL
OLD CAPITAL
NEW KLINKER CITY
```

may be one place across eras or three distinct entities.

The system must propose and explain, not decide destructively.

---

# 10. Series continuation and professional continuity

World Building should make SceneSmith valuable for senior writers, showrunners, authors, and franchise teams.

## 10.1 Continuation workspace

After importing prior works, the system should produce a reviewable continuation package:

- established characters and aliases
- active relationships
- known locations
- factions and control
- chronology
- unresolved promises
- open mysteries
- completed and incomplete arcs
- world rules
- known exceptions
- object and artifact status
- character knowledge states
- visual canon references
- continuity risks for the new work

The detailed ingestion, knowledge-map, adaptive-onboarding, and review behavior is defined by `docs/ITS_PfHU_Importation.md`.

## 10.2 New-writer onboarding

A writer joining an existing series should be able to ask:

- What must I know before writing this character?
- What places can this character plausibly access?
- What does the public believe versus what is secretly true?
- What rules cannot be broken?
- What events shaped the current political situation?
- Which continuity issues remain unresolved?
- What should not be repeated from prior episodes?

Answers must cite source evidence.

## 10.3 Canon priority

Professional teams need configurable source authority.

Examples:

```text
showrunner-approved series bible
> locked production script
> released episode
> approved screenplay draft
> writers' room decision
> early draft
> brainstorm note
```

Authority must not be inferred merely from upload order.

## 10.4 Retcons and alternate continuity

Continuity conflicts may be classified as:

- error
- retcon
- unreliable narration
- character lie
- dream or hallucination
- alternate timeline
- adaptation difference
- production change

The system should preserve history and explanation.

---

# 11. Visual World Building

World Building should help creators see the world without turning it into an image gallery.

Possible visual assets:

- location portraits
- interiors and exteriors
- maps
- floorplans
- political diagrams
- faction symbols
- architecture references
- artifacts and props
- creatures
- technology concepts
- wardrobe and cultural references
- moodboards
- color palettes

Workflow:

```text
approved World Graph
→ editable visual brief
→ provider adapter
→ generated candidates
→ human approval
→ visual canon or alternate interpretation
```

Generated visuals do not redefine canon automatically.

---

# 12. YouTube, creator, and AI-native production outputs

Future creator workflows may produce:

- downloadable script visual aids
- location cards
- maps and diagrams
- timeline graphics
- character/world reference sheets
- thumbnail concepts
- B-roll prompts
- establishing images
- 5–10 second establishing clips
- atmospheric transitions
- map flyovers
- generator-ready prompt packages

The same system should scale from low-budget creator output to studio production planning.

Production profiles may include:

```text
YouTube / Creator
Indie
Studio
Animation
AI-native
Hybrid
```

The World Graph remains authoritative across profiles.

---

# 13. Location intelligence

World Building should distinguish fictional-world design from real-world production location search.

A fictional location may have:

- canonical geography
- story function
- visual identity
- history
- political control
- access rules
- weather
- temporal states

A production-location package may include:

- real-world candidates
- budget tier
- travel
- permits
- weather
- accessibility
- visual match
- production constraints

Do not let real-world production assumptions overwrite fictional canon.

---

# 14. Integration with SceneSmith intelligence

## 14.1 Academy

Academy guides the next meaningful world decision and returns the creator to writing.

## 14.2 ITS

ITS may determine which world concept must be understood next and which misconception needs repair.

## 14.3 PfHU

PfHU may adapt explanation depth, order, format, and interruption frequency.

## 14.4 TMH and Character Truth

World systems create moral and relational pressure.

SceneSmith may analyze how institutions, scarcity, law, culture, and power affect character behavior.

It must not morally grade cultures or creators.

## 14.5 ITS/PfHU Importation

`docs/ITS_PfHU_Importation.md` governs how imported corpora become evidence-backed knowledge maps, adaptive role-based briefings, Character/World proposals, continuation packages, and editorial-review inputs.

## 14.6 Story Graph

The Story Graph represents dramatic movement.

The World Graph represents the environment, systems, history, and state in which that movement occurs.

## 14.7 Production Graph

Approved world entities and states may compile into production requirements and generator instructions.

---

# 15. Permissions, collaboration, and governance

Roles should control:

- who may import sources
- who may review candidates
- who may edit canon
- who may approve facts
- who may resolve contradictions
- who may generate visual assets
- who may approve visual canon
- who may configure source authority
- who may export the World Bible

Professional teams should retain decision and authorship history.

---

# 16. Rights, privacy, and safety

World and source materials may contain valuable unreleased intellectual property.

Required controls:

- project isolation
- private storage
- durable asset identity
- RLS
- signed access
- audit history
- deletion and export
- provider disclosure
- rights metadata
- no training assumption without explicit policy
- participant consent for recorded sources

---

# 17. Cost and monetization

Track:

- pages and words imported
- audio minutes transcribed
- extraction cost
- embeddings
- storage
- continuity-analysis cost
- map, image, and video generation
- user credits
- margin

Possible tiers:

## Creator

- guided world setup
- basic locations and rules
- limited visual concepts

## Pro

- deeper World Graph
- timelines and factions
- continuity analysis
- multi-document import
- downloadable visual aids

## Studio

- series corpus
- source authority
- team governance
- franchise continuity
- advanced visual and production packages

---

# 18. Implementation sequence

## Phase 0 — Audit and contracts

- current schema and import audit
- entity registry
- canon lifecycle
- evidence contract
- source-rights model
- provider-neutral interfaces
- UX wireframes

## Phase 1 — Discovery foundation

- detect locations and world elements from current writing
- create candidates
- attach evidence
- review inbox

## Phase 2 — Guided World Builder

- project-scope-aware prompts
- ITS/PfHU adaptation
- basic World Overview

## Phase 3 — Single-source import

- authorized source upload
- segmentation
- character/world candidates
- evidence review

Detailed corpus behavior follows `docs/ITS_PfHU_Importation.md`.

## Phase 4 — Multi-source series corpus

- authority rules
- contradictions
- retcons
- chronology
- continuation package

## Phase 5 — Atlas, timeline, and continuity

- entity pages
- maps and network views
- timeline
- contextual Writer's Desk support

## Phase 6 — Visual World Building

- visual briefs
- image candidates
- approval and lineage
- location packs

## Phase 7 — Cross-format and Voice Studio integration

- novels
- skits
- YouTube
- audio
- spoken worldbuilding

## Phase 8 — Production and generator integration

- location intelligence
- production packages
- visual aids
- short clips
- Scene Compiler and provider adapters

---

# 19. Acceptance tests

## 19.1 Current-writing discovery

Write a new scene in an unknown location.

Expected:

- quiet location candidate
- evidence points to the scene heading
- writing remains uninterrupted
- no automatic canon

## 19.2 Source import

Import an authorized prior screenplay.

Expected:

- original retained
- locations, factions, events, and rules proposed
- no direct canonical inserts
- source evidence visible

## 19.3 Character belief versus objective fact

A character states a false rumor.

Expected:

- character-belief proposal
- no objective world-fact promotion

## 19.4 Timeline conflict

Two sources give different dates.

Expected:

- authority-aware contradiction
- evidence from both sources
- no silent winner

## 19.5 Series continuation

Import a season or book series.

Expected:

- reviewable continuation package
- current world state
- unresolved threads
- required writer knowledge
- source citations

## 19.6 Visual generation

Generate a location concept.

Expected:

- editable brief
- provider/model lineage
- cost
- proposed asset
- no automatic visual canon

## 19.7 Permissions

Test owner, editor, co-writer, commenter, viewer, and non-member.

Expected:

- role-appropriate source, canon, proposal, and asset access

---

# 20. Do not build

Do not build:

- a blank lore wiki
- automatic canon from imports
- one giant JSON world blob
- a map with no evidence or story meaning
- visual generation before identity and canon foundations
- a screenplay-only world schema
- provider-specific canonical fields
- uncited continuity answers
- blocking world questionnaires
- unauthorized source acquisition
- a production-location database that overwrites fictional-world truth

---

# 21. Canonical terminology

Use:

- **World Building** — complete platform capability
- **World Bible** — human-readable approved world reference
- **World Graph** — structured, temporal, evidence-backed world model
- **World Entity** — location, faction, culture, rule, artifact, event, or other world object
- **World Proposal** — detected or generated item awaiting review
- **World Fact** — time-bound claim about an entity
- **World State** — collection of facts valid at a particular story time
- **World Review Inbox** — candidate and contradiction review
- **Visual Canon** — human-approved visual reference
- **Continuation Package** — evidence-backed state of the world for the next work

---

# 22. Final doctrine

SceneSmith World Building exists to help creators discover, understand, continue, protect, and eventually produce the worlds their stories require.

Its enduring principles are:

```text
Let the story create the need for worldbuilding.
Extract candidates, not automatic truth.
Keep canon explicit and evidence-backed.
Model the world across time.
Connect world, character, and story.
Use ITS/PfHU to guide rather than overwhelm.
Use ITS/PfHU Importation to teach the system and the writer from authorized prior works.
Help the writer see the world while writing.
Keep providers replaceable.
Keep generated assets traceable and human-approved.
```

World Building succeeds when a creator can import or write a story, see the living world emerge, understand how its parts connect, continue it without avoidable contradiction, and translate approved canon into useful visual and production outputs without losing authorship.