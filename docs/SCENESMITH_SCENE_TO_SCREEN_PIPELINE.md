# SceneSmith Scene-to-Screen Pipeline

## Status

Canonical long-term product doctrine and implementation compass for parsing stories into structured scenes, compiling scenes into shot and media packages, generating consistent visual and audio assets through replaceable providers, assembling those assets into reviewable sequences, and exporting creator videos, animatics, previs, trailers, shorts, or films.

This document extends:

- `AGENTS.md`
- `docs/SCENESMITH_STORY_PRODUCTION_PLATFORM.md`
- `docs/SCENESMITH_WORLD_BUILDING.md`
- `docs/SCENESMITH_EPIC_FANTASY_UNIVERSE_PLATFORM.md`
- `docs/SCENESMITH_AUDIOBOOK_TABLE_READ_STUDIO.md`
- `docs/SCENESMITH_VOICE_STUDIO.md`
- `docs/CHARACTER_TRUTH_ENGINE.md`

It exists to prevent Scene-to-Screen work from drifting into:

- one giant prompt sent to one video model
- generating scenes before screenplay parsing is reliable
- inconsistent characters, locations, wardrobe, props, or voices
- provider-specific story data
- expensive generation with no estimate or budget guardrail
- assets disconnected from source draft and canon
- silent replacement of approved work
- a pile of clips with no editing or continuity model
- a claim that SceneSmith produced a film when it only generated isolated shots

This is not a request to implement the complete pipeline in one pass.

---

# 1. Executive thesis

SceneSmith should be able to transform an approved script, chapter, skit, or creator-video segment into a structured production sequence.

The canonical pipeline is:

```text
approved story source
→ deterministic parsing
→ Story Graph scene state
→ Production Graph breakdown
→ Scene Compiler package
→ shot design
→ character / world reference resolution
→ provider-specific generation jobs
→ image, video, voice, sound, and music assets
→ review and continuity checks
→ timeline assembly
→ human approval
→ export
```

The central promise is:

> SceneSmith understands the scene before it asks a generator to visualize it.

The difficult part is not calling a video API.

The difficult part is maintaining:

- story meaning
- character identity
- location identity
- temporal state
- performance intent
- shot continuity
- audio continuity
- cost control
- asset lineage
- editability

---

# 2. Product outputs

Scene-to-Screen should support progressive levels of output.

```text
STORYBOARD
SHOT BOARD
ANIMATIC
PREVIS
CREATOR VIDEO
SOCIAL SHORT
TRAILER / TEASER
AUDIO-VISUAL BOOK COMPANION
AI-NATIVE SHORT
HYBRID FILM PACKAGE
FINAL FILM ASSEMBLY
```

The system must label the maturity of an output honestly.

A generated clip collection is not automatically a completed film.

---

# 3. Source formats

The source adapter may parse:

- screenplay
- teleplay
- skit
- stage play
- novel chapter
- short story
- YouTube script
- audio drama
- documentary outline
- interactive scene

Each source format maps into a shared scene and beat model without losing its original structure.

---

# 4. Parsing screenplay scenes and dialogue

## 4.1 Screenplay elements

The parser should recognize:

- scene heading
- action
- character cue
- dialogue
- parenthetical
- transition
- shot
- note
- montage
- intercut
- dual dialogue
- voice-over
- off-screen dialogue
- continued dialogue

## 4.2 Scene boundaries

A scene should retain:

- source block IDs
- scene number
- heading
- interior / exterior
- location
- time of day
- story date
- characters present
- entrances and exits
- action beats
- dialogue turns
- props
- wardrobe
- vehicles
- creatures
- emotional state
- knowledge state
- continuity in
- continuity out

## 4.3 Dialogue model

```ts
type DialogueTurn = {
  id: string;
  sourceBlockId: string;
  sceneId: string;
  characterId?: string;
  speakerLabel: string;
  delivery?: unknown;
  text: string;
  isVoiceOver?: boolean;
  isOffScreen?: boolean;
  overlapsWith?: string[];
  storyTime?: unknown;
};
```

## 4.4 Action beat model

Action paragraphs should be divided only when useful into:

