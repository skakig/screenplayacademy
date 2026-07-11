# SceneSmith Audiobook & Table Read Studio

## Status

Canonical long-term product doctrine and implementation compass for table reads, live manuscript readings, audiobook creation, audio drama, voice previews, narration, character voice casting, pronunciation control, cost recovery, export, and provider-failure handling.

This document extends:

- `AGENTS.md`
- `docs/SCENESMITH_VOICE_STUDIO.md`
- `docs/SCENESMITH_STORY_PRODUCTION_PLATFORM.md`
- `docs/SCENESMITH_EPIC_FANTASY_UNIVERSE_PLATFORM.md`
- `docs/CHARACTER_TRUTH_ENGINE.md`
- `docs/SCENESMITH_WORLD_BUILDING.md`

It exists to prevent audio work from drifting into:

- a one-button text-to-speech demo
- an ElevenLabs-specific data model
- silent failures
- misleading “top up” prompts during provider outages
- double charging on retries
- unmetered API spending
- unauthorized voice cloning
- audio files disconnected from script, character, chapter, or approval lineage
- a table-read tool that cannot become a professional audiobook workflow

This is not a request to implement the complete platform in one pass.

---

# 1. Executive thesis

SceneSmith should evolve from table read into a complete story-audio production environment.

The platform should help a creator move from:

```text
approved screenplay or manuscript
→ parsed narration and dialogue
→ voice casting
→ pronunciation and performance direction
→ cost estimate and credit reservation
→ provider-neutral generation jobs
→ preview and review
→ chapter / scene assembly
→ mastering
→ export
```

The same foundation should support:

- quick character voice previews
- screenplay table reads
- live manuscript readings
- audiobook drafts
- production audiobooks
- audio drama
- podcast fiction
- creator-video narration
- accessibility playback
- multilingual editions

The central promise is:

> SceneSmith preserves the story structure, casts consistent voices, generates audio transparently, recovers gracefully from failures, and lets the creator understand and control cost before publishing or exporting anything.

---

# 2. Provider neutrality

ElevenLabs may be an early or preferred provider, but it must not define the canonical schema.

Use replaceable adapters for:

- text to speech
- voice previews
- voice design
- speech-to-speech
- narration
- dubbing
- pronunciation dictionaries
- audio cleanup
- mastering
- diarization
- translation

Canonical SceneSmith data should preserve:

- voice role
- character association
- performance direction
- pronunciation
- source text
- provider-independent settings
- generation history
- approval status
- cost
- durable asset path

Provider-specific IDs belong in adapter metadata.

---

# 3. Operating modes

```text
VOICE PREVIEW
TABLE READ
LIVE MANUSCRIPT READING
AUDIOBOOK
AUDIO DRAMA
CREATOR NARRATION
DUB / LOCALIZATION
ACCESSIBILITY PLAYBACK
```

## 3.1 Voice Preview

Generate a short approved sample for:

- character
- narrator
- host
- announcer
- creature or synthetic voice

Preview text should be short, representative, and cached when unchanged.

## 3.2 Table Read

Generate or perform a script read with:

- narrator or scene-direction voice
- character voices
- line order
- pauses
- parentheticals
- scene headings
- stage directions
- optional sound cues

## 3.3 Live Manuscript Reading

Allow a user to listen to a novel or manuscript while editing.

Features may include:

- chapter selection
- follow-along highlighting
- pause and resume
- playback speed
- pronunciation correction
- regenerate selected paragraph
- bookmark issue
- create revision note from playback position

## 3.4 Audiobook

Produce a chaptered audio publication with:

- narrator casting
- multi-character voices when desired
- performance direction
- pronunciation lexicon
- chapter markers
- pickups
- mastering
- credits and metadata
- export packages

## 3.5 Audio Drama

Support:

- full cast
- sound cues
- ambience
- music placeholders or licensed assets
- spatial staging
- scene assembly
- dialogue timing

## 3.6 Creator Narration

Generate narration for:

- YouTube
- video essays
- trailers
- explainers
- social video
- pitch materials

---

# 4. Source parsing

SceneSmith should parse approved story structure into audio units.

## 4.1 Screenplay

- scene heading
- action / narration
- character cue
- parenthetical
- dialogue
- transition
- notes excluded unless explicitly included

## 4.2 Novel / manuscript

- book
- part
- chapter
- scene break
- narration
- quoted dialogue
- internal thought
- epigraph
- footnote

## 4.3 Audio unit

```ts
type AudioScriptUnit = {
  id: string;
  sourceType: "screenplay_block" | "paragraph" | "chapter_heading" | "manual";
  sourceId: string;
  sequence: number;
  speakerRole: "narrator" | "character" | "host" | "direction" | "sound";
  characterId?: string;
  text: string;
  language: string;
  pronunciationProfileId?: string;
  performanceDirection?: unknown;
  excluded?: boolean;
};
```

