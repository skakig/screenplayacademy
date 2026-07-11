# SceneSmith Story Production Platform

## Status

Canonical long-term product doctrine and product-architecture specification.

This document defines how SceneSmith Studio must evolve from a professional writing environment into an end-to-end story production operating system that can prepare, translate, govern, and track creative work across human production teams and changing generations of AI media tools.

This is not a request to implement the entire platform in one pass.

It exists so that current work on scripts, characters, locations, storyboards, pitch materials, collaboration, review, and production metadata is not discarded or rebuilt every time a new production capability or model provider appears.

## Read first

Before implementing anything described here, read:

1. `AGENTS.md`
2. `docs/SCENESMITH_INTELLIGENCE_PLATFORM_VISION.md`
3. `docs/SCENESMITH_ACADEMY.md`
4. `docs/CHARACTER_TRUTH_ENGINE.md`
5. `docs/CHARACTER_TRUTH_ENGINE_SOURCE_SYSTEMS.md`
6. the feature-specific Lovable and architecture documents

The intelligence-platform doctrine explains how SceneSmith understands stories, writers, characters, relationships, morality, continuity, and quality.

This document explains how that understanding becomes production-ready outputs.

---

# 1. Executive thesis

SceneSmith Studio is not merely a screenplay editor and must not become a thin front end for a single AI model.

SceneSmith Studio is an intelligent story production platform.

Its long-term purpose is to help a creator move from:

```text
idea
→ guided development
→ story model
→ screenplay
→ editorial review
→ approved draft
→ production design
→ production package
→ generated or filmed assets
→ completed release
```

The screenplay remains the central creative document, but it is not the end of the workflow.

It becomes the human-readable source from which SceneSmith derives a structured production model.

Core principle:

```text
The screenplay is the creative source of truth.
The Story Graph is the structured source of truth.
The Scene Compiler translates both into production-ready instructions.
```

SceneSmith does not need to own every image, audio, video, rendering, or editing model.

It must help creators use those systems intelligently, consistently, economically, and without losing authorship or narrative integrity.

---

# 2. Product identity

SceneSmith Studio should eventually serve:

- first-time screenwriters
- professional screenwriters
- senior editors
- story editors
- head writers
- showrunners
- producers
- directors
- directors of photography
- production designers
- continuity teams
- casting teams
- location teams
- YouTube creators
- independent filmmakers
- animation teams
- audio-drama teams
- AI-native filmmakers
- studios managing serialized intellectual property

The product must scale from:

```text
one writer with an idea
```

to:

```text
a multi-department studio managing a long-running series
```

The interface must not expose every department to every user at once.

SceneSmith should progressively reveal tools based on:

- project type
- production profile
- project maturity
- permissions
- role
- subscription level
- explicit user choice

---

# 3. Non-negotiable product rules

## 3.1 The Writer's Desk remains sacred

The local-first screenplay editor remains the center of gravity.

Nothing described here may introduce network latency, model calls, production analysis, or asset generation into the keystroke-to-render path.

Correct:

```text
user types
→ local state renders immediately
→ background persistence
→ optional downstream analysis after idle, save, snapshot, or explicit request
```

Never:

```text
user types
→ production graph rebuild
→ model request
→ database round trip
→ text renders
```

## 3.2 Human authorship remains authoritative

AI systems may:

- interpret
- extract
- classify
- estimate
- translate
- suggest
- simulate
- generate drafts or assets when requested

AI systems must not:

- silently alter canonical screenplay content
- overwrite approved story facts
- replace human approvals
- erase authorship history
- present generated assumptions as confirmed canon
- lock the project to one provider

## 3.3 Canon is explicit

The system must distinguish:

- proposed facts
- inferred facts
- approved canon
- superseded canon
- temporary production assumptions
- generator-specific instructions

A generated image or video must not automatically become canonical character appearance, wardrobe, location, or blocking.

The user must approve that promotion.

## 3.4 Every downstream artifact must be traceable

Every production artifact should answer:

```text
Which project produced this?
Which draft produced it?
Which scene or shot produced it?
Which approved character/location/wardrobe state was used?
Which model/provider/version produced it?
Which prompt package and settings were used?
Who requested it?
Who approved it?
What replaced it?
```

