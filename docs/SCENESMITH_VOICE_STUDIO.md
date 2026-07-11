# SceneSmith Voice Studio

## Status

Canonical long-term product doctrine and implementation compass.

This document defines how SceneSmith Studio must capture spoken creative thought, understand its intent, translate it into project-appropriate story artifacts, and return every proposed change to the creator for review.

It exists to prevent Voice Studio from drifting into:

- a generic microphone button
- ordinary speech-to-text
- a chatbot that talks over the writer
- a screenplay-only formatter
- a provider-specific ElevenLabs feature
- an uncontrolled voice ghostwriter
- a disconnected transcript archive

This is not a request to build every capability in one pass.

Use it to guide product architecture, UX, data modeling, provider integration, pricing, privacy, and implementation sequence.

---

## Read first

Before implementing Voice Studio work, read:

1. `AGENTS.md`
2. `docs/SCENESMITH_INTELLIGENCE_PLATFORM_VISION.md`
3. `docs/SCENESMITH_STORY_PRODUCTION_PLATFORM.md`
4. `docs/SCENESMITH_ACADEMY.md`
5. `docs/CHARACTER_TRUTH_ENGINE.md`
6. the relevant editor, project-type, collaboration, privacy, database, and i18n documents

The Writer's Desk remains the center of gravity.

Voice Studio must never introduce network latency into typing, silently replace canonical work, or make spoken interpretation authoritative without human approval.

---

# 1. Executive thesis

SceneSmith Voice Studio is not merely dictation.

It is a spoken creative-development environment that helps a creator move from:

```text
spoken thought
→ preserved audio
→ faithful transcript
→ interpreted creative intent
→ structured story artifacts
→ human review
→ approved project changes
```

The central product promise is:

> Speak naturally. SceneSmith understands what kind of creative work you are doing, organizes it for the current project, and lets you decide what becomes part of the story.

Voice Studio must work across the full SceneSmith platform, including:

- feature screenplays
- television episodes and serialized shows
- short films and skits
- novels and novellas
- short stories
- YouTube scripts
- creator videos and sponsor segments
- podcasts and audio dramas
- stage plays
- stand-up and comedy material
- interactive stories and games
- worldbuilding and series bibles
- pitch development
- revision and editorial sessions
- production and writers' room notes

The screenplay formatter is one adapter.

It is not the entire Voice Studio product.

---

# 2. Product identity

Voice Studio should feel like a private creative room where the creator can:

- dictate finished prose or formatted script material
- talk through an unfinished idea
- brainstorm with an adaptive guide
- build a scene, chapter, sketch, episode, character, or world
- record revision notes while reading
- capture a writers' room conversation
- turn spoken production notes into organized work
- preserve the original thought before transforming it

Voice Studio is a cross-cutting platform capability, not a standalone novelty page.

It should be available contextually from:

- Writer's Desk
- Scene Board
- Scene Vault
- Characters / Character Bible
- Story Spine
- Academy guided paths
- Writers' Room
- Editorial Review
- Worldbuilding, when implemented
- Pitch and Producer tools
- mobile and tablet capture surfaces

The interface may expose a dedicated Voice Studio workspace, but the same engine must support embedded contextual entry points.

---

# 3. Prime directives

## 3.1 Preserve the original voice session

Every meaningful voice session must retain, subject to the user's retention settings:

- original audio
- raw transcript
- cleaned transcript
- timestamps
- speaker segments when applicable
- transcription confidence
- detected language
- project context
- active scene, chapter, character, or artifact context
- provider and model provenance
- interpretation runs
- proposed outputs
- accepted and rejected outputs

The creator must always be able to answer:

```text
What did I actually say?
What did SceneSmith infer?
What did I approve?
What changed in the project?
```

## 3.2 Spoken interpretation is proposed, not canonical

Voice Studio may:

- transcribe
- classify intent
- extract ideas
- organize notes
- suggest formatting
- draft story artifacts
- identify characters, locations, beats, questions, and revision tasks
- ask follow-up questions

