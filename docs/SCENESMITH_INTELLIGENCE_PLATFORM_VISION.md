# SceneSmith Studio Intelligence Platform Vision

## Status

Canonical long-term product doctrine and implementation compass.

This document defines what SceneSmith Studio is becoming, how its intelligence systems must work together, how those systems create customer value, and how Lovable or any future contributor should sequence implementation.

It is not a request to build every capability at once.

Use it to:

- preserve product direction across implementation passes
- evaluate whether a proposed feature belongs in SceneSmith Studio
- prevent disconnected AI panels and duplicate workflows
- guide data-model, UX, architecture, pricing, and roadmap decisions
- keep the Writer's Desk central while expanding the intelligence platform around it

Before implementing work governed by this document, read:

1. `AGENTS.md`
2. `docs/SCENESMITH_INTELLIGENCE_PLATFORM_VISION.md`
3. `docs/SCENESMITH_ACADEMY.md`
4. `docs/CHARACTER_TRUTH_ENGINE.md`
5. `docs/CHARACTER_TRUTH_ENGINE_SOURCE_SYSTEMS.md`
6. the relevant feature-specific Lovable document

---

## 1. The product thesis

SceneSmith Studio is not merely screenplay formatting software with an AI button.

It is a story-intelligence platform designed to help a human writer:

- discover a story
- understand what the story is truly about
- build psychologically and morally coherent characters
- write scenes that materially change the story
- preserve continuity across drafts, episodes, seasons, and writers
- receive useful guidance without surrendering authorship
- evaluate a completed script through evidence-based craft diagnostics
- revise with intention
- collaborate safely
- rehearse, package, pitch, and ship the work

The durable strategic advantage is not generic text generation.

It is the combination of:

```text
this writer
+ this character
+ this relationship
+ this moral trajectory
+ this story promise
+ this scene's pressure
+ this series canon
+ this specific contradiction
```

SceneSmith should become a system for preserving human truth, character integrity, meaningful transformation, and thematic coherence across the full life of a story.

---

## 2. Prime directive

The Writer's Desk remains the product's center of gravity.

```text
The page is where the writer creates.
Everything else must help the writer create, understand, revise, collaborate on, perform, package, or sell the work.
```

No intelligence feature may damage the local-first writing path.

Required writing path:

```text
User input
→ local editor state
→ immediate render
→ background persistence
```

Intelligence path:

```text
Stable project state or explicit user request
→ background analysis
→ evidence-backed observation
→ user-controlled action
```

Never:

```text
Keystroke
→ network analysis
→ server mutation
→ rendered text
```

The intelligence platform must follow the writer, not sit between the writer and the page.

---

## 3. The SceneSmith operating model

SceneSmith Studio has four major product surfaces and one shared intelligence substrate.

### 3.1 Writer's Desk

The canonical writing surface.

It owns:

- screenplay blocks
- local-first typing
- formatting
- scene construction
- revision history
- draft identity
- accepted script content

The Writer's Desk is not an AI chat surface.

### 3.2 SceneSmith Academy

The guided intelligence system that teaches, coaches, evaluates, and improves.

Academy intentionally evokes the aspiration and prestige of the Academy Awards.

Academy is not primarily a passive course catalog.

Its four operating modes are:

```text
GUIDE       Help me create the project.
COACH       Help me improve what I am writing now.
REVIEW      Analyze the completed draft.
CONTINUITY  Protect character, story, and canon across a series.
```

### 3.3 Writers' Room

The human collaboration environment.

It owns:

- memberships and roles
- invitations
- comments
- suggestions
- assignments
- scene claims and locks
- Arena practice and competition
- eventually trusted live co-writing

### 3.4 Producer tools

The tools that help the work leave the page.

They include:

- Pitch Deck
- Table Read
- Storyboard / Shot Wall
- export and presentation tools
- project packaging
- performance and rehearsal workflows

### 3.5 Shared intelligence substrate

The intelligence substrate connects all four surfaces without becoming a separate pile of panels.

It includes:

- Intelligent Tutoring System patterns
- PfHU writer-understanding patterns
- The Moral Hierarchy
- Character Truth Engine
- relationship-state modeling
- story-state modeling
- project canon
- series continuity
- evidence and provenance
- analysis runs and review reports

