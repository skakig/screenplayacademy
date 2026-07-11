# SceneSmith ITS/PfHU Importation

## Status

Canonical long-term product doctrine and implementation compass.

This document defines how SceneSmith Studio must ingest authorized story corpora, preserve source evidence, extract reviewable story intelligence, and use ITS/PfHU to help writers understand, continue, review, and protect long-running stories.

It exists to prevent importation from drifting into:

- a generic file uploader
- automatic canon creation
- character-name scraping
- a one-shot summary
- an opaque embedding database
- destructive duplicate merging
- a screenplay-only parser
- style imitation without authorship safeguards
- a continuity checker with no source evidence
- a disconnected AI report that does not feed the Writer's Desk, Character Bible, World Graph, Academy, or Editorial Review

This is not a request to implement the complete system in one pass.

Use it to guide repository architecture, source ingestion, entity resolution, adaptive onboarding, character/world extraction, continuity review, series continuation, permissions, pricing, and implementation sequence.

---

## Read first

Before implementing work governed by this document, read:

1. `AGENTS.md`
2. `docs/SCENESMITH_INTELLIGENCE_PLATFORM_VISION.md`
3. `docs/SCENESMITH_STORY_PRODUCTION_PLATFORM.md`
4. `docs/SCENESMITH_WORLD_BUILDING.md`
5. `docs/SCENESMITH_ACADEMY.md`
6. `docs/CHARACTER_TRUTH_ENGINE.md`
7. `docs/CHARACTER_TRUTH_ENGINE_SOURCE_SYSTEMS.md`
8. `docs/SCENESMITH_VOICE_STUDIO.md` when audio, audiobook, or spoken-source ingestion is involved
9. the current import, editor, Character Bible, Story Graph, collaboration, database, privacy, i18n, and editorial-review documentation

The Writer's Desk remains the center of gravity.

Importation exists to give SceneSmith evidence-backed understanding of an existing story. It must not block ordinary writing, overwrite approved canon, or treat model interpretation as fact.

---

# 1. Executive thesis

SceneSmith ITS/PfHU Importation is not merely document parsing.

It is the intelligence-ingestion layer that helps SceneSmith move from:

```text
authorized source material
→ preserved source corpus
→ normalized and segmented evidence
→ extracted candidates
→ identity and continuity proposals
→ human-reviewed canon
→ adaptive writer understanding
→ continuation guidance
→ editorial review against the established story
```

The central product promise is:

> Import the works that define a story. SceneSmith helps you understand who exists, what happened, what the world permits, what remains unresolved, and what a writer needs to know before continuing it.

The system must support authorized sources including:

- screenplays
- teleplays
- episode scripts
- shooting scripts
- novels and novellas
- short stories
- manuscripts
- series bibles
- character bibles
- lore documents
- production notes
- transcripts
- audiobook transcripts
- audio dramas
- stage plays
- skits and creator scripts
- YouTube series scripts
- podcast scripts
- interactive-story exports
- revision notes and approved editorial decisions

The system must scale from:

```text
one prior script used to prepare a sequel
```

to:

```text
hundreds of episodes, books, drafts, bibles, and production decisions across a shared universe
```

---

# 2. Product identity

ITS/PfHU Importation is a cross-cutting platform capability.

It connects:

- Import Center
- Character Bible
- World Building / World Graph
- Story Graph
- Academy
- Writer's Desk
- Writers' Room
- Editorial Review
- Series Continuity
- Pitch and Producer tools
- Voice Studio
- future Production Graph workflows

It should produce useful, reviewable intelligence rather than a pile of imported text.

The system should eventually answer questions such as:

- Which characters already exist?
- Which names, titles, ranks, aliases, and spellings refer to the same person?
- What does each character want, fear, know, believe, hide, and become?
- Which relationships are established and how have they changed?
- Which locations, factions, rules, artifacts, and historical events define the world?
- What is objectively true, what is rumor, and what is only one character's belief?
- Which promises, mysteries, injuries, debts, and arcs remain unresolved?
- What must a new writer understand before writing the next episode or book?
- Does the new draft contradict character behavior, chronology, world rules, or established consequences?
- Which contradiction is a genuine continuity error, and which is an intentional retcon or alternate continuity?

Every answer used professionally must cite its source evidence.

---

# 3. The role of ITS and PfHU

Importation is not complete when SceneSmith extracts facts.