## 3.5 Provider neutrality is mandatory

SceneSmith must not design its canonical data model around the prompt format, limitations, or naming conventions of one current model.

Models will change.

The story and production model must survive them.

---

# 4. The platform model

SceneSmith should be understood as seven connected layers.

```text
1. Human Story Layer
2. Story Graph
3. Production Graph
4. Scene Compiler
5. Provider Adapters
6. Asset and Approval Pipeline
7. Studio Operations
```

## 4.1 Human Story Layer

The human-readable creative surfaces:

- screenplay
- outline
- scenes
- character bible
- relationship map
- story spine
- notes
- revisions
- series bible
- Academy guidance
- editorial feedback

This is where people create and make meaning.

## 4.2 Story Graph

The structured narrative representation derived from and connected to the human story layer.

It should represent:

- projects
- drafts
- acts
- sequences
- scenes
- beats
- characters
- relationships
- goals
- fears
- secrets
- beliefs
- moral baseline
- stress regression
- emotional state
- knowledge state
- timeline
- locations
- props
- wardrobe
- vehicles
- creatures
- world rules
- themes
- promises
- setups
- payoffs
- unresolved threads
- canon sources

## 4.3 Production Graph

The production interpretation of the Story Graph.

It should represent:

- scene requirements
- cast requirements
- location requirements
- set requirements
- wardrobe requirements
- props
- makeup
- practical effects
- visual effects
- stunts
- sound requirements
- music requirements
- lighting concepts
- camera concepts
- coverage plans
- shot lists
- scheduling dependencies
- budget drivers
- legal and rights notes
- safety requirements
- generator assets and references

## 4.4 Scene Compiler

The Scene Compiler converts canonical story and production data into a target-specific output package.

Examples:

- screenplay PDF
- shooting script
- breakdown sheet
- storyboard brief
- cinematography brief
- shot list
- call-sheet inputs
- location brief
- casting brief
- pitch-deck section
- table-read package
- audio-drama package
- video-generation prompt package
- image-generation prompt package
- animation package
- continuity packet
- subtitle or localization package

## 4.5 Provider Adapters

Adapters translate a provider-neutral SceneSmith package into the format preferred by a specific external system.

Examples may include current or future:

- text models
- image models
- video models
- voice models
- music models
- editing systems
- previs systems
- project-management tools
- storage and review platforms

The adapter is replaceable.

The Story Graph is not.

## 4.6 Asset and Approval Pipeline

Every generated, uploaded, or filmed asset moves through a governed lifecycle.

Example:

```text
draft
→ generated
→ under review
→ revision requested
→ approved reference
→ approved production asset
→ superseded
→ archived
```

## 4.7 Studio Operations

The management layer for:

- roles
- permissions
- review queues
- approvals
- production locks
- budgets
- schedules
- departmental readiness
- asset status
- continuity risk
- production risk
- costs
- usage
- delivery packages

---

# 5. The Story Graph

## 5.1 Purpose

The Story Graph is the durable internal model that prevents preparatory work from becoming disposable.

A creator should not need to re-enter the same character, location, emotional, wardrobe, or continuity information separately for:

- screenplay writing
- storyboard generation
- pitch decks
- video generation
- casting
- table reads
- budgets
- shot planning
- continuity

The same approved fact should flow downstream.

## 5.2 Source and confidence

Every graph fact must include provenance.

Suggested conceptual model:

```ts
type CanonFact = {
  id: string;
  projectId: string;
  entityType: string;
  entityId: string;
  field: string;
  value: unknown;
  sourceType:
    | "user"
    | "screenplay"
    | "approved_suggestion"
    | "import"
    | "inference"
    | "generated_asset";
  sourceId?: string;
  confidence?: number;
  status: "proposed" | "approved" | "superseded" | "rejected";
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
};
```

The exact schema may differ, but the distinction between evidence, inference, and canon must remain.

## 5.3 Character state is temporal

A character is not one static profile.

The graph must support state at a specific point in the story:

- appearance
- age presentation
- injury
- wardrobe
- possessions
- knowledge
- emotional state
- relationship state
- moral state
- immediate objective
- fear
- location

This is critical for both continuity and same-character generation across successive scenes.