Voice Studio must not:

- silently insert text into an approved draft
- silently create permanent canon
- overwrite a character, scene, chapter, world rule, or relationship
- convert uncertain speech into confident fact
- erase or replace the original transcript
- treat model output as the user's exact words

Every project-changing result must pass through an explicit review and approval action.

## 3.3 The editor remains local-first

Voice capture and transcription may use streaming services, but the live writing path remains independent.

Correct:

```text
user records
→ local audio buffer and visible recording state
→ streaming or uploaded transcription
→ proposed artifact
→ user approval
→ local editor insertion
→ background persistence
```

Never:

```text
user speaks
→ model call
→ database mutation
→ editor waits
```

Voice service failure must not block ordinary writing.

## 3.4 Provider neutrality is mandatory

ElevenLabs may be an early speech provider.

It must not define the canonical data model.

Voice Studio must use replaceable adapters for:

- speech-to-text
- speaker diarization
- language detection
- conversational voice agents
- text-to-speech playback
- translation
- audio cleanup
- future multimodal models

Conceptually:

```text
Voice Studio session
→ provider-neutral audio/transcript contract
→ selected provider adapter
→ normalized result
→ SceneSmith interpretation layer
```

Providers, models, APIs, prices, limits, and quality will change.

The user's creative archive must survive them.

---

# 4. Core operating modes

The mode must be chosen explicitly or confidently inferred and confirmed.

The user must always be able to change the mode before approving outputs.

## 4.1 Write by Voice

Purpose: speak material intended for the current draft.

Examples:

- screenplay scene headings, action, character cues, dialogue, parentheticals, and transitions
- novel prose and dialogue
- stage directions
- YouTube narration and beats
- skit dialogue
- podcast script copy

Two submodes are required:

### Command Dictation

The creator uses explicit commands:

```text
New scene.
Interior, apartment, night.
Action.
Anna stands by the window.
Character, Anna.
Dialogue.
I thought you were dead.
```

This mode prioritizes deterministic formatting.

### Natural Dictation

The creator speaks normally:

> Interior apartment at night. Anna stands by the window and says, “I thought you were dead.”

SceneSmith proposes the correct project-specific formatting.

Natural Dictation must always show the interpreted structure before insertion.

## 4.2 Voice Brainstorm

Purpose: think aloud without pretending the idea is finished.

The creator may ramble, contradict themselves, explore alternatives, or abandon a direction.

Voice Studio should organize the session into possible outputs such as:

- core idea
- scene or chapter concept
- character intention
- conflict
- reveal
- emotional turn
- thematic question
- possible dialogue
- continuity concern
- unresolved question
- alternate version
- next action

Available actions may include:

```text
Save as Brainstorm Note
Create Scene Card
Create Chapter Card
Send to Scene Vault
Create Character Proposal
Add Worldbuilding Proposal
Create Revision Task
Draft from This
Discard
```

No brainstorm interpretation becomes canon automatically.

## 4.3 Build a Scene, Chapter, Skit, or Segment

Purpose: guide the creator from an idea to a structured unit of story.

The guide adapts to project type.

Screenplay or skit prompts may ask:

- Where are we?
- Who enters the scene wanting what?
- What resistance appears?
- What changes before the scene ends?
- What image or line closes the beat?

Novel prompts may ask:

- Whose point of view controls the chapter?
- What does the viewpoint character notice first?
- What changes internally and externally?
- What information is withheld?
- What compels the reader into the next chapter?

YouTube prompts may ask:

- What is the hook?
- What promise is made to the viewer?
- What proof, demonstration, or escalation follows?
- Where does the sponsor integration belong?
- What is the retention reset?
- What is the call to action?

The resulting artifact remains a proposal until approved.

## 4.4 Character Interview and Character Development

Purpose: let the creator talk through a character rather than fill out a database form.

Voice Studio may:

- interview the creator about the character
- allow the creator to answer in the character's voice
- distinguish creator statements from in-character exploration
- extract proposed wants, fears, wounds, contradictions, voice cues, relationships, moral baselines, and arc possibilities
- identify conflicts with approved Character Bible canon

Outputs must enter the Character proposal lifecycle.

They must not overwrite canonical Character Bible fields silently.

## 4.5 Worldbuilding Session

Purpose: capture places, cultures, histories, rules, institutions, technologies, magic, geography, and lore.

Voice Studio should distinguish:

- loose idea
- proposed lore
- approved canon
- rumor or belief held by a character
- historical uncertainty
- production interpretation

A worldbuilding session may produce:

- world entry
- location entry
- institution
- timeline event
- cultural rule
- vocabulary or naming convention
- unresolved design question
- continuity warning

This mode must be designed now even if the full Worldbuilding workspace is implemented later.

## 4.6 Revision Notes

Purpose: let a writer, editor, director, or producer record observations while reading or reviewing.

Voice Studio may turn speech into:

- scene-level notes
- chapter-level notes
- dialogue revisions
- continuity issues
- editorial requests
- assignments
- approval conditions
- production concerns

Example:

> Scene eighteen is too slow. Hans should reveal less, and the telegram needs to appear before the midpoint.

Possible structured output:

```text
Revision task 1
Scene 18: reduce pace drag.

Revision task 2
Hans: conceal more information in Scene 18.

Continuity / structure note
Move telegram reveal before midpoint.
```

The reviewer must approve and assign each task.

## 4.7 Writers' Room and Meeting Capture

Purpose: preserve collaborative creative sessions and convert decisions into accountable work.

Capabilities may include:

- speaker identification
- agenda context
- decisions
- rejected alternatives
- open questions
- assignments
- approval records
- scene claims
- revision requests
- canonical decisions

A meeting transcript is not itself canon.

A decision must be promoted through the appropriate review or approval workflow.

All participants must receive clear recording notice and consent controls.

## 4.8 Production Voice Notes

Purpose: capture director, cinematography, location, casting, wardrobe, continuity, rehearsal, and production notes.

Outputs should map into the Production Graph when implemented.

Examples:

- shot idea
- blocking note
- location constraint
- prop requirement
- wardrobe continuity
- performance note
- sound cue
- pickup shot
- production risk

---

# 5. Project-type intelligence

Voice Studio must never force every creator through a screenplay-shaped parser.

Each project type requires a profile that defines:

- supported artifact types
- formatting rules
- vocabulary
- structural expectations
- available voice modes
- insertion destinations
- review actions
- canon rules

## 5.1 Screenplay and television

Possible outputs:

- scene heading
- action
- character cue
- dialogue
- parenthetical
- transition
- note
- scene card
- beat
- episode arc item
- revision task

## 5.2 Novel and prose fiction

Possible outputs:

- prose paragraph
- dialogue passage
- chapter card
- point-of-view note
- internal thought
- sensory detail
- plot beat
- character proposal
- worldbuilding proposal
- revision note

Voice Studio must not automatically flatten the author's prose voice into generic model prose.

## 5.3 Skit, short-form comedy, and stand-up

Possible outputs:

- premise
- setup
- escalation
- turn
- punchline
- callback
- character bit
- stage direction
- alternate tag
- performance note

The system should preserve timing, cadence, alternate jokes, and rejected variants.

## 5.4 YouTube and creator video

Possible outputs:

- title concept
- hook
- cold open
- segment
- narration
- demonstration
- B-roll note
- retention reset
- sponsor integration
- call to action
- thumbnail concept
- production task

## 5.5 Podcast and audio drama

Possible outputs:

- host copy
- interview question
- narration
- dialogue
- sound cue
- segment marker
- ad break
- episode note
- performance direction

## 5.6 Interactive story and game narrative

Possible outputs:

- scene
- branch
- choice
- state condition
- dialogue node
- quest beat
- lore entry
- character-state update