The system must also understand:

```text
What knowledge exists in the corpus?
What does this writer already understand?
What must this writer understand next?
How should that understanding be presented to this writer?
```

## 3.1 ITS: Intelligent Tutoring System responsibilities

The ITS layer builds and maintains a learnable knowledge model of the imported story.

It may determine:

- prerequisite canon knowledge
- important versus optional information
- role-specific knowledge requirements
- misconceptions
- missing understanding
- repeated continuity mistakes
- appropriate next briefing
- when evidence should be shown
- when a writer is ready to continue
- which questions reveal whether the writer understands the story
- which repair path is needed after an error

Examples:

A new episode writer may need to understand:

1. the protagonist's current goal
2. the protagonist's moral regression under pressure
3. who knows the secret
4. the political state after the prior finale
5. which relationship rupture remains unresolved

The ITS should not dump the entire corpus.

It should construct an adaptive path through the minimum knowledge required for the writer's current assignment.

## 3.2 PfHU: Person-focused Human Understanding responsibilities

The PfHU layer adapts how imported story intelligence is presented.

It may consider approved and relevant signals such as:

- writer experience
- project role
- familiarity with the series
- task type
- preferred level of detail
- visual versus textual preference
- tolerance for interruption
- demonstrated understanding
- repeated confusion
- whether the writer needs examples, evidence, diagrams, summaries, or direct access to sources

PfHU may adapt:

- briefing length
- terminology
- order of information
- number of examples
- use of maps, timelines, relationship diagrams, or scene excerpts
- frequency of checks
- depth of explanation
- whether to interrupt or defer a warning

PfHU must not:

- make hidden clinical or psychological claims
- infer sensitive traits from creative work
- present an internal profile as fact
- use adaptation to manipulate the writer
- overwrite explicit user preferences

## 3.3 The combined function

ITS decides:

```text
what understanding is needed next
```

PfHU decides:

```text
how to deliver that understanding to this writer
```

The imported corpus supplies:

```text
the evidence-backed story knowledge
```

Together:

```text
Corpus evidence
+ ITS knowledge map
+ PfHU delivery model
→ adaptive series onboarding
→ contextual writing support
→ evidence-backed editorial review
```

---

# 4. Prime directives

## 4.1 Imports create candidates, not automatic truth

The import system may detect and propose:

- characters
- aliases
- relationships
- locations
- factions
- rules
- events
- objects
- secrets
- themes
- story promises
- character states
- unresolved threads
- stylistic observations

It must not silently:

- create canonical characters
- merge established identities
- promote one draft above another
- establish a definitive timeline
- treat dialogue as objective truth
- convert rumor into canon
- infer a character's moral state as fact
- overwrite the current Character Bible or World Graph
- replace approved editorial decisions

## 4.2 Preserve the original source

Every import must retain durable source identity and provenance.

The system must preserve, subject to rights and retention settings:

- original file or authorized source reference
- checksum
- format
- document title
- source type
- version or draft label
- author or rights metadata
- publication or production order
- story chronology order when known
- page, scene, chapter, paragraph, line, or timestamp segmentation
- extraction and model versions
- import date
- importing user

A derived claim must remain traceable to the exact source segment that supports it.

## 4.3 Canon authority is configurable

Long-running series contain conflicting sources.

SceneSmith must support source-authority rules such as:

```text
showrunner-approved series bible
> locked production script
> released episode
> approved screenplay draft
> writers' room decision
> early draft
> brainstorm note
```

Authority cannot be inferred solely from upload order.

The owner, showrunner, editor, or authorized role must configure source priority.

## 4.4 Identity resolution proposes; humans decide

The system should detect likely identity variants, including:

```text
HANS
HANS (V.O.)
LT. HANS
OBERLEUTNANT HANS-DIETER VON ZWICK
HANNS
```

But established records must not be destructively merged without human approval.

Identity proposals must show:

- names and aliases
- source occurrences
- scene or chapter overlap
- dialogue or description evidence
- ranks and titles
- temporal variants
- conflicting facts
- confidence
- reason for the match

A confirmed Keep Separate decision must be remembered.

## 4.5 Canon, belief, inference, and uncertainty are distinct

SceneSmith must distinguish:

```text
source quotation
objective source statement
character belief
rumor
lie
memory
prophecy
inference
production note
proposed canon
approved canon
superseded canon
retcon
alternate continuity
unknown
```