---

## 4. Academy is a living guide, not an LMS

The current Academy module and lesson system is useful scaffolding, but the long-term Academy is a living guide embedded across the creative process.

The Academy should feel like a professional mentor who:

- knows the writer's experience level
- knows the current project
- knows what the writer has already attempted
- knows what the current scene is trying to do
- knows the characters' established motives and limits
- knows which concepts the writer understands
- knows which misunderstandings keep repeating
- asks one useful question at the right moment
- returns the user to the page

The Academy must not become:

- a detached video-course library
- a generic chatbot
- a quiz app with no project impact
- an intrusive grammar checker
- an automatic ghostwriter
- a moralizing authority

Core Academy principle:

```text
Guide the writer through the next meaningful decision,
then let the writer make it.
```

---

## 5. The four Academy modes

## 5.1 GUIDE — guided creation

Guide Mode is the beginner-friendly path and the structured path for any writer who wants help shaping a project.

It should help the writer answer, in a sensible order:

- What format am I writing?
- What is the premise?
- Who is the protagonist?
- What do they want?
- Why can they not simply get it?
- What are they afraid of?
- Who or what applies pressure?
- What changes across the story?
- What is promised to the audience?
- What scenes must exist?
- What does the ending prove?

Guide Mode must adapt.

A beginner may receive:

- concrete definitions
- examples
- one question at a time
- visual scaffolds
- repair loops

An experienced writer may receive:

- concise challenges
- contradiction detection
- optional advanced theory
- minimal interruption

Guide Mode should produce real project artifacts, such as:

- premise
- logline
- protagonist statement
- character contradiction
- conflict engine
- relationship map
- story spine
- beat outline
- scene list
- first scene
- revision target

Every guided step should answer:

```text
What did the writer create?
Where is it stored?
How does it affect the project?
What evidence shows readiness for the next step?
```

## 5.2 COACH — contextual writing guidance

Coach Mode lives beside the Writer's Desk.

It should be:

- collapsible
- read-only by default
- contextual
- non-blocking
- debounced or explicitly invoked
- isolated from the typing path
- evidence-backed
- user-controlled

Initial high-value Coach questions:

- Would this character really do this?
- What does this character want in this scene?
- What changed emotionally?
- Where does the scene lose pressure?
- Does this scene materially change the story?
- Is this behavior consistent with the character's established moral level under this pressure?
- Is the dialogue expressing desire or merely transferring information?
- What consequence from the prior scene is missing here?

The Coach should not dump twenty warnings at once.

It should prioritize observations by:

- severity
- confidence
- current writing context
- likely revision value
- writer experience
- user preference

## 5.3 REVIEW — full-script intelligence review

Review Mode is a premium analysis product for completed or substantially complete drafts.

The user intentionally starts a review run.

A review run must be tied to:

- one immutable draft snapshot
- one analysis version
- one engine/configuration version
- one timestamp
- one project
- one requesting user

A review may evaluate:

### Structure

- setup and payoff
- act movement
- escalation
- scene necessity
- pacing
- turning points
- climax preparation
- unresolved story threads
- promises made and fulfilled

### Character

- motive continuity
- behavioral consistency
- pressure response
- believable regression
- emotional consequence
- moral movement
- relationship evolution
- arc completion
- unexplained contradictions

### Dialogue

- voice differentiation
- subtext
- exposition density
- objective and resistance
- repeated information
- emotional truth
- tonal drift

### Theme and meaning

- thematic clarity
- theme embodiment
- moral coherence
- consequence integrity
- transformation
- audience resonance
- contradiction between stated values and rewarded behavior

### Market and readiness

- genre promise
- tone consistency
- pitch clarity
- audience fit
- production complexity indicators
- revision priority

The output should not be a giant wall of generic prose.

It should produce:

- executive summary
- score/profile cards
- high-confidence findings
- evidence citations to scenes and blocks
- severity and confidence
- revision roadmap
- suggested order of operations
- optional compare-to-next-draft workflow

## 5.4 CONTINUITY — series and franchise intelligence

Continuity Mode is the long-term professional and studio opportunity.

It protects behavioral and narrative canon across:

- episodes
- seasons
- replacement writers
- showrunner notes
- adaptations
- spin-offs
- franchise timelines
- serialized audio and video productions

For each character, the system should maintain a Character Alignment Model containing, over time:

- core motives
- stated goals
- hidden goals
- fears
- attachment patterns
- moral baseline
- moral ceiling
- stress regression pattern
- relational hierarchy
- loyalties
- secrets
- injuries
- promises
- beliefs
- voice tendencies
- unresolved conflicts
- current arc state
- known canon facts

Continuity intelligence may identify:

- voice drift
- motive drift
- moral-level discontinuity
- missing catalyst
- forgotten injury or consequence
- contradictory relationship state
- repeated character arc
- broken world rule
- unresolved season promise
- canon conflict

Example:

```text
This choice is possible, but it represents a substantially higher moral response than the character has shown under comparable pressure. Add a visible catalyst, earned change, or contradictory motive.
```

The system should distinguish:

```text
Impossible by canon
Unlikely without explanation
Plausible under current pressure
Consistent with established behavior
Evidence of earned transformation
```

---

## 6. The intelligence engines

The engines are complementary. They must not be collapsed into one vague AI score.

## 6.1 ITS — what to teach next

The Intelligent Tutoring System determines:

- the next useful concept
- whether the writer is ready
- whether repair is needed
- whether an explanation should be repeated differently
- what evidence demonstrates understanding
- when to return the user to the project

ITS concepts to adapt from VerbBros-style systems:

- lesson orchestration
- learner state
- mastery gates
- repair loops
- evidence accumulation
- next-best action
- practice versus evaluation
- progressive complexity

SceneSmith mapping:

```text
language atom          → craft concept
practice utterance     → writing artifact
repair loop            → revision guidance
mastery gate           → artifact readiness
learner state          → writer craft profile
```

## 6.2 PfHU — how to guide this writer

PfHU represents the evolving understanding of the human user.

It may adapt:

- explanation depth
- pacing
- directness
- terminology
- number of choices
- examples versus abstraction
- encouragement versus challenge
- frequency of intervention
- preferred visual representation

PfHU must not become a hidden personality verdict.

It should store practical guidance preferences and observed learning signals with:

- provenance
- confidence
- user visibility where appropriate
- correction paths
- privacy protections

## 6.3 TMH — moral behavior under pressure

The Moral Hierarchy provides a model for:

- moral baseline
- behavior under pressure
- regression
- aspiration
- blind spots
- transformation
- consequence

TMH must be used as story physics, not moral condemnation.

It should never say:

```text
This writer or character is bad.
```

It may say:

```text
The behavior shown here appears inconsistent with the character's established level and pressure response.
```

or:

```text
The ending rewards a behavior the story previously framed as destructive, creating thematic ambiguity.
```

## 6.4 Character Truth Engine — would they do this?

The Character Truth Engine tests behavior against:

- motive
- fear
- pressure
- relationship
- prior behavior
- current arc position
- moral baseline
- available information
- consequence

It should produce:

- conclusion
- confidence
- supporting evidence
- contradicting evidence
- missing catalyst
- plausible alternatives

## 6.5 Relationship intelligence

Characters do not act in isolation.

Relationship state should model:

- trust
- power
- dependence
- debt
- intimacy
- resentment
- loyalty
- fear
- status
- unresolved injury
- shared history

The same character may behave differently with different people. The system must understand that context.

## 6.6 Story-state intelligence

Story state should track:

- active goals
- active threats
- unanswered questions
- promises to the audience
- secrets known by each character
- relationship changes
- injuries and consequences
- unresolved plot threads
- current dramatic pressure
- scene outcomes

---

## 7. The Message Profile

"The Message" is a premium thematic diagnostic, not an ideological grade.

It evaluates what the screenplay communicates through outcomes and consequences.

The system must not judge whether the story expresses the "correct" worldview.

It should evaluate coherence between:

- what the story appears to value
- what characters say
- what characters do
- what behavior is rewarded
- what behavior is punished
- what transformation is earned
- what the ending ultimately proves

Recommended profile dimensions:

```text
Message Clarity
Theme Embodiment
Moral Coherence
Consequence Integrity
Character Transformation
Audience Resonance
```

