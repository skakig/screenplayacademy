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
7. `docs/SCENESMITH_VOICE_STUDIO.md` when spoken worldbuilding or voice import is involved
8. the relevant import, editor, collaboration, privacy, database, assets, i18n, and project-type documents

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

For third-party franchises or existing works, the user is responsible for lawful access and appropriate rights.

The system should preserve source metadata and permit private analysis without falsely granting commercial rights to generated continuations.

---

# 4. The World Building operating model

SceneSmith World Building has six connected operating modes.

```text
IMPORT      Understand an existing body of work.
DISCOVER    Notice the world emerging from current writing.
BUILD       Guide the creator through meaningful world decisions.
EXPLORE     Let the creator see places, people, systems, and history together.
PROTECT     Detect continuity conflicts and canon drift.
PRODUCE     Translate approved world canon into visual and production assets.
```

## 4.1 Import

Purpose: reconstruct a reviewable world model from one or more authorized source works.

Supported source types may eventually include:

- Fountain
- Final Draft
- PDF screenplay or teleplay
- plain text
- DOCX
- EPUB
- manuscript files
- subtitle or caption files
- audiobook or audio-drama transcript
- uploaded audio with transcription
- series bible
- pitch deck
- notes and production documents

Imports must preserve source identity and edition.

## 4.2 Discover

Purpose: detect world elements while the creator writes.

Examples:

- location names
- geographic relationships
- institutions
- governments
- religions
- cultures
- technologies
- magic or supernatural rules
- artifacts
- species
- historical events
- laws and customs
- currencies
- languages
- recurring visual motifs

Discovery must be quiet, reversible, and evidence-backed.

## 4.3 Build

Purpose: provide an adaptive guided worldbuilding experience.

The Academy, ITS, and PfHU layers should ask one relevant question at a time.

Examples:

- What makes this place different from everywhere else in the story?
- Who benefits from this law?
- What does this culture celebrate that outsiders misunderstand?
- What rule of magic cannot be broken without cost?
- What historical event do two groups remember differently?
- What does the protagonist believe about this world that is not entirely true?

The guide should stop when the creator has enough to return to the story.

## 4.4 Explore

Purpose: let the creator understand the world at a glance.

Possible views include:

- World Overview
- Atlas / Location Network
- Timeline
- Factions and Institutions
- Cultures and Languages
- Rules and Systems
- Objects, Technologies, and Artifacts
- Species and Creatures
- Character-to-World connections
- Unresolved Questions
- Continuity Alerts
- Visual Library

## 4.5 Protect

Purpose: preserve continuity across drafts, episodes, books, seasons, media, and writers.

Protection includes:

- timeline checks
- travel-time checks
- location-state continuity
- rule consistency
- faction allegiance changes
- cultural and language consistency
- technology availability by era
- character knowledge versus world truth
- object ownership and location
- political and institutional changes
- alternate continuity handling

Warnings must remain advisory and link to evidence.

## 4.6 Produce

Purpose: translate approved world canon into production-ready descriptions and assets.

Possible outputs include:

- location brief
- visual reference pack
- moodboard
- environment prompt package
- map brief
- prop or artifact brief
- costume-cultural reference
- shot or scene visual aids
- pitch-deck world pages
- production-design package
- generator-specific image or video instructions

Generated assets are proposals until approved.

---

# 5. Importing existing stories and series

This is a core professional use case.

A creator continuing a series should be able to import prior authorized works and ask SceneSmith to reconstruct the story world.

## 5.1 Corpus import workflow

```text
Upload sources
→ identify source type and edition
→ segment into works / episodes / chapters / scenes
→ preserve raw source
→ extract entity candidates
→ resolve identity candidates
→ build evidence links
→ identify contradictions and uncertainty
→ review proposed canon
→ approve World Graph and Character Bible entries
```

## 5.2 Corpus structure

A corpus may include:

- film 1, film 2, film 3
- season 1 episodes 1–10
- book 1–7
- screenplay plus novel adaptation
- audiobook transcript plus manuscript
- series bible plus produced episodes
- creator scripts plus published videos