Source edits must mark generated audio stale rather than silently mismatching the text.

---

# 5. Voice casting

## 5.1 Voice role

A canonical voice role should include:

- display name
- role type
- character or narrator association
- language
- accent notes
- age presentation
- vocal range
- pace
- energy
- texture
- emotional range
- provider-neutral voice description
- approved sample
- provider mappings
- rights and consent status

## 5.2 Voice casting workflow

```text
character / narrator brief
→ provider-neutral criteria
→ candidate previews
→ comparison
→ human approval
→ canonical voice role
→ provider mapping
```

## 5.3 Character Truth integration

Voice direction may use approved:

- emotional state
- relationship state
- immediate objective
- stress level
- confidence
- deception
- public versus private behavior

It must not infer protected traits from psychology or appearance.

## 5.4 Voice consistency

SceneSmith should preserve:

- provider voice ID mapping
- settings version
- voice sample
- pronunciation profile
- performance baseline
- approved deviations

If a provider removes or changes a voice, SceneSmith should show a replacement workflow rather than silently substituting.

---

# 6. Pronunciation and language

## 6.1 Pronunciation lexicon

Support:

- character names
- locations
- invented languages
- titles
- artifacts
- acronyms
- foreign words
- numbers and dates

Each entry may include:

- source spelling
- phonetic spelling
- IPA
- provider-specific pronunciation hint
- language
- audio sample
- project scope
- universe scope
- approval

## 6.2 Read-aloud proofing

A pronunciation correction should be reusable across:

- previews
- table reads
- audiobook chapters
- creator narration
- localization

## 6.3 Multilingual editions

Preserve:

- source text
- translated text
- translator or model provenance
- approved pronunciation
- voice mapping by language
- edition-specific audio

---

# 7. Performance direction

Performance direction must remain structured and reviewable.

Possible dimensions:

- pace
- volume
- energy
- emotional state
- intimacy
- urgency
- hesitation
- sarcasm
- authority
- exhaustion
- secrecy
- breath
- pause
- emphasis

Do not store one provider’s markup as canonical performance data.

Adapters may transform SceneSmith direction into provider-specific controls.

Parentheticals are evidence, not the only performance source.

---

# 8. Generation job state machine

Every audio operation must have a clear state.

```text
DRAFT
VALIDATING
ESTIMATING_COST
AWAITING_CONFIRMATION
RESERVING_CREDITS
QUEUED
GENERATING
PROCESSING
READY_FOR_REVIEW
APPROVED
RETRYABLE_FAILURE
USER_RATE_LIMITED
PROVIDER_RATE_LIMITED
PROVIDER_UNAVAILABLE
INSUFFICIENT_CREDITS
INVALID_INPUT
RIGHTS_BLOCKED
CANCELED
SUPERSEDED
```

## 8.1 Why states must remain distinct

The user must not receive the same message for:

- no user credits
- application-level usage cap
- provider account rate limit
- provider-wide outage
- invalid voice ID
- rejected text
- network timeout
- internal bug

Only the first two may justify a **Top Up Credits** action.

A provider-wide rate limit or outage should offer:

- Retry later
- Keep queued
- Switch provider when available
- Save work and continue elsewhere

Do not charge the user to solve a provider failure.

---

# 9. Error and retry UX

## 9.1 Voice preview failure

Example UI:

```text
Voice preview could not be generated.
Your character and voice settings are safe.

Reason: Provider request timed out.
[Retry Preview] [Choose Another Voice] [View Details]
```

## 9.2 User credit exhaustion

```text
You need approximately 420 more credits to generate this chapter.
No generation has started and no credits were charged.

[Top Up Credits] [Generate a Short Preview] [Cancel]
```

## 9.3 User plan or minute limit

```text
Your included audio minutes have been used.
Top up generation credits or wait until your plan renews.

[Top Up Credits] [View Usage] [Save for Later]
```

## 9.4 Provider rate limit

```text
The voice provider is temporarily rate-limiting requests.
Your job is saved. No additional charge will occur.

[Retry Now] [Keep Queued] [Notify Me When Ready]
```

Do not display **Top Up Credits** unless user funds are actually the blocking condition.

## 9.5 Provider outage

```text
Audio generation is temporarily unavailable from this provider.
Your script, casting, and generation settings are safe.

[Try Another Provider] [Save Job] [Check Again]
```

## 9.6 Partial chapter failure

The user should be able to regenerate only failed segments.

Do not regenerate an entire chapter when four lines failed.

## 9.7 Detailed error record

Store:

- normalized error code
- provider error category
- provider request ID
- retry eligibility
- retry count
- user message
- internal diagnostic message
- billable status
- credit adjustment
- timestamp

Never expose provider secrets or raw sensitive payloads to the user.

---

# 10. Billing and credit architecture

## 10.1 Cost estimate

Before generation, show:

- estimated characters or duration
- quality tier
- provider
- estimated SceneSmith credits
- included allowance used
- expected remaining balance
- possible variance

## 10.2 Credit reservation

Use:

```text
estimate
→ user confirms
→ reserve maximum expected credits
→ generate
→ settle actual cost
→ release unused reservation
```

## 10.3 Failure billing

- validation failure: no charge
- insufficient credits: no charge
- provider rejection before processing: no charge
- provider failure eligible for refund: release reservation
- completed generation: settle actual cost
- duplicate callback: no duplicate charge
- user-requested successful alternate: new charge with confirmation

## 10.4 Idempotency

Every billable job must have an idempotency key.

Retrying the same failed request must not create duplicate charges or duplicate assets.

## 10.5 Cost ledger

Track:

- provider cost
- storage
- processing
- mastering
- transcription if applicable
- user credits charged
- refund or adjustment
- margin
- project
- chapter / scene
- user
- job

## 10.6 Monetization model

Possible structure:

### Free / Trial

- limited previews
- short table read
- low monthly allowance

### Creator

- table reads
- manuscript listening
- creator narration
- standard voices

### Pro

- audiobook projects
- multi-character casting
- pronunciation tools
- higher quality
- more storage
- chapter export

### Studio

- teams
- approvals
- multiple editions
- audio drama
- production mastering
- usage controls
- role permissions

Top-up packs should be understandable in practical terms such as approximate minutes at a selected quality tier.

---

# 11. Audiobook workflow

## 11.1 Project setup

- title
- author
- narrator
- edition
- language
- rights status
- book structure
- casting approach
- output specification

## 11.2 Casting approaches

```text
Single narrator
Narrator plus character voices
Full cast
Author narration
Hybrid human and generated voices
```

## 11.3 Chapter workflow

```text
chapter source locked
→ audio script parsed
→ pronunciation review
→ voice assignments
→ cost estimate
→ generate previews
→ generate chapter
→ segment review
→ pickups
→ assembly
→ mastering
→ chapter approval
```

## 11.4 Pickups

Regenerate selected:

- word
- sentence
- paragraph
- dialogue line
- segment

A pickup should preserve surrounding timing and allow comparison.

## 11.5 Assembly

Support:

- silence and pauses
- chapter headers
- credits
- intro and outro
- room tone
- optional ambience
- loudness normalization
- fade
- spacing

## 11.6 Export

Potential outputs:

- WAV masters
- MP3 chapters
- M4B with chapters
- stems by character
- narrator stem
- dialogue stem
- cue sheet
- transcript
- subtitles or captions
- pronunciation lexicon
- metadata package

Export specifications may vary by distributor; provider or distributor adapters should remain replaceable.

---

# 12. Table Read and live reading UX

## 12.1 Table Read controls

- cast
- play
- pause
- skip line
- regenerate line
- mute narrator
- playback speed
- follow script
- create note
- jump to scene

## 12.2 Live manuscript reading

The current paragraph should be highlighted without modifying the text.

Actions:

- Pause
- Replay paragraph
- Slower / faster
- Pronunciation issue
- Performance issue
- Create revision note
- Regenerate selected passage

## 12.3 Read state

Playback progress must be separate from canonical manuscript state.

## 12.4 Accessibility

- keyboard controls
- screen-reader labels
- captions
- visible generation states
- reduced-motion mode
- non-audio alternatives

---

# 13. Data model

```text
audio_projects
- id
- project_id
- audio_project_type
- title
- language
- edition
- status
- rights_status

audio_voice_roles
- id
- audio_project_id
- role_type
- character_id
- canonical_description_json
- approved_sample_asset_id
- rights_status

audio_provider_mappings
- id
- voice_role_id
- provider
- provider_voice_id
- settings_json
- status

audio_pronunciations
- id
- universe_id
- project_id
- term
- language
- ipa
- phonetic_hint
- provider_hints_json
- approved_by

audio_script_units
- id
- audio_project_id
- source_type
- source_id
- sequence
- speaker_role_id
- text
- direction_json
- source_hash

audio_generation_jobs
- id
- audio_project_id
- job_type
- status
- provider
- model
- idempotency_key
- estimate_json
- reserved_credits
- settled_credits
- provider_cost
- retry_count
- error_code
- created_by

audio_segments
- id
- job_id
- script_unit_ids
- storage_path
- duration_ms
- source_hash
- status
- approved_by

audio_assemblies
- id
- audio_project_id
- assembly_type
- timeline_json
- mastering_json
- status
- output_asset_id

audio_usage_ledger
- id
- user_id
- project_id
- job_id
- event_type
- provider_cost
- credits
- adjustment
- margin
```