## 5.4 Relationships are first-class entities

Relationships must not be buried in unstructured notes.

They should support:

- participants
- hierarchy
- affection
- trust
- fear
- leverage
- obligation
- conflict
- public state
- private state
- change over time

## 5.5 Story promises and consequences

The graph should track:

- questions raised
- promises made to the audience
- secrets introduced
- objects planted
- warnings issued
- injuries sustained
- debts created
- lies told
- rules established
- consequences still unpaid

This powers editorial review, continuity, and long-form series integrity.

---

# 6. The Production Graph

## 6.1 Purpose

The Production Graph answers:

```text
What must exist for this story moment to be produced?
```

It should be derivable from the Story Graph but separately editable because production decisions do not always change story canon.

Example:

The script says:

```text
EXT. DESERT OUTPOST - NIGHT
```

The production graph may contain:

- practical desert location
- studio-volume alternative
- AI-generated environment alternative
- day-for-night alternative
- weather risk
- transport requirements
- power requirements
- lighting concept
- camera concept
- permit status
- estimated cost range

None of those production choices should rewrite the screenplay.

## 6.2 Scene breakdown

Each scene should eventually support a structured breakdown:

- cast present
- extras
- location
- interior/exterior
- day/night
- estimated duration
- props
- wardrobe
- makeup
- vehicles
- animals
- stunts
- VFX
- SFX
- sound
- music
- intimacy/safety flags
- special equipment
- dependencies
- budget drivers

## 6.3 Multiple production strategies

The same scene may have several valid production strategies.

Example:

```text
Strategy A — Studio feature
Practical location, full cast, crane, controlled rain

Strategy B — Independent film
Local location, reduced extras, handheld coverage, practical mist

Strategy C — YouTube creator
Single room, composited background, two performers, compact lighting

Strategy D — AI-native production
Character reference pack, environment pack, sequential video prompts, generated dialogue and sound layers
```

SceneSmith should compare strategies without declaring one universally correct.

---

# 7. Production profiles

A production profile changes the output, constraints, terminology, and recommendations without changing the story.

Initial long-term profiles may include:

- Studio Feature
- Television / Streaming Series
- Independent Film
- Short Film
- YouTube Narrative
- YouTube Unscripted / Challenge
- Social Short
- Animation
- Audio Drama
- Stage Production
- AI-Native Film
- Hybrid Live Action + Generated Media

A profile may define:

- target runtime
- aspect ratio
- typical shot coverage
- crew assumptions
- budget range
- delivery format
- safety requirements
- model-provider preferences
- acceptable generation cost
- quality thresholds
- continuity strictness
- approval workflow

Profiles should be templates, not prisons.

---

# 8. The Scene Compiler

## 8.1 Purpose

The Scene Compiler creates deterministic, versioned output packages from approved source data.

It must not simply concatenate prose into a prompt.

It must select, order, and transform the relevant information for the requested output.

## 8.2 Compiler input

Possible inputs:

- project ID
- draft snapshot ID
- scene IDs
- production profile
- output target
- approved character states
- approved location state
- approved style references
- shot plan
- budget constraints
- provider capability profile
- user instructions

## 8.3 Compiler output

A provider-neutral scene package might contain:

```ts
type SceneProductionPackage = {
  packageVersion: string;
  projectId: string;
  draftSnapshotId: string;
  sceneId: string;
  storySummary: string;
  dramaticPurpose: string;
  continuityIn: unknown;
  continuityOut: unknown;
  characters: unknown[];
  relationships: unknown[];
  location: unknown;
  wardrobe: unknown[];
  props: unknown[];
  emotionalArc: unknown[];
  actionBeats: unknown[];
  dialogue?: unknown[];
  visualIntent?: unknown;
  cameraIntent?: unknown;
  soundIntent?: unknown;
  constraints: unknown[];
  references: unknown[];
  approvals: unknown[];
};
```

## 8.4 Compiler determinism

Given the same:

- draft snapshot
- approved canon
- production profile
- compiler version
- output target

SceneSmith should be able to reproduce the same package.

This makes review, debugging, comparison, and regeneration possible.

## 8.5 Compiler modes

Possible modes:

- entire scene
- shot-by-shot
- character reference
- environment reference
- performance reference
- continuity bridge
- alternate budget
- localization
- trailer extraction
- teaser extraction
- social adaptation

---

# 9. Provider-adapter architecture

## 9.1 Core rule

Adapters translate SceneSmith packages into provider-specific requests.

They must not own story logic.

Bad:

```text
Grok character continuity fields stored as canonical project fields
```

Good:

```text
SceneSmith character continuity state
→ Grok adapter transforms it for Grok's current capabilities
```

## 9.2 Adapter contract

Conceptual interface:

```ts
interface ProductionAdapter {
  id: string;
  version: string;
  mediaType: "image" | "video" | "audio" | "music" | "text" | "mixed";
  capabilities(): ProviderCapabilities;
  validate(pkg: SceneProductionPackage): AdapterValidationResult;
  compile(pkg: SceneProductionPackage, options: AdapterOptions): ProviderRequest;
  estimateCost?(request: ProviderRequest): CostEstimate;
  submit?(request: ProviderRequest): Promise<GenerationJob>;
  poll?(job: GenerationJob): Promise<GenerationStatus>;
  normalizeResult?(result: unknown): GeneratedAsset[];
}
```

## 9.3 Capability profiles

Providers differ in:

- prompt length
- reference-image count
- character-reference support
- seed support
- shot duration
- audio support
- dialogue support
- camera-control syntax
- aspect ratios
- resolution
- identity preservation
- edit or extend support
- regional availability
- content restrictions
- pricing

These differences belong in versioned capability profiles.

## 9.4 Export-first before direct integrations

SceneSmith should not wait for every provider API.

The first implementation for any provider may be:

```text
Compile Package
→ Copy Prompt
→ Download References
→ Open Provider
```

Later:

```text
Compile Package
→ Submit through API
→ Track Job
→ Import Result
```

The provider-neutral package must exist before direct submission.

## 9.5 Bring-your-own-provider strategy

Long-term options may include:

- SceneSmith-managed credits
- user-connected provider accounts
- bring-your-own API key
- export-only workflows
- enterprise-managed provider policies

These are billing and security decisions, not reasons to compromise the canonical architecture.

---

# 10. Character continuity for generated media

## 10.1 Character reference pack

Each approved character may have a versioned reference pack:

- canonical description
- approved face references
- body proportions
- age presentation
- hair
- distinguishing features
- voice profile
- movement profile
- expression range
- wardrobe sets
- prohibited changes
- current scene state

## 10.2 Identity is not one image

A generated character identity should be treated as a controlled set of references and constraints, not a single lucky image.

## 10.3 Scene-to-scene continuity

For sequential scenes, the compiler should include:

- prior approved appearance
- wardrobe carryover
- injuries
- props carried
- emotional carryover
- location transition
- lighting transition
- time elapsed
- continuity exceptions

## 10.4 Drift detection

SceneSmith should eventually compare outputs for:

- face drift
- wardrobe drift
- age drift
- height/body drift
- prop drift
- injury drift
- location drift
- emotional-performance drift

Drift findings are review items, not automatic rejections.

---

# 11. Cinematography and the Director of Photography workspace

The cinematography workspace should interpret approved scenes without pretending to replace a human DP.

It may support:

- visual intention
- coverage plans
- shot size
- lens family
- camera height
- camera movement
- lighting concept
- color intention
- contrast
- depth of field
- aspect ratio
- composition references
- continuity across scenes
- practical versus generated strategy

## 11.1 Mockups and previs

Scene mockups, mood frames, and basic storyboards should be treated as previs/reference assets.

They are not automatically final shots.

## 11.2 Coverage generation

A scene may compile into:

- master wide
- medium coverage
- over-the-shoulders
- close-ups
- reactions
- inserts
- establishing material
- transitions
- B-roll

The coverage should reflect:

- dramatic priority
- production profile
- time and budget
- platform format
- approved visual language

---

# 12. Location intelligence

## 12.1 Purpose

Location Intelligence connects story needs to real, virtual, generated, or adapted production options.

## 12.2 Location brief

A scene-derived location brief may include:

- narrative function
- geographic characteristics
- architecture
- period
- interior/exterior needs
- weather
- season
- time of day
- sound environment
- access
- parking
- power
- permits
- lodging
- local crew
- incentives
- safety
- cost band
- visual references