A character saying “The king murdered his brother” does not establish that fact as objective canon.

## 4.6 The Writer's Desk remains local-first

Import processing, embeddings, graph construction, and analysis must never enter the keystroke-to-render path.

Correct:

```text
writer types locally
→ background save
→ optional continuity check after idle, snapshot, or explicit request
→ evidence-backed proposal
```

Never:

```text
writer types
→ corpus query
→ model request
→ database round trip
→ text renders
```

## 4.7 Provider neutrality is mandatory

The canonical import model must not depend on one OCR, transcription, embedding, extraction, or language-model provider.

Use replaceable adapters for:

- document parsing
- OCR
- speech transcription
- segmentation
- entity extraction
- relation extraction
- identity resolution
- embeddings and retrieval
- summarization
- translation
- continuity analysis

The source corpus, evidence graph, approvals, and learned writer state must survive provider changes.

## 4.8 Rights and authorization are mandatory

SceneSmith should support material the user owns, created, licensed, or is authorized to use.

The product must not encourage:

- unauthorized downloading
- piracy
- access-control circumvention
- scraping protected repositories
- importing confidential material without permission

The import flow should capture rights status and source ownership metadata.

---

# 5. Supported import outcomes

Importation should produce typed, reviewable outputs.

## 5.1 Character candidates

Possible extracted character intelligence:

- canonical-name proposal
- aliases and speaker labels
- age or age range
- rank, title, occupation
- appearance statements
- goals
- needs
- fears
- wounds
- secrets
- contradictions
- values
- voice patterns
- moral baseline proposals
- stress behavior
- relationships
- knowledge states
- scene or chapter participation
- arc states
- injuries
- possessions
- unresolved obligations

Character extraction must feed the Character candidate and proposal lifecycle.

It must not write directly into approved Character Bible canon.

## 5.2 Relationship candidates

Possible relationship intelligence:

- relationship type
- directionality
- trust
- power
- affection
- resentment
- secrecy
- dependence
- hierarchy
- current state
- state changes
- source evidence

Relationships must be temporal.

A friendship in Episode 1 may be an enemy relationship by Episode 8.

## 5.3 World candidates

Possible world intelligence:

- locations
- regions
- factions
- institutions
- cultures
- languages
- laws
- technologies
- magic rules
- species
- religions
- historical events
- artifacts
- myths
- political control
- economic systems
- travel rules

These feed the World Review Inbox and World Graph proposals.

## 5.4 Story and continuity candidates

Possible outputs:

- scene or chapter cards
- chronology
- story events
- promises and payoffs
- mysteries
- reveals
- unresolved threads
- completed arcs
- repeated arcs
- continuity conflicts
- knowledge-state conflicts
- location-state conflicts
- object-state conflicts
- thematic patterns
- genre promises

## 5.5 Style and craft observations

The system may analyze:

- dialogue density
- sentence or scene rhythm
- use of subtext
- point-of-view patterns
- structural tendencies
- tonal range
- recurring motifs
- formatting conventions
- humor cadence

These observations must be treated as descriptive evidence, not permission to imitate a living author's protected style.

SceneSmith should help preserve project voice and internal consistency without claiming to reproduce an author's identity.

---

# 6. Corpus architecture

## 6.1 Universe and corpus

A universe may contain multiple projects and source corpora.

Conceptual entities:

```text
story_universes
source_corpora
source_documents
source_segments
source_versions
source_authority_rules
```

## 6.2 Source documents

Conceptual fields:

```text
source_documents
- id
- corpus_id
- project_id
- title
- source_type
- media_type
- storage_path or authorized reference
- checksum
- rights_status
- rights_notes
- author / creator metadata
- draft_label
- release_order
- chronology_order
- language
- status
- imported_by
- imported_at
```

## 6.3 Source segments

Segments must support:

- screenplay scene
- screenplay block
- chapter
- paragraph
- page
- dialogue turn
- transcript timestamp range
- episode segment
- editorial decision

Conceptual fields:

```text
source_segments
- id
- document_id
- segment_type
- sequence
- heading
- raw_text
- normalized_text
- page / scene / chapter / timestamp metadata
- character or speaker labels
- language
- checksum
```

## 6.4 Extraction runs

```text
import_extraction_runs
- id
- corpus_id
- document_id
- extractor_version
- provider
- model
- policy_version
- started_at
- completed_at
- status
- cost_metadata
- error_metadata
```