- physical action
- reaction
- reveal
- environment change
- entrance
- exit
- prop interaction
- visual transition
- effect
- stunt

The original text remains authoritative.

Parsed beats are structured interpretations and must remain traceable to source blocks.

## 4.5 Parse confidence

Low-confidence parsing should create a review item rather than a false scene fact.

---

# 5. Scene Graph and scene state

Each scene should have a time-specific state snapshot.

```text
scene identity
story time
location state
characters present
character appearance
wardrobe
injuries
possessions
relationships
knowledge
emotional state
world state
weather
lighting conditions
props
vehicles
creatures
continuity requirements
```

Character and location state must be resolved from approved canon, not improvised independently for every clip.

---

# 6. Production breakdown

The Production Graph should derive or propose:

- cast
- background performers
- location
- set
- wardrobe
- hair and makeup
- props
- vehicles
- creatures
- practical effects
- visual effects
- stunt needs
- sound
- music
- lighting
- camera
- safety
- rights
- schedule
- budget drivers

The user may choose a production profile:

```text
Storyboard only
Animatic
YouTube creator
Social short
Independent live action
AI-native video
Hybrid live action + generated media
Animation
Studio feature
```

The production profile changes the plan, not the story canon.

---

# 7. Scene Compiler

The Scene Compiler must produce a versioned provider-neutral package.

```ts
type SceneToScreenPackage = {
  packageVersion: string;
  projectId: string;
  draftSnapshotId: string;
  sceneId: string;
  continuityBranchId?: string;
  productionProfile: string;
  sourceBlockIds: string[];
  sceneSummary: string;
  dramaticPurpose: string;
  storyTime?: unknown;
  locationState: unknown;
  characters: unknown[];
  relationshipStates: unknown[];
  characterKnowledge: unknown[];
  actionBeats: unknown[];
  dialogueTurns: DialogueTurn[];
  wardrobe: unknown[];
  props: unknown[];
  visualIntent?: unknown;
  cameraIntent?: unknown;
  soundIntent?: unknown;
  constraints: unknown[];
  approvedReferences: unknown[];
  prohibitedAssumptions: unknown[];
  approvals: unknown[];
};
```

Given the same source snapshot, canon snapshot, compiler version, and profile, the package should be reproducible.

---

# 8. Shot planning

## 8.1 Scene is not shot

A scene may require one or many shots.

Do not ask a video provider to invent the complete coverage plan unless the user explicitly requests a proposed shot plan.

## 8.2 Shot model

```text
shot number
scene ID
source beat IDs
shot purpose
shot size
angle
camera movement
lens intention
composition
subjects
blocking
start state
end state
duration target
dialogue range
audio requirement
reference assets
continuity requirements
provider constraints
status
```

## 8.3 Coverage

Possible coverage:

- master
- wide
- medium
- close-up
- insert
- cutaway
- over-the-shoulder
- POV
- tracking
- establishing
- aerial
- reaction
- montage element

## 8.4 Shot design workflow

```text
scene package
→ proposed coverage
→ user edits
→ continuity validation
→ budget estimate
→ shot approval
→ generation
```

## 8.5 Dialogue segmentation

For generated video, dialogue may need to be split into short, editable shot ranges.

SceneSmith should retain the relationship between:

- original dialogue turn
- audio segment
- shot
- lip-sync asset
- subtitle cue

---

# 9. Character consistency

## 9.1 Canonical character references

Use approved:

- portrait
- full-body reference
- profile views
- age presentation
- body proportions
- hair
- distinctive features
- wardrobe state
- injuries
- props
- expression range
- voice role

## 9.2 Character reference package

```text
identity anchors
approved visual assets
negative identity constraints
current wardrobe
current condition
performance state
source canon snapshot
```

## 9.3 Consistency rules

- generated candidates do not become canon automatically
- each asset retains reference lineage
- provider-specific reference tokens are adapter metadata
- a provider change must not redefine the character
- scene-specific appearance must use temporal state

## 9.4 Identity drift detection

SceneSmith may compare:

- face
- hair
- body
- clothing
- age
- marks
- carried items

Detection is advisory and should support human approval.

---