The system must preserve:

- source title
- source type
- edition or draft
- release or chronology order
- canonical priority
- language
- rights/ownership metadata
- import date
- parser version

## 5.3 Extracted candidates

The import pipeline may propose:

- characters and aliases
- relationships
- locations
- factions and institutions
- events
- chronology
- world rules
- cultures
- languages
- objects and artifacts
- technologies
- species
- unresolved plot threads
- promises and payoffs
- character knowledge states
- visual motifs
- themes and values

Each candidate must include source evidence and confidence.

## 5.4 Identity resolution

Entity resolution must account for:

- spelling variants
- titles and ranks
- aliases
- translations
- transliterations
- younger/older versions
- disguises
- code names
- locations with renamed eras
- institutions that split or merge
- objects that change owners

The system may propose a merge.

It must not merge established canonical entities without human approval.

A confirmed **keep separate** decision must be remembered.

## 5.5 Conflicting sources

Series material often disagrees.

The system must support:

```text
hard canon
soft canon
adaptation canon
production canon
character belief
rumor
retcon
alternate timeline
non-canonical source
unresolved contradiction
```

Do not flatten conflict into one answer.

Show the creator the competing evidence and let authorized users determine canon priority.

## 5.6 Audio and audiovisual sources

Audiobooks, audio dramas, podcasts, and videos may require transcription before extraction.

The Voice Studio doctrine governs audio preservation, transcription, speaker attribution, and provider neutrality.

Visual or audiovisual analysis may later identify locations, costumes, props, and recurring designs, but those observations remain proposals.

---

# 6. The World Graph

The World Graph is the structured model connecting world entities to story evidence and time.

It is related to, but not identical to, the Story Graph.

```text
Story Graph
Who wants what, what happens, and what changes.

World Graph
Where and when it happens, what systems govern it, what entities exist, and how the world changes.
```

The graphs must interoperate.

## 6.1 Core world entities

### World / Universe

The top-level continuity container.

### Realm / Region / Territory

Geographic, political, dimensional, or conceptual area.

### Location

A place used, referenced, or planned in the story.

### Faction / Institution / Organization

Governments, companies, militaries, religions, schools, gangs, guilds, families, movements, and creator organizations.

### Culture / Community

Shared customs, values, symbols, language, history, and social behavior.

### Language / Dialect / Register

Spoken, written, signed, coded, or ritual communication systems.

### Rule / System

Physics, magic, technology, law, economy, religion, social structure, genre contract, or narrative-world constraint.

### Event

Historical or story-time occurrence.

### Era / Period

A bounded state of the world.

### Object / Artifact / Prop

Items with story, cultural, symbolic, or production significance.

### Technology / Capability

Available tools, infrastructure, weapons, communication, transport, medicine, or supernatural abilities.

### Species / Creature / Population

Biological, artificial, supernatural, or invented beings.

### Concept / Belief / Myth

Ideas held by groups or characters, which may or may not be objectively true.

## 6.2 Core relationships

Examples:

```text
LOCATION located_in REGION
FACTION controls LOCATION
CHARACTER belongs_to FACTION
CHARACTER believes MYTH
EVENT occurred_at LOCATION
EVENT caused EVENT
RULE applies_in ERA
TECHNOLOGY available_during ERA
OBJECT owned_by CHARACTER
CULTURE speaks LANGUAGE
FACTION opposes FACTION
LOCATION changed_after EVENT
SOURCE supports WORLD_FACT
```

Relationships may be time-bound, uncertain, disputed, or source-specific.

## 6.3 Temporal world state

World facts often change.

SceneSmith must distinguish:

- timeless canon
- valid from/to dates or story positions
- state before an event
- state after an event
- public belief
- secret truth
- character-specific knowledge
- alternate timeline state

A location is not merely one static card.

It may have:

- pre-war state
- occupation state
- destroyed state
- rebuilt state
- dream or imagined state
- production location interpretation

---

# 7. Conceptual data model

The exact schema must be designed after repository audit.

The conceptual separation is mandatory.

## 7.1 Source corpus