## 6.5 Import candidates

```text
import_candidates
- id
- extraction_run_id
- candidate_type
- normalized_key
- proposed_payload
- confidence
- evidence_segment_ids
- status
- reviewed_by
- reviewed_at
- resolution
- merged_into_entity_id
- supersedes_id
```

## 6.6 Evidence

```text
import_evidence
- id
- candidate_id
- source_segment_id
- excerpt
- timestamp_or_page
- evidence_type
- confidence
- direct_or_inferred
```

## 6.7 Identity decisions

```text
import_identity_decisions
- id
- corpus_id
- entity_type
- proposed_ids
- resolved_entity_id
- decision
- evidence_ids
- decided_by
- decided_at
- undo_snapshot
```

## 6.8 Canon promotions

Every promotion must record:

- source candidate
- destination entity and field
- previous value
- approved value
- source authority
- approving user
- timestamp
- superseding relationship
- reversal reference

## 6.9 Knowledge map

The ITS should not operate directly on raw text alone.

Conceptual entities:

```text
series_knowledge_nodes
- id
- universe_id
- concept_type
- entity_ids
- title
- explanation
- evidence_ids
- importance
- prerequisite_node_ids
- role_relevance
- current_status
```

Examples of knowledge nodes:

- Hans does not know Stephan read the telegram.
- The northern gate is inaccessible after the siege.
- The protagonist's central lie is that obedience prevents harm.
- The public believes the king died naturally; three characters know otherwise.

## 6.10 Writer understanding state

```text
writer_knowledge_state
- user_id
- universe_id
- knowledge_node_id
- status: unseen | introduced | understood | uncertain | contradicted | mastered
- evidence_of_understanding
- last_checked_at
- confidence
- preferred_presentation
```

This state supports adaptive onboarding and repair.

It must not become a hidden personality judgment.

---

# 7. Import pipeline

The import pipeline should be staged and restartable.

```text
Authorization and rights confirmation
→ upload or authorized source connection
→ durable source storage
→ checksum and duplicate detection
→ format parsing or transcription
→ segmentation
→ language detection
→ entity and event extraction
→ identity resolution proposals
→ relationship and world proposals
→ chronology and continuity proposals
→ human review
→ canon promotion
→ knowledge-map construction
→ adaptive continuation package
```

## 7.1 Preserve before interpreting

The original file or authorized source must be durably stored or referenced before model interpretation.

## 7.2 Avoid repeated cost

Segmentation, extraction, embeddings, and interpretation should be versioned and cached by checksum.

Re-running one failed stage should not repeat every paid stage.

## 7.3 Large-corpus processing

For long-running series:

- process incrementally
- maintain per-document status
- support pause and resume
- show progress
- show cost estimates
- isolate failed documents
- allow reprocessing with improved extractors
- preserve prior accepted canon

## 7.4 Contradiction handling

Contradictions should create review items, not force a winner.

Possible explanations include:

- genuine continuity error
- unreliable narrator
- character lie
- retcon
- alternate timeline
- dream or hallucination
- draft difference
- production change
- source-authority conflict

The reviewer must be able to classify the contradiction.

---

# 8. The Import Center user experience

## 8.1 Import setup

The user should choose:

- universe or project
- source type
- rights status
- source authority
- draft or release status
- chronology position
- language
- desired extraction depth

Do not begin expensive processing without showing expected scope or credits.

## 8.2 Processing dashboard

Show stages such as:

```text
Uploaded
Parsed
Segmented
Characters detected
World elements detected
Relationships detected
Continuity analyzed
Ready for review
```

Each source should show errors and retry actions independently.

## 8.3 Review Inbox

One review system should organize:

- new characters
- likely aliases
- possible duplicates
- new locations
- factions and institutions
- relationship proposals
- timeline events
- world rules
- unresolved threads
- contradictions
- low-confidence extractions
- ignored items

Every item must explain:

- why it appeared
- which sources support it
- what accepting it will change
- whether it conflicts with current canon

## 8.4 Continuation Dashboard

After review, present:

```text
Established cast
Current character states
Relationship changes
World state
Timeline position
Open mysteries
Unresolved promises
Incomplete arcs
Known secrets
Continuity risks
Required knowledge for the next work
```

## 8.5 Evidence-first question answering