Use durable storage paths, not expiring URLs, as canonical asset identity.

---

# 14. Rights, consent, and voice safety

SceneSmith must require appropriate rights for:

- manuscript
- screenplay
- voice
- performance
- music
- sound effects
- imported audio

Do not enable unauthorized voice cloning of real people.

For custom voices, preserve:

- consent
- owner
- permitted projects
- permitted uses
- expiration
- revocation
- geographic or platform restrictions where relevant

A revoked voice should not be used for new generation.

Existing approved assets should follow the applicable contract and deletion policy.

---

# 15. Integration with Character, World, and production intelligence

## 15.1 Characters

Use approved:

- voice role
- age presentation
- emotional state
- relationships
- knowledge
- pronunciation
- current condition

## 15.2 World Building

Use approved:

- names
- languages
- titles
- cultural pronunciation
- location ambience
- artifacts
- historical context

## 15.3 Story Graph

Use:

- scene order
- chapter order
- character cues
- dialogue
- narrator text
- beats
- emotional turns

## 15.4 Production Graph

Audio outputs may become:

- table-read package
- audiobook package
- audio-drama package
- video dialogue stem
- lip-sync source
- subtitle source
- production reference

---

# 16. Implementation sequence

## Phase 0 — Audit and contracts

- current table read
- current TTS integration
- provider adapters
- billing
- storage
- voice rights
- error states
- export

## Phase 1 — Reliable voice preview

- explicit state machine
- cost estimate
- retry
- rate-limit distinction
- credit top-up only when relevant
- durable preview asset
- no duplicate billing

## Phase 2 — Table Read reliability

- script parsing
- character casting
- line generation
- segment retry
- follow-along playback
- notes

## Phase 3 — Live manuscript reading

- chapter parsing
- narration
- follow-along
- pronunciation corrections
- revision-note capture

## Phase 4 — Audiobook project

- chapters
- narrator
- character voices
- pickups
- assembly
- export

## Phase 5 — Audio drama

- sound cues
- ambience
- multi-track assembly
- approvals

## Phase 6 — Localization and provider routing

- editions
- translation
- dubbing
- provider fallback
- quality and cost routing

---

# 17. Acceptance tests

## 17.1 Preview timeout

Expected:

- retryable error
- no lost settings
- no charge
- Retry action

## 17.2 User has insufficient credits

Expected:

- exact estimated shortage
- Top Up Credits
- no provider request
- no charge

## 17.3 Provider rate limit

Expected:

- Provider Rate Limited state
- job preserved
- no misleading top-up prompt
- retry or queue
- no duplicate charge

## 17.4 Provider outage

Expected:

- provider-unavailable state
- optional provider switch
- saved job
- no charge for failed attempt

## 17.5 Partial chapter failure

Expected:

- successful segments remain
- failed segments can be retried
- whole chapter not regenerated
- billing settles correctly

## 17.6 Source edit

Edit a paragraph after generating audio.

Expected:

- affected segment marked stale
- unchanged segments remain valid
- selective regeneration

## 17.7 Pronunciation

Correct an invented place name.

Expected:

- lexicon update
- regenerated preview uses correction
- future project audio reuses approved pronunciation

## 17.8 Duplicate callback

Provider sends completion twice.

Expected:

- one asset lifecycle event
- one settled charge

## 17.9 Export

Approve three chapters.

Expected:

- chaptered audio export
- metadata
- source and generation lineage
- only approved segments included

## 17.10 Voice rights

Attempt to use an unapproved cloned voice.

Expected:

- generation blocked
- rights requirement explained

---

# 18. Do not build

Do not build:

- one global Generate Audio button
- silent rate-limit failures
- Top Up Credits for provider outages
- retries that double charge
- full-chapter regeneration for one failed line
- provider voice IDs as canonical character identity
- expiring URLs as asset identity
- unauthorized voice cloning
- unmetered free generation
- audio disconnected from source hashes
- automatic publication without approval

---

# 19. Final doctrine

```text
Parse the story before generating audio.
Keep voice roles provider-neutral.
Show cost before generation.
Reserve, settle, and refund credits transparently.
Distinguish user limits from provider limits.
Preserve work through every failure.
Retry only what failed.
Keep pronunciation reusable.
Keep source and audio synchronized.
Protect voice rights and consent.
Build table read as the foundation of audiobook production.
```

SceneSmith Audiobook & Table Read Studio succeeds when a writer can preview one voice, listen to an entire manuscript, produce a polished audiobook, and recover from every provider or billing failure without losing work, trust, or control.