Example result:

```text
The Message: 78 / 100 — Strong, but partially unresolved
```

Example finding:

```text
The screenplay argues that loyalty requires sacrifice, but the resolution rewards the protagonist for avoiding the cost of loyalty. This creates a thematic contradiction between the second act and the ending.
```

Rules:

- show dimensions, not only one number
- include confidence
- cite evidence
- distinguish ambiguity from incoherence
- allow the writer to reject or reinterpret a finding
- never present the score as objective moral truth
- version the scoring model

---

## 8. Evidence, provenance, and explainability

Every meaningful diagnostic should be traceable.

A finding should include:

```ts
type StoryFinding = {
  id: string;
  reviewRunId: string;
  category: string;
  severity: "observation" | "minor" | "major" | "critical";
  confidence: number;
  title: string;
  explanation: string;
  evidence: Array<{
    projectId: string;
    draftId: string;
    sceneId?: string;
    blockId?: string;
    excerpt?: string;
    reason: string;
  }>;
  counterEvidence?: Array<{
    sceneId?: string;
    blockId?: string;
    reason: string;
  }>;
  suggestedActions?: string[];
  engineVersion: string;
  createdAt: string;
};
```

Do not generate unsupported certainty.

Preferred language:

```text
The current evidence suggests...
This appears inconsistent because...
A plausible explanation would be...
The script may intentionally be creating ambiguity here...
```

Avoid:

```text
This scene is wrong.
This character would never do this.
The theme is bad.
```

---

## 9. Review pipeline for long scripts

Full-script analysis must be hierarchical.

Do not send an entire series or screenplay to one model call and trust a single response.

Recommended pipeline:

```text
Draft snapshot
→ block normalization
→ scene summaries
→ scene-state extraction
→ character-state extraction
→ relationship-state extraction
→ act/sequence synthesis
→ whole-script synthesis
→ cross-check passes
→ finding deduplication
→ confidence scoring
→ report assembly
```

For series:

```text
Episode analysis
→ season-state update
→ canon graph update
→ character trajectory update
→ contradiction scan
→ showrunner report
```

The pipeline should support:

- resumability
- retries
- cost tracking
- cached intermediate artifacts
- engine versioning
- draft comparison
- partial reruns
- auditability

---

## 10. Canonical data concepts

Exact schemas should be designed in implementation passes, but the platform needs these concepts.

### 10.1 Writer profile

- experience level
- format familiarity
- learning preferences
- intervention preference
- known strengths
- recurring craft obstacles
- mastered concepts
- active repair loops
- evidence history

### 10.2 Character alignment model

- canonical facts
- motives
- fears
- moral profile
- stress behavior
- relationships
- voice markers
- arc state
- known secrets
- unresolved obligations
- evidence references

### 10.3 Scene intelligence record

- scene objective
- opposition
- pressure
- emotional start/end
- relationship changes
- story information revealed
- moral choice
- consequences
- promises created/fulfilled
- confidence and evidence

### 10.4 Story/series canon graph

- entities
- facts
- timelines
- relationships
- world rules
- source episode/scene/block
- validity interval
- conflicting claims
- approved canon status

### 10.5 Analysis run

- project
- immutable draft snapshot
- requested product
- engine version
- status
- cost
- start/end time
- failure/retry state
- generated findings
- generated report

### 10.6 Human decisions

The system must record when a human:

- accepts a suggestion
- rejects a finding
- marks ambiguity intentional
- changes canon
- resolves a contradiction
- overrides a continuity warning

Human decisions become future context. They must not disappear.

---

## 11. UX doctrine for the living guide

The guide should feel present without becoming noisy.

Preferred patterns:

- collapsible Coach rail
- one prioritized observation
- "Why?" expansion
- evidence links
- compare alternatives
- explicit "Apply as suggestion"
- snooze or dismiss
- sensitivity controls
- beginner/advanced depth
- scene-level and project-level modes

Avoid:

- constant popups
- red squiggles across the screenplay
- unsolicited rewrites
- generic praise
- moral lectures
- a chat window disconnected from project state
- advice with no evidence
- automatic edits

The guide may adopt a warm persona, but the persona must never obscure the underlying evidence or pretend to be human.