---

# 6. The Voice Studio user experience

## 6.1 Entry points

The microphone action must never be ambiguous.

Opening Voice Studio should first answer:

> What are we doing?

Recommended choices:

```text
Write by Voice
Brainstorm
Build a Scene / Chapter / Segment
Explore a Character
Build the World
Record Revision Notes
Capture a Writers' Room Session
Record Production Notes
```

Contextual entry points may preselect the likely mode.

Examples:

- from a screenplay block: Write by Voice
- from a character: Explore a Character
- from Scene Board: Build a Scene
- from Editorial Review: Revision Notes

The user can always change the mode.

## 6.2 Recording state

During recording, show:

- clear recording indicator
- elapsed time
- microphone source
- input level
- pause
- finish
- cancel
- live transcript when available
- connection/transcription status
- local buffering status
- privacy/retention indicator

Audio capture must survive temporary network loss through local buffering where platform capabilities permit.

## 6.3 Review state

After recording, present separate views:

```text
Audio
Raw Transcript
Clean Transcript
Interpretation
Proposed Artifacts
Project Changes
```

Do not collapse the transcript and model interpretation into one field.

The user must be able to:

- correct transcript errors
- replay the relevant audio segment
- change detected speaker
- change session mode
- re-run interpretation
- approve one artifact without approving all
- edit before insertion
- choose destination
- reject or archive outputs

## 6.4 Approval state

Every proposed project change must show:

- destination
- before state when applicable
- proposed after state
- source transcript excerpt
- confidence
- model/provider provenance
- approval action

For draft insertion, prefer a visible diff or staged insertion.

Actions may include:

```text
Insert
Replace Selection
Create New Scene
Create Chapter
Save to Vault
Save as Note
Accept as Canon
Create Suggestion
Create Revision Task
Discard
```

## 6.5 Conversational guide

The guide may ask one useful follow-up question at a time.

It must not conduct an endless interview.

Good:

> What does Stephan want from Hans in this scene?

> What changes when Hans refuses?

> Is the telegram a reveal to Stephan, the audience, or both?

Bad:

- generic encouragement
- five questions at once
- repeating known information
- inventing facts to keep the conversation moving
- converting every thought into prose

The Academy, ITS, and PfHU layers should control:

- explanation depth
- terminology
- number of follow-up questions
- examples
- repair prompts
- when to stop and return the user to writing

---

# 7. Story interpretation architecture

Voice Studio should use a staged interpretation pipeline.

```text
Audio Capture
→ Transcription
→ Transcript Normalization
→ Session Intent Classification
→ Context Resolution
→ Artifact Extraction
→ Canon / Continuity Check
→ Proposed Outputs
→ Human Approval
→ Project Mutation
```

## 7.1 Transcription is not interpretation

The transcription layer should produce faithful speech with timestamps and confidence.

It should not decide what becomes a scene, character, or canon fact.

## 7.2 Intent classification

A session may contain multiple intentions:

- direct dictation
- brainstorm
- instruction to SceneSmith
- quoted dialogue
- in-character speech
- aside
- correction
- rejected alternative
- final decision

The system must preserve ambiguity and ask for confirmation when intent affects canonical work.

## 7.3 Context resolution

Interpretation may use:

- project type
- current document
- selected text
- active scene or chapter
- current character
- approved canon
- Story Graph
- Character Bible
- writer preferences
- collaboration role
- draft status

Context is evidence, not permission to mutate.

## 7.4 Artifact extraction

The interpreter should produce typed artifacts rather than one undifferentiated response.

Conceptual contract:

```ts
type VoiceArtifactProposal = {
  id: string;
  sessionId: string;
  artifactType: string;
  destinationType: string;
  destinationId?: string;
  sourceSegmentIds: string[];
  proposedPayload: unknown;
  confidence?: number;
  rationale?: string;
  status: "proposed" | "edited" | "accepted" | "rejected" | "superseded";
};
```