## 12.3 Strategy tiers

SceneSmith may compare:

- ideal / unconstrained
- studio-scale practical
- incentive-optimized
- regional independent
- local creator
- virtual production
- generated environment
- hybrid practical + generated extension

## 12.4 Location recommendations must be current and sourced

Real-world location, permit, incentive, weather, price, and availability recommendations require current data and source attribution.

They must not be generated from stale model memory alone.

## 12.5 Privacy

Private addresses, residences, unreleased production locations, and sensitive schedules require strict access controls.

---

# 13. Budget intelligence

Budget intelligence should begin as transparent estimation and scenario comparison, not false precision.

It may estimate cost drivers from:

- cast
- extras
- locations
- company moves
- nights
- weather
- stunts
- vehicles
- animals
- period requirements
- VFX
- generated-media usage
- equipment
- travel
- lodging
- music
- post-production

## 13.1 Budget transformations

SceneSmith may suggest alternatives such as:

```text
Original requirement:
Crowded airport terminal, 150 extras, aircraft access

Lower-cost story-preserving alternatives:
Private hangar arrival
Regional terminal at dawn
Tight coverage with limited background
Virtual-extension strategy
Generated establishing shot plus practical interior
```

Alternatives must preserve dramatic purpose and remain suggestions.

## 13.2 Generation cost accounting

For AI-native workflows, track:

- provider
- model
- attempts
- duration
- resolution
- credit cost
- accepted output
- rejected output
- cost per approved shot
- cost per finished minute

---

# 14. YouTube and creator production

SceneSmith must not assume every production is a feature film.

Creator profiles may support:

- narrative YouTube
- documentary/commentary
- educational video
- challenge video
- product demonstration
- branded content
- podcast video
- social series

Creator production packages may include:

- hook
- cold open
- host script
- A-roll
- B-roll
- insert list
- sponsor placement
- prop list
- location list
- thumbnail concepts
- title variants
- chapter structure
- release checklist
- shorts extraction
- caption package

The same Story Graph and Scene Compiler should support these formats with different profiles.

---

# 15. Editorial governance and production approval

The production platform must include the senior editorial workflow discussed in the intelligence doctrine.

## 15.1 Review states

Possible script, episode, scene, and asset states:

```text
draft
under_review
revision_requested
editor_approved
showrunner_approved
producer_approved
production_ready
production_locked
superseded
archived
```

## 15.2 Approval records

Approvals should record:

- scope
- version
- approver
- role
- date
- conditions
- unresolved exceptions
- review package version

## 15.3 Redactions and revision suggestions

A senior editor must be able to:

- suggest text changes
- mark removals
- request alternatives
- assign revisions
- approve individual changes
- reject changes
- lock approved passages
- compare draft versions
- preserve discussion and rationale

## 15.4 Production lock

Production Lock must be explicit and reversible only by authorized roles.

Unlocking should create an audit record.

## 15.5 Asset approvals

Generated assets should support:

- creator approval
- department approval
- editorial approval
- legal/rights approval
- production approval

The required chain depends on the production profile.

---

# 16. Asset lineage and the Production Library

## 16.1 Asset types

The Production Library may include:

- uploaded references
- generated references
- character references
- location references
- mood frames
- storyboards
- animatics
- video clips
- voice clips
- music
- sound effects
- logos
- typography
- wardrobe references
- prop references
- shot outputs
- final approved media

## 16.2 Required metadata

Every asset should include:

- project
- draft snapshot
- source scene/shot/entity
- asset type
- creator/requester
- provider/model/version
- prompt package ID
- generation settings
- input references
- creation time
- cost
- rights/license notes
- approval status
- supersession link
- checksum/storage identity

## 16.3 Never overwrite approved assets

New generations create new versions.

Approved assets remain available for comparison and rollback.

---

# 17. Rights, consent, provenance, and safety

SceneSmith must protect creative work and production participants.

## 17.1 Script ownership

User scripts and private project data must not be exposed to providers beyond what is necessary for the requested operation.

## 17.2 Provider disclosure

Before submitting material, users should know:

- which provider receives it
- what content is sent
- whether references are sent
- expected cost
- expected retention policy when known