---

## 12. Human authority and authorship

The writer remains the author.

AI may:

- analyze
- diagnose
- explain
- ask questions
- suggest alternatives
- create a proposed revision when requested

AI must not:

- overwrite canonical script content without explicit consent
- invent permanent canon without approval
- silently change character history
- resolve ambiguity on the writer's behalf
- grade ideology
- claim certainty unsupported by evidence
- erase authorship provenance

All proposed changes should flow through:

```text
observation
→ suggestion
→ review
→ explicit acceptance
→ canonical change
```

---

## 13. Collaboration and authorship intelligence

The intelligence platform must understand who contributed what.

Required long-term capabilities:

- block and scene authorship provenance
- accepted suggestion attribution
- Arena contribution lineage
- revision ownership
- showrunner approval history
- collaborator role context

The system may visually represent authorship with:

- subtle rail
- avatar or initials
- stable session-local color
- name and role
- hover/tap provenance

Do not use authorship color to overwhelm screenplay formatting.

---

## 14. Premium products and monetization

The intelligence platform should support multiple revenue layers.

## 14.1 Starter / free

- basic guided setup
- formatting help
- limited Academy Guide
- limited Coach checks
- sample review output

## 14.2 Creator

- full guided project path
- contextual scene coaching
- character consistency checks
- scene diagnostics
- basic draft review

## 14.3 Pro

- full Script Intelligence Review
- The Message Profile
- advanced character alignment
- structural diagnostics
- dialogue analysis
- revision roadmap
- draft comparison
- pitch-readiness analysis

## 14.4 Studio / Writers' Room

- series bible intelligence
- multi-writer character alignment
- episode continuity
- canon graph
- voice-drift detection
- moral trajectory tracking
- season arc integrity
- showrunner approvals
- shared reports
- role-based access

## 14.5 Credit-based add-ons

Potential add-ons:

- feature screenplay review
- pilot review
- episode review
- full-season continuity review
- pitch package review
- revision comparison
- expedited analysis

Pricing must be set only after measuring:

- model cost
- processing time
- report depth
- retry rate
- customer value
- human-review expectations

Never promise unlimited expensive analysis without cost controls.

---

## 15. Privacy, safety, and trust

Scripts are valuable private intellectual property.

Required principles:

- private by default
- least-privilege access
- RLS on project intelligence data
- no training on user scripts without explicit permission
- clear retention and deletion behavior
- encrypted transport
- audit logs for studio access
- explicit sharing boundaries
- user-controlled report deletion where legally possible
- no cross-project data leakage

Professional users must be able to understand:

- who can access a script
- which model/provider processed it
- what was stored
- what was generated
- how long artifacts are retained

---

## 16. Versioning and reproducibility

Every analysis result must preserve:

- draft snapshot ID
- engine version
- prompt/configuration version
- model/provider identifier
- scoring rubric version
- date

A later engine version may produce different results. The app should not silently rewrite old reports.

Support:

```text
Review v1 on Draft 3
Review v2 on Draft 4
Compare findings
Mark resolved
Mark intentional
```

---

## 17. Product metrics

Do not optimize merely for AI usage.

Measure outcomes such as:

- projects reaching first scene
- projects reaching first act
- completed drafts
- revisions completed
- findings acted upon
- findings rejected as irrelevant
- time from confusion to next writing action
- character-continuity errors prevented
- collaborator onboarding success
- review purchase conversion
- repeat review purchase
- series/studio retention

Academy success is not "messages sent to the coach."

Academy success is writers making stronger progress on real work.

---

## 18. Phased implementation roadmap

Do not build the entire platform in one pass.

## Phase 0 — inventory and contracts

- inventory existing engines and routes
- identify duplicate concepts
- define canonical types and ownership
- map Academy, Coach, Truth Engine, TMH, PfHU, and ITS code
- document current data gaps
- preserve local-first editor contracts

## Phase 1 — Guide alpha

- guided project intake
- experience-level adaptation
- one-question-at-a-time flow
- real artifact creation
- Writer's Desk handoff
- no autonomous script writing

## Phase 2 — Coach alpha

- active scene context
- active character context
- explicit Truth Check
- scene objective and pressure check
- collapsible rail
- feature flag
- performance isolation