```text
world_sources
- id
- project_id or universe_id
- title
- source_type
- edition
- language
- chronology_order
- release_order
- canon_priority
- storage_asset_id
- rights_metadata
- import_status
- parser_version
- created_by
- created_at
```

## 7.2 Source segments

```text
world_source_segments
- id
- source_id
- segment_type
- sequence
- label
- start_offset / end_offset
- text
- timestamp range when audio/video
- checksum
```

## 7.3 World entities

```text
world_entities
- id
- universe_id
- project_id when project-scoped
- entity_type
- canonical_name
- display_name
- summary
- status
- canon_level
- valid_from
- valid_to
- created_by
- approved_by
- created_at
- updated_at
```

## 7.4 Aliases

```text
world_entity_aliases
- entity_id
- alias
- alias_type
- language
- era
- source_id
- confidence
- approved
```

## 7.5 World relationships

```text
world_relationships
- source_entity_id
- relation_type
- target_entity_id
- valid_from
- valid_to
- certainty
- source_evidence_ids
- canon_status
```

## 7.6 World facts and proposals

```text
world_fact_proposals
- id
- entity_id
- field_path or fact_type
- proposed_value
- source_type
- source_evidence_ids
- confidence
- inference_type
- status
- created_by or source_engine
- resolved_by
- resolved_at
- supersedes_id
```

## 7.7 Evidence

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

Example:

```text
Produced episode
> locked final script
> approved series bible
> writers' room decision
> draft
> brainstorm note
```

The hierarchy must be explicit and project-configurable.

## 10.4 Editorial approval

World canon changes may require:

- writer proposal
- story editor review
- senior editor approval
- showrunner approval
- producer awareness

World Building must use the same auditable governance principles as Editorial Review.

---

# 11. Visual World Building

Visual generation should help creators see the world without allowing generated imagery to redefine it silently.

## 11.1 Visual brief compiler

Approved world facts should compile into provider-neutral visual briefs for:

- locations
- regions
- interiors
- institutions
- artifacts
- vehicles
- creatures
- cultures
- architecture
- wardrobe environments
- recurring visual motifs

The user should review the brief before generation.

## 11.2 World Style Contract

A project or universe may define a visual style contract:

- medium
- era
- region
- palette
- lighting
- lens and composition tendencies
- architecture
- material language
- weather
- texture
- negative instructions

The style contract supports consistency across characters, locations, storyboards, pitch materials, and generated scenes.

It remains editable and versioned.

## 11.3 Visual asset states

Distinguish:

```text
reference inspiration
AI concept
alternate concept
approved visual canon
production interpretation
scene-specific state
generator-specific output
```

A generated image is not automatically canonical.

## 11.4 Location reference packs

A location pack may include:

- canonical exterior
- canonical interior
- day/night states
- seasonal states
- pre/post-event state
- floorplan or spatial relationships
- architecture/material notes
- color and lighting
- recurring props
- camera or production constraints
- prompt package

## 11.5 Maps and diagrams

The creator may generate or upload:

- world map
- city map
- building plan
- relationship map
- political map
- travel route
- timeline diagram
- system diagram

The system must retain scale, certainty, and canon status where relevant.

---

# 12. YouTube, creator, and short-form visual aids

World Building should serve creators who do not need a traditional film studio.

A YouTube creator may need:

- recurring set bible
- host/character continuity
- location list
- prop list
- episode visual references
- B-roll plan
- graphic explainers
- map animation brief
- thumbnail background
- downloadable visual-aid package
- short generated establishing clip

Future outputs may include short clips such as 5–10 second:

- establishing shots
- location reveals
- historical reconstructions
- map flyovers
- prop or artifact rotations
- atmospheric transitions
- world-rule explainers

These must be generated through provider adapters with:

- source world snapshot
- project style contract
- prompt package
- provider/model/version
- cost
- creator approval
- rights metadata
- downstream usage record

This is a future production phase, not an immediate World Building MVP.

---

# 13. AI film studio and generator integration

World Building becomes foundational to SceneSmith's future AI and hybrid production pipeline.

The system should compile approved world state into generator-ready packages.