Users may ask questions about the imported series.

Answers must:

- cite source documents and segments
- distinguish direct fact from inference
- expose uncertainty
- respect source authority
- distinguish public knowledge, character knowledge, and objective canon

The system must not answer from an uncited generic summary when source evidence exists.

---

# 9. Adaptive series onboarding

A new writer, editor, actor, director, or producer should not receive the same briefing.

## 9.1 Role-aware onboarding

### Writer

Needs:

- current character states
- unresolved arcs
- relationship pressure
- world rules
- voice patterns
- story promises

### Senior editor or showrunner

Needs:

- source conflicts
- continuity risks
- unresolved approval decisions
- repeated story patterns
- writer assignments
- canon authority

### Actor or table-read participant

Needs:

- character history
- relationships
- current emotional state
- voice and performance notes
- knowledge state

### Director or production role

Needs:

- current approved draft
- locations
- production-relevant world facts
- visual canon
- continuity states
- locked decisions

## 9.2 ITS onboarding path

The ITS should build a path such as:

```text
Core premise
→ current world state
→ assigned characters
→ active relationships
→ unresolved threads
→ assignment-specific constraints
→ brief understanding check
→ open Writer's Desk
```

## 9.3 PfHU presentation

The same knowledge may be presented as:

- concise briefing
- timeline
- relationship map
- character cards
- source excerpts
- question-and-answer guide
- narrated or Voice Studio briefing

## 9.4 Understanding checks

Checks should be useful and lightweight.

Good:

> Who knows the telegram is forged at the start of Episode 6?

> What pressure causes Hans to regress?

> Which location is inaccessible after the bridge collapse?

Bad:

- trivia unrelated to the assignment
- punitive quizzes
- blocking the writer from opening the editor
- grading moral agreement

---

# 10. Integration with Character Bible

Importation should become the safest and most powerful way to initialize an existing cast.

## 10.1 Character population workflow

```text
Source corpus
→ character candidates
→ alias and identity review
→ evidence-backed profile proposals
→ human approval
→ Character Bible
```

The system may propose a substantially populated profile, but canonical fields remain user-controlled.

## 10.2 Three character data tiers

### Canonical

Human-approved facts.

### Behavioral

Evidence-backed interpretations, including Character Truth and TMH-related proposals.

### Temporal

What is true for the character at a specific scene, chapter, episode, or date.

Importation must route information into the correct tier.

## 10.3 Character alignment model

For long-running series, imported evidence may support:

- baseline behavior
- stress regression
- moral ceiling
- voice fingerprint
- attachment and relationship behavior
- recurring defenses
- knowledge state
- secrets
- unresolved injuries
- promises and obligations
- arc trajectory

These are inputs to editorial analysis, not unquestionable truth.

---

# 11. Integration with World Building

`docs/SCENESMITH_WORLD_BUILDING.md` defines the World Graph and World Bible.

ITS/PfHU Importation supplies evidence-backed candidates from existing works.

The World Building system supplies:

- entity destination
- temporal world-state model
- canon lifecycle
- atlas and timeline
- continuity rules
- visual and production outputs

The import system must not duplicate those canonical models.

---

# 12. Integration with Editorial Review

This is one of the system's highest-value professional uses.

A new draft may be reviewed against:

- approved Character Bible
- imported source corpus
- World Graph
- timeline
- relationship states
- character knowledge
- prior promises and payoffs
- established voice
- thematic patterns
- approved retcons
- source-authority rules

Possible findings:

- character behavior lacks a visible catalyst
- character voice has drifted
- a secret is revealed by someone who does not know it
- a location is used after its destruction
- an injury or object disappears
- a relationship reverts without explanation
- an old arc is repeated
- a world rule is contradicted
- a prior promise is forgotten
- a retcon conflicts with a locked source

Every finding must include:

- evidence
- affected scene or chapter
- severity
- confidence
- likely explanation
- suggested resolution paths

The review system must never silently rewrite the draft.

---

# 13. Integration with Academy

Academy uses the imported knowledge map to guide the writer through the story they are continuing.

It may:

- explain required canon
- ask one useful assignment-specific question
- repair misunderstanding
- reveal source evidence
- suggest relevant prior scenes
- explain why a continuity warning matters
- return the user to the page

Academy must not become a detached quiz course about the imported series.

---

# 14. Multilingual and cross-media importation