## 17.3 Likeness and voice consent

The platform must support consent records for:

- actor likeness
- voice cloning
- motion/performance references
- private photographs
- minors

## 17.4 Generated-content provenance

SceneSmith should preserve model and generation provenance, even when external platforms strip metadata.

## 17.5 Copyright and style requests

The product should not market direct imitation of living creators or unauthorized use of protected identities as its core value.

It should help users describe visual, tonal, structural, and cinematic characteristics in original terms.

---

# 18. Studio departments

Long-term department workspaces may include:

## Academy

Guides the creator, adapts instruction, and improves craft.

## Writer's Desk

Creates and revises the canonical screenplay.

## Writers' Room

Collaboration, notes, assignments, sessions, Arena, and presence.

## Editorial

Review queues, redlines, approvals, quality review, The Message Profile, and production lock.

## Showrunner / Series Office

Series bible, episode state, canon, character alignment, season arcs, and multi-writer governance.

## Casting

Roles, auditions, performers, voices, likeness consent, and availability.

## Locations

Location briefs, options, permits, incentives, logistics, and generated alternatives.

## Cinematography

Visual language, scene mockups, coverage, lenses, lighting, storyboards, and shot planning.

## Production Design

Sets, environments, props, wardrobe, color, and world continuity.

## Budget and Scheduling

Breakdowns, scenarios, cost drivers, calendars, dependencies, and production readiness.

## Table Read and Performance

Voice assignment, table reads, rehearsal notes, performance references, and ADR planning.

## Generation Studio

Provider selection, package compilation, generation jobs, review, cost, and asset lineage.

## Pitch and Sales

Pitch deck, bible, lookbook, budget summary, trailer concepts, and delivery package.

Departments share the same canonical graph; they do not build isolated copies of project truth.

---

# 19. Role-based experiences

The interface should adapt to role.

## Writer

- Writer's Desk
- character and scene tools
- Academy guide
- suggestions
- personal generation previews

## Senior Editor

- review queue
- redlines
- revision requests
- quality diagnostics
- approvals
- comparison
- production readiness

## Showrunner

- episode portfolio
- series continuity
- character alignment
- approvals
- writers' room workload
- season risk

## Producer

- readiness
- budget
- schedule
- locations
- approvals
- pitch and delivery

## Director / DP

- approved script
- visual plan
- storyboard
- coverage
- locations
- references
- shot assets

## Creator

- compact script
- production checklist
- generator package
- A-roll/B-roll
- publishing workflow

Roles change presentation and permissions, not underlying truth.

---

# 20. Monetization architecture

The platform supports several defensible revenue layers.

## Creator subscription

- guided writing
- core editor
- compact production tools
- limited compilation/export
- limited generation integrations

## Pro writer subscription

- advanced Academy and Coach
- full-script review
- The Message Profile
- character and continuity intelligence
- advanced export packages

## Production add-ons

- full-script intelligence review
- production breakdown
- location package
- storyboard/previs package
- generator prompt package
- continuity review
- pitch package

## Studio subscription

- multi-user governance
- senior-editor workflows
- approvals
- production locks
- series bible
- department workspaces
- usage controls
- provider policies
- audit logs

## Usage revenue

Where appropriate:

- managed generation credits
- storage
- rendering orchestration
- premium exports
- high-cost analysis

Pricing must remain transparent.

The user should understand whether they are paying SceneSmith, an external provider, or both.

---

# 21. Implementation sequence

Do not build departments as disconnected pages.

Build the shared foundation first.

## Phase 0 — Preserve current work

- inventory current character, scene, storyboard, pitch, table-read, location, and asset structures
- identify reusable fields
- document gaps
- avoid premature destructive migrations

## Phase 1 — Story Graph foundation

- stable entity IDs
- draft snapshots
- canonical facts and provenance
- character state
- relationship state
- scene requirements
- approved versus inferred data

## Phase 2 — Production Graph alpha

- scene breakdown
- cast/location/prop/wardrobe requirements
- production notes
- production profiles
- manual approval

## Phase 3 — Scene Compiler alpha

- provider-neutral scene package
- deterministic versioning
- downloadable JSON/Markdown package
- prompt-copy workflow
- reference bundle export