```text
approved World Graph
+ approved Character Bible
+ active scene state
+ project visual style
+ production profile
→ Scene Compiler
→ provider adapter
→ image / video / audio / 3D output
```

Generator adapters must not own canon.

The World Graph must remain provider-neutral.

## 13.1 Scene-specific world state

A generated scene may require:

- location version
- date/time
- weather
- political control
- damage state
- available technology
- cultural details
- crowd composition
- props
- signage and language
- character knowledge
- continuity from previous shot

SceneSmith should compile these facts rather than asking the user to rewrite them for every provider.

## 13.2 Asset lineage

Every generated visual or clip should answer:

```text
Which world version was used?
Which location state was used?
Which character states were used?
Which source canon supported the prompt?
Which model and settings generated it?
Who approved it?
What superseded it?
```

---

# 14. Academy, ITS, PfHU, TMH, and Character Truth

## 14.1 Academy

Academy should teach worldbuilding through the current project, not detached lessons.

It should help the creator make the next meaningful decision and return to writing.

## 14.2 ITS

The tutoring system may determine:

- which world concept is currently blocking the story
- whether the creator needs an example
- whether a contradiction is intentional
- when a rule needs clarification
- when enough worldbuilding exists for the current scene

## 14.3 PfHU

The system may adapt:

- visual versus verbal representation
- depth
- pacing
- question style
- amount of structure
- tolerance for ambiguity

It must not make hidden psychological judgments.

## 14.4 TMH

TMH may help model:

- institutional moral level
- cultural incentives
- social regression under pressure
- laws and systems
- conflict between personal and collective morality
- what a society rewards or punishes

TMH must not be used to label a culture or real-world group as morally inferior.

It is an analytical framework for story behavior, consequences, and pressure.

## 14.5 Character Truth

World rules create behavioral constraints.

Character Truth may ask:

- Does this character know this fact yet?
- Would their culture permit this action?
- Does their rank grant this access?
- Does the current era support this technology?
- Is this moral choice plausible within the institution shaping them?

Warnings remain evidence-backed and advisory.

---

# 15. Voice Studio integration

Voice Studio should become one of the most natural ways to build a world.

A creator may say:

> The city used to be a mining colony, but after the flood the guild took control of the upper district. People in the lower district still use the old language at funerals.

Voice Studio may propose:

- City location entry
- Mining-colony historical era
- Flood timeline event
- Guild faction
- Upper/Lower District locations
- Old language
- funeral custom
- control relationship

The original audio and transcript remain preserved.

Every extracted world item remains a proposal until approved.

---

# 16. Collaboration, permissions, and governance

World Building must respect project and universe roles.

Permissions may distinguish:

- view world canon
- propose world facts
- edit draft facts
- approve canon
- merge entities
- resolve contradictions
- generate visual assets
- approve visual canon
- import sources
- export the World Bible
- delete sources or assets

Professional roles may include:

- writer
- worldbuilder
- story editor
- continuity editor
- senior editor
- showrunner
- producer
- production designer
- location manager
- viewer

Every approval and merge must preserve authorship and audit history.

---

# 17. Privacy, intellectual property, and rights

Imported worlds may contain unreleased scripts, manuscripts, franchise bibles, private research, and commercially sensitive intellectual property.

World Building must provide:

- project isolation
- role-based access
- secure source storage
- configurable source retention
- deletion of source files and derived data
- export
- audit history
- provider-processing disclosure
- no model-training assumption without explicit policy and consent
- rights metadata
- private-by-default corpus analysis

The user must understand:

- which source is uploaded
- which provider processes it
- whether the source leaves SceneSmith infrastructure
- which derived facts are stored
- who can access the world
- how to delete the source and derivatives

---

# 18. Multilingual worlds

World Building must support:

- source works in multiple languages
- code-switching
- transliterated names
- translated location names
- canonical original-language names
- aliases by language and era
- invented languages
- pronunciation guides
- writing systems
- dialects and registers

Rules:

- preserve original-language source evidence
- do not replace original names with translations silently
- store language-specific aliases
- make transliteration reviewable
- allow project-specific vocabulary and pronunciation memory
- distinguish translation choices from canon

All user-facing interface copy must use i18n keys.

---

# 19. Cost and monetization

World Building can support meaningful premium value.

Cost-bearing operations may include:

- long-document extraction
- corpus-scale semantic analysis
- audiobook transcription
- cross-source entity resolution
- continuity analysis
- map generation
- image generation
- video generation
- storage
- visual-reference exports

Track:

- source pages, words, or minutes
- extraction provider/model
- interpretation cost
- storage
- visual generation cost
- video generation cost
- user credits charged
- retries
- gross margin

Suggested product structure:

## Free / Trial

- small world overview
- limited entities
- basic manual world cards
- sample extraction

## Creator

- project-aware world discovery
- guided World Builder
- locations, factions, timeline, rules
- moderate import limits
- basic visual references

## Pro

- multi-source corpus import
- continuity analysis
- advanced World Graph
- visual reference packs
- series continuation tools
- multilingual canon

## Studio

- shared universe
- multi-project canon
- approvals and governance
- team roles
- showrunner and continuity workflows
- large corpus imports
- production integrations
- asset and provider lineage

Do not finalize pricing until actual provider and storage costs are measured.

---

# 20. Implementation sequence

Do not build the complete World Building platform in one pass.

## Phase 0 — Repository audit and contracts

Before code, inventory:

- existing project types
- import pipelines
- character candidates and identity resolution
- scenes and script blocks
- Story Graph or graph-like tables
- locations and scene headings
- timeline and arc data
- assets and storage
- suggestions, approvals, and provenance
- permissions and RLS helpers
- current visual generation
- current pitch/storyboard integration

Return:

- reusable systems
- missing systems
- proposed World Graph contracts
- source/canon model
- entity registry
- relationship registry
- project-type adapters
- RLS matrix
- privacy/retention proposal
- cost model
- UX wireframes
- phased plan

No implementation code in Phase 0.

## Phase 1 — World Discovery Foundation

Implement only:

- manual world entities
- location candidates from scene headings
- evidence links
- World Review Inbox
- approve / ignore / merge / keep separate
- World Overview
- no AI visual generation

Acceptance:

- writing a new location creates a candidate, not canon
- approval creates one location entity with evidence
- ignored candidate stays ignored
- duplicate names are proposed, not silently merged

## Phase 2 — Guided World Builder

Implement:

- contextual Academy prompts
- locations
- factions
- rules
- events
- unresolved questions
- role-scaled depth by project type

Acceptance:

- creator can build enough world context for a current scene without filling exhaustive forms
- every answer is saved as canon or proposal according to explicit user action

## Phase 3 — Single-source import

Implement one authorized source type end to end.

Recommended first source:

- Fountain or Final Draft screenplay already supported by the import pipeline

Add:

- source record
- segmentation
- location, character, institution, event, and rule candidates
- evidence
- review

Do not claim PDF, novel, or audiobook support until each passes its own acceptance test.

## Phase 4 — Multi-source series corpus

Implement:

- multiple works
- source priority
- identity resolution
- contradictions
- chronology
- unresolved threads
- continuation package

Acceptance:

- import two episodes or books
- preserve source boundaries
- resolve confirmed aliases
- show conflicting facts without flattening them
- generate a reviewable series continuation overview

## Phase 5 — Atlas, Timeline, and Continuity

Implement:

- location network
- timeline
- time-bound world state
- travel and rule checks
- evidence-backed continuity findings

## Phase 6 — Visual World Building

Implement:

- visual brief compiler
- style contract
- location concept generation
- candidate comparison
- canonical approval
- alternates
- permanent storage paths
- provider/model/cost lineage

## Phase 7 — Cross-format and Voice integration

Implement:

- novel/manuscript adapter
- audiobook transcript adapter
- skit and YouTube adapter
- Voice Studio world sessions
- multilingual source support

## Phase 8 — Production and generator integration

Implement:

- location packs
- production-design packs
- map and visual-aid exports
- short establishing-clip packages
- generator adapters
- Production Graph proposals