# 10. Location and world consistency

## 10.1 Location reference package

Use approved:

- location identity
- era
- political control
- architecture
- materials
- geography
- weather
- damage state
- lighting context
- interior relationships
- map position
- approved visual references

## 10.2 Spatial continuity

Track:

- entrances
- exits
- screen direction
- object positions
- character positions
- room geography
- travel between locations

## 10.3 World rules

The package may include:

- gravity
- atmosphere
- magic effects
- technology limits
- cultural visual rules
- species constraints
- time-of-day behavior

Generated visuals must not silently violate approved world rules.

---

# 11. Performance and voice

## 11.1 Performance package

Use approved or scene-specific:

- objective
- obstacle
- emotional state
- relationship pressure
- deception
- confidence
- physical condition
- subtext
- dialogue
- performance direction

## 11.2 Audio generation

Audio should be generated through `docs/SCENESMITH_AUDIOBOOK_TABLE_READ_STUDIO.md` contracts.

Dialogue assets must retain:

- source dialogue turn
- character voice role
- pronunciation profile
- performance settings
- provider lineage
- approval

## 11.3 Lip sync

Lip-sync jobs must link:

- approved video or image input
- approved dialogue audio
- character
- language
- source line
- provider
- settings
- output asset

## 11.4 Human performance

The system must also support uploaded human performances.

Generated media is one production strategy, not the only strategy.

---

# 12. Image and video generation

## 12.1 Provider adapters

Adapters may support current or future:

- text-to-image
- image-to-image
- text-to-video
- image-to-video
- video-to-video
- character reference
- style reference
- camera control
- motion control
- lip sync
- inpainting
- outpainting
- upscaling

The provider adapter translates SceneSmith packages. It does not own story logic.

## 12.2 Capability negotiation

Before submission, the adapter should report:

- supported duration
- aspect ratios
- reference limits
- resolution
- audio support
- character consistency support
- camera controls
- estimated cost
- expected latency
- content restrictions

## 12.3 Generation strategies

A shot may use:

- text-to-video
- approved keyframe to video
- approved character and location references
- video-to-video
- uploaded live action
- animation
- still image with camera motion
- hybrid composite

## 12.4 Keyframe-first strategy

For consistency, SceneSmith should often prefer:

```text
approved shot brief
→ image candidates
→ approved keyframe
→ image-to-video
```

This is a strategy, not a permanent rule.

## 12.5 Short-clip design

The pipeline should expect shots and clips to be short and assembled later.

Do not design canonical data around one provider’s current duration limit.

---

# 13. Asset lifecycle

```text
DRAFT
QUEUED
GENERATING
READY_FOR_REVIEW
REVISION_REQUESTED
APPROVED_REFERENCE
APPROVED_SHOT
APPROVED_AUDIO
APPROVED_SEQUENCE
SUPERSEDED
ARCHIVED
FAILED
CANCELED
```

Every asset should answer:

- source project
- draft snapshot
- scene
- shot
- source blocks
- character and location states
- provider
- model
- prompt package
- settings
- seed or reference IDs
- cost
- requester
- approver
- replacement

Use durable storage paths.

---

# 14. Generation job and error states

```text
VALIDATING
ESTIMATING
AWAITING_CONFIRMATION
RESERVING_CREDITS
QUEUED
RUNNING
PROCESSING
READY
RETRYABLE_FAILURE
PROVIDER_RATE_LIMITED
PROVIDER_UNAVAILABLE
INSUFFICIENT_CREDITS
INVALID_PACKAGE
CONTENT_BLOCKED
CANCELED
```

Rate limits, user credits, invalid inputs, and provider outages must remain separate.

A failed provider call must not create a false approved asset or duplicate charge.

---

# 15. Cost and budget control

Before generation, show:

- number of shots
- expected durations
- selected providers
- quality tier
- estimated credits
- estimated provider cost
- budget cap
- expected variance

## 15.1 Budget modes

```text
Preview
Economy
Standard
High Quality
Custom Cap
```

## 15.2 Reservation and settlement

Use the same principles as audio:

```text
estimate
→ confirm
→ reserve
→ generate
→ settle actual cost
→ release unused credits
```