## Phase 3 — evidence layer

- canonical scene-state extraction
- character-state extraction
- relationship-state extraction
- evidence references
- confidence model
- human accept/reject/intentional decisions

## Phase 4 — premium Review v1

- immutable snapshot
- review-run orchestration
- structural review
- character review
- dialogue review
- revision roadmap
- report export
- usage and cost tracking

## Phase 5 — The Message Profile

- rubric versioning
- thematic dimensions
- consequence analysis
- evidence-backed findings
- ambiguity handling
- premium report integration

## Phase 6 — draft comparison

- compare Review runs
- resolved findings
- new regressions
- character arc differences
- revision impact report

## Phase 7 — continuity and series bible

- episode ingestion
- canon graph
- timeline
- character alignment model
- continuity warnings
- showrunner decisions

## Phase 8 — studio workflows

- role-aware reports
- approval gates
- writer onboarding to existing canon
- season-level analysis
- franchise support
- enterprise privacy and audit controls

---

## 19. Feature gates and rollout

Every expensive or risky capability should be feature-flagged.

Examples:

```text
academy_guide_enabled
academy_coach_enabled
script_review_enabled
message_profile_enabled
series_continuity_enabled
```

Rollout sequence:

```text
internal
→ invited testers
→ paid beta
→ controlled production
```

Each stage requires:

- acceptance tests
- cost measurement
- relevance review
- privacy review
- failure recovery
- user feedback

---

## 20. Acceptance principles by mode

### Guide

A writer can enter with only an idea and reach a real, editable project artifact without feeling trapped in a questionnaire.

### Coach

A useful observation appears without affecting typing, stealing focus, or overwriting the script.

### Review

A completed report is tied to a draft, cites evidence, prioritizes revision, and provides substantially more value than generic AI feedback.

### Continuity

A new writer can understand the current character and story state, and the system catches a real contradiction without blocking intentional creative change.

### The Message

The profile explains thematic coherence without grading ideology or presenting itself as moral truth.

---

## 21. What not to build

Do not build:

- a generic AI chat tab labeled Academy
- an always-on rewrite bot
- one opaque quality score
- a morality score for the writer
- a detached LMS as the primary Academy experience
- a continuity checker with no evidence
- a report that analyzes a moving draft without snapshotting
- per-keystroke cloud analysis
- professional studio claims without permissions and auditability
- unlimited premium analysis without cost controls
- features that duplicate existing project state in disconnected tables

---

## 22. Decision filter for future features

Before approving a feature, answer:

1. Which user problem does this solve?
2. Which surface owns it: Writer's Desk, Academy, Writers' Room, or Producer?
3. What canonical project data does it read?
4. What canonical project data may it write?
5. Does it preserve authorship and user control?
6. Does it need an immutable draft snapshot?
7. What evidence supports its output?
8. What is the cost model?
9. What is the privacy boundary?
10. How will we know it improved the writer's outcome?

If those answers are unclear, do not implement the feature yet.

---

## 23. Required implementation behavior for Lovable and coding agents

When implementing work related to this vision:

- state which phase is being implemented
- inspect existing code before adding parallel systems
- keep the route layer thin
- preserve local-first writing
- use feature flags for risky or premium capabilities
- use background jobs or resumable orchestration for long analysis
- snapshot drafts before full-script review
- store engine versions
- cite evidence
- preserve human decisions
- use Suggestions for proposed script changes
- add RLS and permission tests
- add cost and failure telemetry
- document deferred work honestly

Final implementation summaries must include:

- files changed
- schemas or migrations added
- intelligence engines used
- canonical data read and written
- feature flags
- privacy/RLS behavior
- model/provider usage
- cost controls
- test results
- known limitations
- confirmation that Writer's Desk typing behavior was not degraded

---

## 24. North-star product statement

SceneSmith Studio should become:

> The creative intelligence system that guides a writer from first idea to finished screenplay, preserves character and thematic truth, protects continuity across collaborators and seasons, and helps exceptional stories survive the complexity of being written, revised, produced, and expanded.

The Writer's Desk remains sacred.

The Academy guides.

The Coach observes.

The Review explains.

The Continuity system remembers.

The human writer decides.