The system must support:

- original-language preservation
- translated editions
- subtitles
- scripts and released media transcripts
- code-switching
- transliterated names
- invented vocabulary
- pronunciation memory
- cross-language alias proposals

Rules:

- preserve source language
- store translations separately
- do not merge names across languages without evidence and review
- expose translation uncertainty
- distinguish adaptation changes from translation differences

Audiobooks and audio dramas require timestamped transcript evidence.

Visual media may later contribute approved image, costume, location, or blocking evidence, but visual inference remains separate from textual canon.

---

# 15. Collaboration, permissions, and governance

Roles must control:

- who may upload sources
- who may view source files
- who may run paid extraction
- who may review candidates
- who may merge identities
- who may promote canon
- who may configure source authority
- who may approve retcons
- who may delete source material
- who may export the corpus

Professional workflows should support:

```text
Researcher imports
→ assistant editor reviews evidence
→ story editor resolves candidates
→ showrunner approves canon
→ writer receives adaptive continuation brief
```

Authorship and source credit must remain visible.

---

# 16. Privacy, intellectual property, and security

Imported story corpora may contain highly valuable unreleased intellectual property.

Required controls:

- project and universe isolation
- private storage
- durable paths rather than permanent signed URLs
- encryption and secure transport
- RLS
- service-role containment
- access audit
- deletion and export
- retention settings
- provider disclosure
- no training assumption without explicit policy
- source-rights attestation
- confidentiality labels
- legal-hold or production-lock support later

The user must understand which providers receive source text or audio.

---

# 17. Cost and monetization

Large-corpus importation can be expensive and highly valuable.

Track:

- pages or words parsed
- audio minutes transcribed
- OCR cost
- extraction tokens
- embedding cost
- storage
- identity-resolution runs
- continuity-analysis runs
- interpretation model cost
- user credits
- margin

Possible product structure:

## Creator

- single-source import
- basic character and location candidates
- limited continuation brief

## Pro

- multi-document corpus
- Character Bible population proposals
- World Graph proposals
- continuity analysis
- adaptive writer onboarding

## Studio

- seasons and series corpora
- configurable source authority
- team review workflow
- role-specific onboarding
- editorial review integration
- versioned canon and retcons
- usage and audit reporting

Potential add-ons:

- Feature Script Intelligence Import
- Novel or Manuscript Import
- Season Corpus Import
- Series Bible Build
- Continuity Audit
- New Writer Onboarding Package

Prices must be based on actual provider, storage, and review costs.

---

# 18. Implementation sequence

Do not build this as one giant import pass.

## Phase 0 — Repository and source-contract audit

Before code, return:

- current import capabilities
- supported formats
- source storage
- parser and transcription inventory
- Character Bible destinations
- World Graph destinations
- Story Graph destinations
- existing proposal and evidence models
- RLS and role helpers
- cost assumptions
- provider-neutral contracts
- UX wireframes

## Phase 1 — Source preservation and segmentation

Implement:

- upload
- rights metadata
- durable storage
- checksum
- duplicate detection
- parsing
- segmentation
- status and retry

No automatic canon creation.

## Phase 2 — Character candidates

Implement:

- speaker and person extraction
- alias proposals
- identity evidence
- character candidate review
- promotion into Character Bible proposals

## Phase 3 — World and story candidates

Implement:

- locations
- factions
- events
- world rules
- artifacts
- unresolved threads
- timeline proposals

## Phase 4 — Multi-source corpus and source authority

Implement:

- multiple works
- priority rules
- contradiction review
- retcon classification
- alternate continuity
- incremental reprocessing

## Phase 5 — ITS knowledge map

Implement:

- knowledge nodes
- prerequisites
- role relevance
- required assignment knowledge
- understanding-state tracking

## Phase 6 — PfHU adaptive continuation briefing

Implement:

- role-aware presentation
- depth adaptation
- maps, timelines, cards, and evidence
- lightweight understanding checks
- repair paths

## Phase 7 — Editorial review integration

Implement:

- evidence-backed draft comparison
- character alignment findings
- world and timeline findings
- relationship and knowledge-state findings
- review package

## Phase 8 — Cross-media and multilingual expansion

Implement:

- audiobook and audio transcripts
- translated sources
- adaptation comparison
- visual-source proposals

Each phase must have a separate plan, commit, tests, and acceptance demonstration.

---