## 15.3 Generation alternatives

SceneSmith may compare:

- storyboard only
- still-image animatic
- low-cost video
- premium video
- live-action plan
- hybrid plan

Do not assume the most expensive generation path is the best choice.

---

# 16. Timeline assembly and editing

Generating clips is not enough.

SceneSmith needs a lightweight editorial timeline or exportable edit model.

## 16.1 Sequence model

```text
video clip
image clip
audio dialogue
narration
ambience
sound effect
music
transition
caption
title
credit
```

## 16.2 Edit decision model

```text
sequence ID
track
asset ID
source in
source out
timeline in
timeline out
transition
volume
crop
speed
caption cue
status
```

## 16.3 Assembly workflow

```text
approved shots
→ rough assembly
→ audio placement
→ dialogue sync
→ captions
→ ambience and sound
→ music placeholders or licensed music
→ review
→ revision
→ approved sequence
→ export
```

## 16.4 External editors

SceneSmith may export project packages or edit-decision data to external editing systems through adapters.

It should not require SceneSmith to replace every professional NLE.

---

# 17. Sound, music, and captions

## 17.1 Sound layers

- production dialogue
- generated dialogue
- narration
- ambience
- effects
- Foley
- music
- room tone

## 17.2 Music rights

Music must retain license and usage metadata.

Do not generate or imitate a named living composer’s style.

## 17.3 Captions and subtitles

Captions should derive from approved audio and source dialogue.

Support:

- source language
- translated language
- speaker labels
- timing
- forced narrative text
- accessible descriptions where needed

---

# 18. Creator and YouTube workflows

## 18.1 Narrative YouTube video

```text
script
→ segments
→ narration
→ character / world visuals
→ B-roll and short clips
→ captions
→ music
→ assembly
→ export
```

## 18.2 Review or video essay

Use approved Review Intelligence outputs:

- claim cards
- evidence visuals
- source references
- timeline graphics
- character and world diagrams
- narration
- lower thirds
- captions

## 18.3 Illustrated audiobook companion

Combine:

- audiobook narration
- approved character images
- location images
- maps
- artifacts
- slow camera movement
- chapter titles
- subtitles

## 18.4 Consistency

The same approved Character and World assets should flow into:

- pitch deck
- audiobook cover or companion
- YouTube video
- trailer
- scene generation
- production reference

---

# 19. Film and long-form production

Long-form film generation must be treated as a sequence of governed shots and scenes.

The platform should support:

- draft snapshots
- production locks
- scene readiness
- shot readiness
- missing references
- cost plan
- asset approvals
- sequence status
- continuity reports
- delivery packages

A feature-length output is a production program, not one generation job.

---

# 20. Rights, safety, and identity

Require rights for:

- script
- characters
- imported images
- actor likeness
- voices
- music
- footage
- brands and marks

Do not enable unauthorized cloning of real actors or performers.

Generated characters based on approved fictional references must remain distinct from real people unless the user has appropriate rights and consent.

---

# 21. Data model

```text
production_scenes
- id
- project_id
- draft_snapshot_id
- source_scene_id
- production_profile
- compiler_version
- status

production_beats
- id
- production_scene_id
- source_block_ids
- beat_type
- sequence
- payload_json

production_shots
- id
- production_scene_id
- shot_number
- source_beat_ids
- shot_brief_json
- duration_target
- status
- approved_by

production_reference_packages
- id
- shot_id
- character_state_ids
- location_state_ids
- wardrobe_ids
- prop_ids
- world_rule_ids
- asset_ids
- canon_snapshot_id

production_generation_jobs
- id
- shot_id
- media_type
- provider
- model
- adapter_version
- status
- idempotency_key
- request_json
- estimate_json
- reserved_credits
- settled_credits
- provider_cost
- error_code

production_assets
- id
- job_id
- scene_id
- shot_id
- asset_type
- storage_path
- duration_ms
- source_lineage_json
- status
- approved_by
- supersedes_id

production_sequences
- id
- project_id
- sequence_type
- timeline_json
- status
- output_asset_id

production_usage_ledger
- id
- user_id
- project_id
- job_id
- provider_cost
- credits
- adjustment
- margin
```