## Phase 4 — First provider adapters

Choose adapters based on:

- user demand
- stable API/export path
- reference support
- cost transparency
- legal and privacy review

Start with export-first workflows before direct submission.

## Phase 5 — Asset lineage and review

- generation jobs
- imported results
- asset versions
- approvals
- cost tracking
- continuity comparison

## Phase 6 — Creator production profile

- YouTube/narrative creator package
- A-roll/B-roll
- shot checklist
- generator package
- release workflow

## Phase 7 — Editorial and production governance

- senior-editor review
- approval gates
- production lock
- department readiness
- audit trail

## Phase 8 — Cinematography and locations

- visual brief
- shot plan
- location brief
- strategy comparison
- current-data integrations

## Phase 9 — Series and studio operations

- series graph
- episode inheritance
- canon protection
- writer alignment
- department dashboards
- enterprise controls

---

# 22. Acceptance principles

A production feature is not complete because a page renders.

## Scene Compiler acceptance

A user can:

1. select an approved scene and draft snapshot
2. select a production profile
3. compile a provider-neutral package
4. inspect every included fact and reference
5. see warnings for missing or inferred data
6. download/copy the package
7. reproduce the same package from the same version

## Adapter acceptance

A user can:

1. see provider capabilities and limitations
2. compile without changing canon
3. inspect the exact outgoing request
4. estimate or understand cost
5. submit or export intentionally
6. import or track the result
7. preserve provider/model/version provenance

## Character continuity acceptance

Across two sequential scenes:

- the same approved character state is used
- deliberate state changes are represented
- accidental drift is flagged
- the user can approve a new reference without erasing the prior one

## Editorial acceptance

A senior editor can:

- receive a review assignment
- compare the correct draft
- redline or suggest changes
- request revisions
- approve a version
- lock it for production
- preserve authorship and audit history

## Creator acceptance

A creator can move from script to a usable production package without learning every provider's prompt dialect.

---

# 23. Anti-patterns

Do not:

- build a separate story database for every department
- make provider prompts the canonical data model
- hardcode one provider into scene entities
- send entire private projects when only one scene is needed
- silently promote generated output to canon
- silently spend generation credits
- overwrite approved assets
- hide provider/model/version provenance
- create one-click production that bypasses review
- expose every studio department in the main navigation
- let production analysis interfere with typing
- claim precise budgets without evidence
- recommend real locations from stale unsourced data
- build direct APIs before provider-neutral export packages exist
- create AI department personas that merely chat without producing governed project artifacts

---

# 24. Decision filter for future features

Before adding a production feature, answer:

1. Which canonical story or production entities does it use?
2. What governed artifact does it produce?
3. Is the artifact versioned and traceable?
4. Does it preserve authorship and approval?
5. Is it provider-neutral at the core?
6. Can it begin as export-first?
7. Does it support at least one real end-to-end workflow?
8. Does it preserve the local-first editor?
9. Does it create reusable data rather than a disconnected panel?
10. Does it help a creator move closer to a finished production?

If those answers are unclear, the feature is not ready.

---

# 25. Relationship to the Intelligence Platform

The two canonical doctrines must work together.

`SCENESMITH_INTELLIGENCE_PLATFORM_VISION.md` defines:

- Guide
- Coach
- Review
- Continuity
- ITS
- PfHU
- TMH
- Character Truth
- The Message Profile
- evidence-backed story intelligence

This document defines:

- Story Graph
- Production Graph
- Scene Compiler
- provider adapters
- department workflows
- production profiles
- asset lineage
- approval and delivery

Together:

```text
SceneSmith Intelligence understands the story.
SceneSmith Production translates that understanding into action.
```

---

# 26. Long-term north star

A creator should eventually be able to say:

```text
I wrote this story in SceneSmith.
SceneSmith helped me understand it.
SceneSmith helped my team improve and approve it.
SceneSmith preserved the characters, world, and message.
SceneSmith translated it into the production tools we chose.
SceneSmith helped us produce it without losing what made the story ours.
```

That is the long-term product.

Not a model wrapper.

Not a one-click movie gimmick.

Not a collection of disconnected studio-themed pages.

A durable operating system for taking meaningful stories from the page into the world.