# 19. Required acceptance tests

## 19.1 Source preservation

Upload an authorized screenplay.

Expected:

- original source retained
- checksum recorded
- scenes and blocks segmented
- no canonical character or world record created automatically

## 19.2 Character extraction

A script contains:

```text
HANS
HANS (V.O.)
LT. HANS
OBERLEUTNANT HANS-DIETER VON ZWICK
```

Expected:

- evidence-backed identity proposal
- exact formatting variants grouped safely
- established records not destructively merged
- human review required

## 19.3 Distinct same-name characters

Two different characters are named John.

Expected:

- they remain separate when scene, relationship, or co-occurrence evidence indicates distinct identities

## 19.4 Belief versus canon

A character falsely claims a city was destroyed.

Expected:

- character belief or lie proposal
- no objective location-state change

## 19.5 Multi-source contradiction

An early draft says a character is an only child; the released episode introduces a sister.

Expected:

- source-authority conflict
- no silent overwrite
- retcon, draft difference, or continuity-error resolution options

## 19.6 Continuation package

Import a season of scripts.

Expected:

- established cast
- aliases
- current character states
- relationships
- world state
- chronology
- unresolved threads
- evidence links
- required writer knowledge

## 19.7 Adaptive onboarding

A new writer and a senior editor open the same corpus.

Expected:

- different role-appropriate briefings
- same underlying evidence
- no hidden personality claims

## 19.8 Editorial review

A new draft gives a secret to a character who never learned it.

Expected:

- knowledge-state finding
- cited source evidence
- affected draft location
- advisory resolution choices
- no automatic rewrite

## 19.9 Permissions

Test owner, co-writer, editor, commenter, viewer, and non-member.

Expected:

- role-appropriate source, candidate, canon, and review access
- no source leakage
- only authorized roles approve canon or source authority

## 19.10 Cost idempotency

Retry a failed extraction stage.

Expected:

- preserved prior stages
- no duplicate candidates
- no duplicate billing for cached successful work

---

# 20. Do not build

Do not build:

- a file uploader that immediately fills canonical tables
- a generic “summarize this series” button
- an uncited question-answering chatbot
- automatic character merging
- one JSON blob containing the whole universe
- a screenplay-only import schema
- a hidden psychological profile of the writer
- blocking quizzes before the Writer's Desk opens
- a continuity score with no evidence
- style cloning presented as authorial fidelity
- provider-specific canonical fields
- repeated full-corpus processing for every question
- imported source access that bypasses project permissions
- unauthorized acquisition of copyrighted sources

---

# 21. Canonical terminology

Use these terms consistently:

- **ITS/PfHU Importation** — the complete intelligence-ingestion and adaptive-understanding system
- **Source Corpus** — authorized materials used to establish story evidence
- **Source Document** — one imported work or approved reference
- **Source Segment** — a citeable unit such as scene, block, chapter, paragraph, or timestamp
- **Import Candidate** — extracted information awaiting review
- **Evidence** — source support for a candidate, fact, or finding
- **Source Authority** — configured priority among conflicting sources
- **Knowledge Node** — an evidence-backed concept a writer or role may need to understand
- **Writer Knowledge State** — current demonstrated familiarity with a knowledge node
- **Continuation Package** — reviewed cast, world, timeline, unresolved-story, and required-knowledge briefing
- **Character Alignment Finding** — evidence-backed comparison between a new draft and established character behavior/state
- **Canon Promotion** — human-approved movement from proposal into canonical project data

Avoid reducing the system to:

- import AI
- auto character generator
- screenplay scraper
- series summarizer

Those labels are too narrow and encourage architectural drift.

---

# 22. Final doctrine

SceneSmith ITS/PfHU Importation exists to make long-running stories understandable, teachable, continuable, and reviewable without replacing human authority.

Its enduring principles are:

```text
Preserve the source.
Extract candidates, not truth.
Attach evidence to every professional claim.
Let humans control identity and canon.
Use ITS to decide what must be understood.
Use PfHU to decide how to present it.
Adapt by role and task.
Protect the Writer's Desk.
Feed Character Bible, World Graph, Academy, and Editorial Review.
Keep providers replaceable.
```

The system succeeds when a creator or new team member can import authorized prior works, understand the living story with source-backed confidence, continue it without unnecessary repetition or contradiction, and receive editorial guidance that respects both canon and authorship.