## 7.5 Canon and continuity checks

Before offering promotion to canon, SceneSmith may identify:

- contradiction with Character Bible
- location inconsistency
- timeline conflict
- world-rule conflict
- relationship-state conflict
- duplicate scene or chapter idea
- unresolved alternate
- moral or behavioral inconsistency

Warnings must link to evidence and remain advisory.

---

# 8. Data model

The exact schema may evolve, but the conceptual separation is mandatory.

## 8.1 Voice sessions

```text
voice_sessions
- id
- project_id
- user_id
- session_type
- project_type
- context_type
- context_id
- status
- detected_language
- started_at
- ended_at
- duration_ms
- retention_policy
- created_at
```

## 8.2 Audio assets

```text
voice_audio_assets
- id
- session_id
- storage_path
- mime_type
- duration_ms
- checksum
- encryption / privacy metadata
- provider upload reference when applicable
- deletion_status
```

Do not store expiring signed URLs as canonical asset identity.

Store permanent bucket/path or asset references and mint temporary access URLs when needed.

## 8.3 Transcript segments

```text
voice_transcript_segments
- id
- session_id
- sequence
- speaker_id or speaker_label
- start_ms
- end_ms
- raw_text
- corrected_text
- confidence
- language
- provider_metadata
```

## 8.4 Interpretation runs

```text
voice_interpretation_runs
- id
- session_id
- mode
- context_snapshot_id
- provider
- model
- prompt / policy version
- started_at
- completed_at
- status
- cost metadata
```

## 8.5 Artifact proposals

```text
voice_artifact_proposals
- id
- interpretation_run_id
- artifact_type
- destination_type
- destination_id
- proposed_payload
- source_segment_ids
- confidence
- rationale
- status
- edited_by
- resolved_by
- resolved_at
- supersedes_id
```

## 8.6 Mutation records

Every accepted output must record:

- proposal
- project object changed
- before version
- after version
- approving user
- timestamp
- authorship attribution
- undo or reversal reference

---

# 9. Integration with SceneSmith intelligence

## 9.1 Academy

Academy may guide a voice session through one question at a time.

It should adapt to the creator's experience without exposing system jargon unnecessarily.

## 9.2 ITS

The tutoring layer may determine:

- what concept the creator needs next
- whether the creator is stuck
- whether a prompt should become simpler or more advanced
- which misconception needs repair
- when the session has produced enough to return to the page

## 9.3 PfHU

The writer-understanding layer may adapt:

- pace
- explanation depth
- question style
- visual versus verbal summaries
- tolerance for interruption
- structure of recap

It must not make hidden psychological claims or use personal inference as canon.

## 9.4 TMH and Character Truth

Voice sessions may propose character behavior, moral pressure, contradiction, regression, aspiration, or relationship changes.

These should be checked against approved Character Bible and current temporal state.

Example:

> This choice appears above the character's established moral ceiling. Keep it, explain the catalyst, or treat it as an alternate?

The system must not morally grade the creator or prescribe a worldview.

## 9.5 Story Graph and Production Graph

Accepted voice artifacts may update the structured story model.

Production voice notes may later create Production Graph proposals.

No graph update occurs before approval.

---

# 10. Collaboration, authorship, and governance

## 10.1 Authorship

Voice Studio must preserve who said what and who approved what.

A meeting participant's spoken idea must not be attributed to the person who clicked Accept.

## 10.2 Permissions

Roles must control:

- who may record
- who may access audio
- who may correct transcripts
- who may interpret sessions
- who may create suggestions
- who may approve canonical changes
- who may delete recordings
- who may export transcripts

## 10.3 Draft and production locks

Voice Studio may create notes and suggestions against locked work.

It must not bypass review, approval, production lock, or editorial governance.

## 10.4 Shared sessions

For collaborative recording:

- recording status must be visible to all participants
- consent must be explicit
- speaker identity confidence must be reviewable
- private side conversations must not be captured accidentally
- transcript access must follow project permissions