Each phase must pass behavioral acceptance tests before the next begins.

---

# 21. Required acceptance tests

## 21.1 Discovery while writing

1. Create a new scene heading with an unknown location.
2. Continue writing without interruption.
3. Confirm a location candidate appears later.
4. Confirm no canonical location was created automatically.
5. Approve the candidate.
6. Confirm the location links back to the source scene.

## 21.2 Series import

Import two authorized episodes containing:

- one character with title/name variants
- one renamed location
- one contradictory historical date
- one unresolved thread

Expected:

- separate sources preserved
- merge proposals with evidence
- no silent canonical merge
- contradiction displayed with both sources
- unresolved thread included in continuation package

## 21.3 Character knowledge versus world truth

A character states a false belief about the world.

Expected:

- dialogue remains source evidence
- belief may be attached to the character
- statement is not promoted as objective world canon

## 21.4 Timeline

Add two events with impossible ordering.

Expected:

- warning cites both events and sources
- user may correct, explain, mark uncertain, or keep as intentional contradiction

## 21.5 Visual generation

Generate a location concept from approved canon.

Expected:

- visual brief visible before generation
- provider/model/cost recorded
- output remains a concept
- user explicitly approves canonical visual
- storage path remains durable

## 21.6 Permissions

- viewer cannot change canon
- commenter can create permitted notes only
- writer can propose according to policy
- editor can resolve according to role policy
- non-member cannot access source files, world facts, or assets
- studio approval roles follow configured governance

## 21.7 Large corpus

Test a corpus with:

- multiple works
- hundreds of characters and locations
- repeated aliases
- conflicting facts
- long timelines

Entity matching and graph rendering must not require all-pairs comparison in the browser.

---

# 22. Do not build

Do not build:

- a blank wiki with hundreds of fields
- a map disconnected from story evidence
- automatic canon from imported dialogue
- automatic destructive entity merges
- one static location card for all eras
- a screenplay-only world schema
- a provider-specific canonical model
- image generation before canon and asset lineage exist
- short videos with no connection to approved world state
- a hidden source-rights assumption
- a continuity score with no evidence
- a system that demands world completion before writing
- a world guide that asks endless questions
- a graph visualization that is beautiful but unusable
- temporary signed URLs as permanent asset identity

---

# 23. Canonical terminology

Use these terms consistently:

- **World Building** — the complete SceneSmith capability
- **World Bible** — the human-readable approved reference
- **World Graph** — the structured network of entities, relationships, evidence, and time
- **World Entity** — a location, faction, rule, event, object, culture, language, species, technology, belief, or other approved world object
- **World Candidate** — an imported or detected item awaiting review
- **World Fact Proposal** — a proposed statement or field value awaiting resolution
- **World Evidence** — the exact source supporting a candidate or fact
- **World Review Inbox** — the unified place to review discoveries, duplicates, and conflicts
- **World State** — what is true at a particular time, era, episode, chapter, scene, or continuity branch
- **Continuation Package** — the reviewed knowledge needed to continue an existing series
- **Visual World Asset** — an image, map, diagram, or clip linked to an approved world snapshot
- **World Style Contract** — the shared visual rules for a project or universe

Avoid reducing the system to:

- Locations
- Lore Wiki
- AI World Generator
- Map Maker

Those labels describe individual tools, not the platform capability.

---

# 24. Final doctrine

SceneSmith World Building exists to help creators see the worlds emerging from their stories, understand what is established, continue complex series responsibly, and translate approved canon into consistent creative and production assets.

Its enduring principles are:

```text
Let the story create the need for worldbuilding.
Preserve every source and uncertainty.
Extract candidates, not automatic truth.
Keep canon explicit and evidence-backed.
Connect characters, places, history, systems, and time.
Help the writer see the world without leaving the page for long.
Keep providers replaceable.
Generate visuals from approved world state.
Protect authorship, rights, and continuity.
Return the creator to the story.
```

World Building succeeds when a creator can import or write a body of work, understand the world that already exists, make intentional additions, and continue the story without losing canon, imagination, or control.