---

# 22. Implementation sequence

## Phase 0 — Audit and contracts

- screenplay parser
- scenes and blocks
- Story Graph
- characters
- locations
- portraits
- storyboard
- table read
- credits
- storage
- provider adapters
- export

## Phase 1 — Deterministic scene parsing

- scene boundaries
- dialogue turns
- action beats
- source lineage
- parser review

## Phase 2 — Scene breakdown

- cast
- location
- props
- wardrobe
- temporal state
- continuity in / out

## Phase 3 — Shot planning

- coverage proposals
- user editing
- shot model
- budget estimate

## Phase 4 — Storyboard and keyframes

- approved character / location references
- image adapter
- candidate review
- shot boards

## Phase 5 — Short video clips

- provider adapters
- job queue
- cost reservation
- short clip generation
- retry
- approval

## Phase 6 — Dialogue and lip sync

- audio roles
- dialogue segments
- lip-sync jobs
- subtitles

## Phase 7 — Sequence assembly

- timeline
- video
- dialogue
- narration
- captions
- rough export

## Phase 8 — Creator outputs

- YouTube narrative
- review video
- illustrated reading
- social short
- trailer

## Phase 9 — Long-form production operations

- scene readiness
- production locks
- asset queues
- cost planning
- collaboration
- delivery

---

# 23. Acceptance tests

## 23.1 Screenplay parsing

Parse a scene with action, two characters, parentheticals, voice-over, and an exit.

Expected:

- correct source lineage
- dialogue turns
- action beats
- characters present
- no text mutation

## 23.2 Canonical character consistency

Generate three shots of one character.

Expected:

- same approved reference package
- temporal wardrobe state
- asset lineage
- drift review
- no auto-approval

## 23.3 Location state

Generate a city before and after destruction.

Expected:

- correct story-time state
- distinct reference packages
- same location identity

## 23.4 Dialogue

Generate a dialogue shot.

Expected:

- source line linked
- approved voice role
- audio asset
- lip-sync asset
- subtitle cue

## 23.5 Provider rate limit

Expected:

- job saved
- correct rate-limit state
- no top-up prompt unless credits are the issue
- no duplicate charge

## 23.6 Partial scene

One shot fails.

Expected:

- successful shots remain
- failed shot retry only
- sequence reflects missing status

## 23.7 Script revision

Change a source line after generation.

Expected:

- affected audio and shots marked stale
- unrelated assets remain valid
- impact report

## 23.8 Budget cap

Generation plan exceeds user cap.

Expected:

- no submission
- lower-cost alternatives
- user confirmation required

## 23.9 Adaptation profile

Compile the same scene for storyboard, YouTube, and AI-native short.

Expected:

- story remains the same
- output packages differ by production profile

## 23.10 Rights

Use an unapproved real-person likeness or voice.

Expected:

- blocked or appropriate rights workflow

## 23.11 Export

Assemble an approved short sequence.

Expected:

- clips, audio, captions, and lineage included
- output version recorded

---

# 24. Do not build

Do not build:

- script text directly to one giant video prompt
- a provider-specific Story Graph
- automatic shot approval
- temporary URLs as asset identity
- character generation without approved references
- location generation without story-time state
- unmetered generation
- silent retries or duplicate billing
- a pile of clips with no sequence model
- a “make film” button that hides cost and missing prerequisites
- unauthorized actor or voice cloning
- a claim of final-film readiness without audio, edit, continuity, and approval workflows

---

# 25. Final doctrine

```text
Parse before producing.
Resolve story state before visual state.
Compile scenes into shots, not one giant prompt.
Keep Character and World canon provider-neutral.
Generate short, reviewable assets.
Track every source, setting, cost, and approval.
Retry only what failed.
Separate provider failure from user credit limits.
Assemble assets into editable sequences.
Support human, generated, and hybrid production.
Keep the screenplay and Story Graph authoritative.
```

SceneSmith Scene-to-Screen succeeds when one approved scene can become a consistent storyboard, animatic, creator video, or governed production sequence without losing character identity, world truth, source lineage, cost control, or human authorship.