---

# 11. Privacy, consent, and rights

Voice recordings may contain highly private creative material, personal stories, unreleased intellectual property, and third-party voices.

Voice Studio must provide:

- clear recording consent
- configurable retention
- delete audio while retaining approved text, when allowed
- delete transcript and derived outputs
- export of original audio and transcript
- account and project isolation
- secure storage
- temporary signed access URLs
- audit history
- provider data-processing disclosure
- no model-training assumption without explicit policy and consent
- safeguards for minors and sensitive recordings

The user must understand when audio leaves the device and which provider receives it.

---

# 12. Multilingual and accessibility requirements

Voice Studio should support multilingual creators and code-switching.

Rules:

- preserve the original language transcript
- do not translate unless requested or required by a chosen output
- store source and output languages separately
- allow correction of names and invented words
- learn project-specific pronunciation and vocabulary with user approval
- make language detection reviewable
- support captions and non-audio review
- provide keyboard and touch alternatives
- use accessible recording controls and status announcements

All user-facing copy must use i18n keys.

---

# 13. Cost, credits, and profitability

Voice Studio is a premium-capable product and must not become an unmetered cost center.

Every paid operation should track:

- audio duration
- transcription provider
- transcription cost
- interpretation model
- interpretation cost
- conversational-agent time
- storage cost
- generated playback cost
- user credits charged
- margin

The UI should show a reasonable estimate before expensive operations.

Suggested product structure:

## Free / Trial

- short capture
- limited transcription minutes
- basic transcript export
- sample project-aware interpretation

## Creator

- screenplay and project-aware dictation
- brainstorm organization
- scene, chapter, skit, and YouTube artifact creation
- character and worldbuilding note extraction

## Pro

- longer sessions
- conversational Academy guide
- revision parsing
- advanced continuity checks
- multi-language workflows
- more storage and session history

## Studio

- writers' room capture
- speaker diarization
- editorial decisions
- assignments
- governance and approval records
- team archive
- production voice notes

Buy-more-credit behavior must resolve the real limit encountered.

Do not offer nominal credits that fail to cover minute limits, provider call limits, or interpretation calls.

Do not subsidize unlimited free transcription, storage, or conversational sessions.

---

# 14. Failure and recovery behavior

Voice Studio must handle:

- microphone permission denied
- microphone disconnected
- interrupted network
- streaming provider failure
- partial transcript
- unknown language
- low-confidence names
- speaker diarization failure
- interpretation timeout
- provider rate limits
- insufficient credits
- project permission change during session
- duplicate artifact insertion
- stale destination version

Recovery principles:

- preserve local audio until upload is confirmed
- never lose the raw session because interpretation failed
- allow retranscription with another provider
- allow reinterpretation without retranscription
- prevent duplicate project mutations
- display clear status and next action
- make billing failures distinct from creative failures

---

# 15. Implementation sequence

Do not build this as one giant voice-agent pass.

## Phase 0 — Doctrine and contracts

- canonical session vocabulary
- project-type artifact registry
- provider-neutral interfaces
- privacy and retention policy
- cost model
- UX wireframes

## Phase 1 — Voice Notes Foundation

- record audio
- upload safely
- transcribe
- correct transcript
- save as project note
- export and delete

No automatic draft insertion.

## Phase 2 — Write by Voice for screenplay blocks

- command dictation
- natural dictation
- screenplay element proposals
- review and staged insertion
- local-first editor handoff

## Phase 3 — Cross-format artifact extraction

- scene cards
- chapter cards
- skit beats
- YouTube segments
- revision tasks
- proposal lifecycle

## Phase 4 — Guided Brainstorm and Character / World sessions

- Academy follow-up prompts
- ITS/PfHU adaptation
- Character Bible proposals
- worldbuilding proposals
- continuity warnings

## Phase 5 — Editorial and collaboration

- revision-note parsing
- writers' room capture
- diarization
- assignments
- decisions and approvals

## Phase 6 — Real-time conversational Voice Studio

- interruptible guide
- low-latency follow-up questions
- spoken summaries
- explicit session boundaries
- cost controls

## Phase 7 — Production integration

- director and DP notes
- location notes
- performance notes
- Production Graph proposals
- downstream production packages

Each phase must pass acceptance tests before the next begins.

---

# 16. Required acceptance tests

## 16.1 Preservation

1. Record a session.
2. Interrupt the network.
3. Restore connection.
4. Confirm audio and partial transcript survive.
5. Confirm no project content changed without approval.

## 16.2 Screenplay dictation

Speak:

> Interior, apartment, night. Anna stands at the window and says, “I thought you were dead.”

Expected proposal:

```text
INT. APARTMENT — NIGHT

Anna stands at the window.

ANNA
I thought you were dead.
```

The result must be reviewed before insertion.

## 16.3 Novel brainstorm

Speak an unstructured chapter idea with two alternatives.

Expected:

- both alternatives preserved
- chapter proposal separated from character and world proposals
- no invented prose inserted automatically

## 16.4 Skit / comedy session

Speak a premise, setup, two punchlines, and a rejected alternate.

Expected:

- cadence and alternatives preserved
- rejected alternate not presented as final
- output can be saved as beat sheet or draft proposal

## 16.5 Character session

Describe a character fear that contradicts approved canon.

Expected:

- proposed Character Bible update
- contradiction warning with evidence
- Accept, Keep as Alternate, and Reject actions

## 16.6 Revision notes

Record three notes while reviewing different scenes.

Expected:

- notes mapped to correct scenes
- tasks independently approvable
- speaker and timestamp provenance retained

## 16.7 Permissions

- viewer cannot mutate project artifacts
- commenter may create permitted notes but not approve canon
- editor permissions follow project policy
- non-member cannot access audio, transcript, or proposals

## 16.8 Cost transparency

Before a paid long-form session, show estimated usage or credit impact.

After completion, record actual usage and prevent duplicate charging on retry.

---

# 17. Do not build

Do not build:

- a microphone that inserts raw transcription directly into canon
- one global transcript textbox
- a screenplay-only data model
- an ElevenLabs-specific canonical schema
- automatic character or world canon creation
- hidden recording
- unmetered expensive voice sessions
- a guide that asks endless questions
- automatic replacement of the creator's prose voice
- a voice feature that blocks typing when unavailable
- a meeting recorder without consent and permissions
- a transcript that loses connection to its audio
- generated summaries that impersonate the creator's exact words

---

# 18. Canonical terminology

Use these terms consistently:

- **Voice Studio** — the complete cross-format product capability
- **Voice Session** — one bounded recording and interpretation event
- **Write by Voice** — dictation intended for a draft
- **Voice Brainstorm** — exploratory spoken ideation
- **Raw Transcript** — provider transcription before user correction
- **Clean Transcript** — user-corrected or normalized transcript
- **Interpretation Run** — one model pass over a transcript and context snapshot
- **Artifact Proposal** — a structured output awaiting approval
- **Approved Mutation** — the recorded project change created from an accepted proposal
- **Voice Guide** — the optional Academy conversational guide

Avoid calling the whole system:

- voice typing
- AI dictation
- voice bot
- ElevenLabs mode

Those labels are too narrow and will cause product drift.

---

# 19. Final doctrine

SceneSmith Voice Studio exists to turn spoken creative thought into structured, reviewable story work across every supported project type.

Its enduring principles are:

```text
Preserve the original thought.
Understand the current creative context.
Structure without flattening the creator's voice.
Propose rather than overwrite.
Keep providers replaceable.
Keep authorship and approval visible.
Return the creator to the work.
```

Voice Studio succeeds when a creator can speak naturally, recover the truth of what they said, understand what SceneSmith inferred, and confidently choose what becomes part of the story.