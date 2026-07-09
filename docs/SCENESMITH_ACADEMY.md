# SceneSmith Academy Doctrine

## Status

Doctrine / product specification. This document is intended to guide Lovable and any coding agent before building Academy features.

Do not treat this document as a request to implement UI by itself. Use it to plan Academy work, design lesson models, and keep SceneSmith Academy aligned with the writing-first product philosophy.

## Read first

Before implementing Academy features, read these files in order:

1. `AGENTS.md`
2. `docs/SCENESMITH_ACADEMY.md`
3. `docs/CHARACTER_TRUTH_ENGINE.md`
4. `docs/CHARACTER_TRUTH_ENGINE_SOURCE_SYSTEMS.md`
5. `src/lib/academy.server.ts`
6. `src/lib/academy.functions.ts`
7. `src/components/guided/stepMeta.ts`
8. `src/components/editor/StepCoach.tsx`
9. `src/lib/story-intelligence/writerProfileSignals.ts`
10. `src/lib/story-intelligence/truthCoach.ts`
11. `src/lib/story-intelligence/characterTruthEngine.ts`
12. `src/components/characters/GuidedCharacterBuilder.tsx`
13. `src/components/characters/WouldTheyDoThisTab.tsx`
14. `src/routes/_authenticated/first-screenplay.$projectId.tsx`
15. `src/routes/_authenticated/editor.$projectId.tsx`

The editor remains the product. Academy exists to help the writer create, revise, finish, understand, pitch, or perform the screenplay. Academy must never become a detached course library that competes with writing.

---

## 1. Product position

SceneSmith Academy is an applied writing school inside SceneSmith Studio.

It is not a passive course library, a blog, a disconnected LMS, a playlist, a quiz app, or an AI chatbot wearing a professor costume.

The Academy teaches screenwriting by helping the writer build an actual project.

Core principle:

```text
Teach the craft at the moment the writer needs it, then return them to the page.
```

Every Academy interaction should answer one of these questions:

- What does the writer need to understand right now?
- What project artifact should this lesson help create?
- Where should the writer apply it?
- How does the app know whether the work improved?
- How do we keep the page sacred?

The Academy should make the app feel like a professional writing mentor, not like homework.

---

## 2. Relationship to SceneSmith Studio

SceneSmith Studio is the ultimate writing app. Academy is one layer inside it.

SceneSmith supports:

- feature films
- television pilots
- short films
- stage plays
- audio dramas
- comics
- YouTube/video scripts
- stand-up/storytelling routines
- novels and adaptation workflows
- pitch packages and sales materials

Academy must support those formats over time, but the first curriculum spine is screenplay-first.

Academy is not the main product surface. The page is the product. Academy is summoned when useful.

Correct mental model:

```text
The Page = where the writer creates
The Academy = how the writer learns what to do next
The Character Truth Engine = how character behavior is tested
The Truth Coach = how analysis becomes teachable
PfHU = how the app adapts to the writer
ITS = how the app teaches one useful step at a time
```

---

## 3. Source systems and Lovable project references

Use these Lovable projects as source-system references. Do not copy UI, branding, tables, or unrelated flows directly. Extract patterns, doctrine, and reusable mental models.

### Target implementation project

- `@SceneSmith Studio`

All implementation happens in SceneSmith Studio / this repo unless explicitly stated otherwise.

### ITS / adaptive teaching source

- `@VerbBros Academy`

Use VerbBros Academy as the primary source for:

- Intelligent Tutoring System patterns
- lesson flow orchestration
- adaptive onboarding
- repair loops
- one-concept-at-a-time teaching
- learner-state-driven feedback
- mastery gates
- next-best-action logic
- exam/practice separation
- evidence-driven remediation

Known VerbBros concepts to adapt:

```text
LessonFlowController
TutorBrain
PfHU
adaptive conversational intelligence
unified evidence
repair loops
mastery gates
PPP-style teaching flow
learner profile signals
```

SceneSmith adaptation:

```text
Language learner → writer
Language atom → craft concept
Speaking/writing task → screenplay exercise
Repair loop → rewrite guidance
Mastery gate → project artifact readiness
CEFR progression → screenplay/craft progression
```

### PfHU / personality insight sources

Use these as references for profile-driven adaptation:

- `@personality-insight-analyzer`
- `@Persona Insights`

Use these for:

- profile signals
- user-understanding patterns
- personality/cognitive-style insights
- explanation-depth adaptation
- coaching tone adaptation

SceneSmith adaptation:

```text
personality insight → writer guidance preferences
user profile → coaching intensity
breakdown pattern → writing obstacle
repair suggestion → next writing action
```

### TMH / moral behavior source

Use The Moral Hierarchy / themoralhierarchy.com as the conceptual source for moral behavior under pressure.

If a Lovable workspace project must be referenced, inspect the persona/TMH-related projects carefully, especially:

- `@personality-insight-analyzer`
- `@Persona Insights`

TMH must remain a story-physics layer, not moral condemnation.

SceneSmith adaptation:

```text
TMH → moral behavior under pressure
TMH stress level → character regression under pressure
TMH aspirational level → character arc direction
TMH blind spot → dramatic flaw / scene pressure
```

### Other visible Lovable projects from the user's workspace

The user showed a Lovable workspace screenshot with these project titles visible:

- `SceneSmith Studio`
- `VerbBros Academy`
- `Hermes Forge Console`
- `SeedVault Hub & Store`
- `personality-insight-analyzer`
- `Emerald Edge`
- `Cyber Canvas Studio`
- `Daddy Jack's Jerky`
- `chic-etch-studio`
- `story-voyage-ai`
- `Vector Art Studio`
- `Persona Insights`
- `dice-strategy-oracle`

Use only the relevant source projects for Academy work:

```text
SceneSmith Studio → implementation target
VerbBros Academy → ITS/adaptive lesson design
personality-insight-analyzer / Persona Insights → PfHU/profile adaptation
The Moral Hierarchy → character morality under pressure
```

Do not pull unrelated UI from retail, engraving, logistics, crypto, dice, or design projects unless the user explicitly asks.

---

## 4. Academy mission

SceneSmith Academy helps writers finish better scripts by turning craft theory into applied project work.

The Academy should help the writer:

1. understand a craft concept,
2. see why it matters,
3. view a concrete example,
4. apply it to their own project,
5. check whether it works,
6. revise if needed,
7. return to writing.

The Academy is successful when the writer produces better artifacts:

- a sharper logline
- a protagonist with want, need, wound, lie, fear, voice, and contradiction
- an antagonist who pressures the protagonist's value system
- a theme statement that guides choices
- a story arc with moral pressure and transformation
- scene cards with turns and stakes
- an opening scene that keeps its promise
- an Act 1 threshold
- a midpoint shift
- a finished rough draft
- a table read with useful notes
- a pitch package that sells the story

Academy should never ask the user to learn something without immediately connecting it to their own project.

---

## 5. Teaching philosophy

Use the SceneSmith Academy teaching loop:

```text
Concept
→ Why it matters
→ Example
→ Try it now
→ Apply to your project
→ Check the work
→ Move forward
```

### Concept

Name the craft idea in plain language.

Bad:

```text
Today we will learn about protagonist-objective antagonistic vector theory.
```

Good:

```text
Your protagonist needs a want they chase and a need they resist.
```

### Why it matters

Explain the consequence of ignoring the concept.

Example:

```text
If the want is unclear, scenes drift. If the need is missing, the story has no transformation.
```

### Example

Use a short, cinematic example. Avoid long lectures.

Example:

```text
Want: win the trial.
Need: admit he has been using charm to avoid truth.
Wound: he believes being honest makes him weak.
```

### Try it now

Ask one focused question or give one small task.

Example:

```text
What does your protagonist want badly enough to make mistakes for?
```

### Apply to your project

Write to actual project data when possible: project, character, story arc, scene, script blocks, pitch, or table read notes.

### Check the work

Use deterministic checks first. Use AI only when explicitly invoked and where existing architecture supports it.

### Move forward

Return the writer to the page or the relevant project surface.

---

## 6. Modes and adaptation

Academy must adapt to the writer's mode and coaching preference.

Current signals:

- `user_onboarding.preferred_mode`: `guided | studio`
- `user_onboarding.coaching_level`: `off | gentle | active | teaching`
- `user_onboarding.writer_experience_level`: currently values such as `first`, `guided`, `experienced`, `adapting`, `pitching`

Current supporting code:

- `src/hooks/use-onboarding.ts`
- `src/lib/onboarding.functions.ts`
- `src/lib/story-intelligence/writerProfileSignals.ts`
- `src/lib/story-intelligence/truthCoach.ts`

### Focus Mode

Focus Mode is sacred.

Academy should disappear unless summoned. It must not interrupt the page, steal focus, open drawers unexpectedly, or add visible chrome.

Rules:

- no auto-opening lessons
- no persistent Academy panel
- no chips unless explicitly part of writing-speed UX and approved for Focus
- no interruption while typing
- no AI prompts popping up

### Basic Mode

Basic Mode is for first-time or guided writers.

Behavior:

- one concept at a time
- plain language
- short examples
- one next action
- no unexplained jargon
- no giant theory dumps
- fewer options
- more encouragement
- less evidence noise
- clear mastery checks

Basic Mode should feel like:

```text
Here is what this means.
Here is why it matters.
Here is your next move.
```

### Advanced Mode

Advanced Mode is for writers who want power, diagnostics, and control.

Behavior:

- fewer explanations by default
- deeper craft language when useful
- evidence available
- diagnostics available
- structural alternatives
- high-level tradeoffs
- no condescending tutorial tone

Advanced Mode should feel like:

```text
Here is what is structurally happening.
Here are the consequences.
Here are your options.
```

### Coaching off

When coaching is off, Academy should not nag.

Behavior:

- no unsolicited teaching
- no lesson prompts unless user opens Academy
- no next-step coaching
- simple navigation only

---

## 7. ITS integration doctrine

SceneSmith should adapt VerbBros ITS patterns without rebuilding VerbBros inside SceneSmith.

Borrow the architecture, not the domain.

### VerbBros pattern

```text
Learner profile
→ current objective
→ lesson flow
→ interaction evidence
→ repair loop
→ mastery gate
→ next objective
```

### SceneSmith adaptation

```text
Writer profile
→ current project objective
→ Academy step
→ project evidence
→ rewrite/repair prompt
→ craft readiness signal
→ next writing action
```

### SceneSmith ITS responsibilities

The Academy ITS layer should eventually:

1. know what the writer is trying to build,
2. know which craft concept is currently relevant,
3. detect whether the current project artifact is missing required elements,
4. teach only the next useful concept,
5. send the writer to the right feature/page,
6. verify output readiness,
7. adapt explanation depth based on PfHU signals.

### ITS must not

- block the writer from writing,
- require lessons before opening the page,
- auto-edit the script,
- replace craft with AI output,
- nag advanced users,
- overwhelm beginners with full theory.

---

## 8. PfHU integration doctrine

PfHU means Profile for Human Understanding.

In SceneSmith, PfHU should understand the writer well enough to adapt the guidance, not manipulate or over-profile them.

Current PfHU-lite implementation exists in:

- `src/lib/story-intelligence/writerProfileSignals.ts`
- `src/lib/story-intelligence/truthCoach.ts`
- `src/components/characters/WouldTheyDoThisTab.tsx`

It currently uses onboarding signals to shape Truth Check guidance.

### Academy PfHU signals

Use existing fields first:

```ts
preferred_mode: "guided" | "studio"
coaching_level: "off" | "gentle" | "active" | "teaching"
writer_experience_level: string
```

Do not add persistent PfHU logs until a separate product/architecture document approves it.

### Future PfHU signals

Future signals may include:

- repeated missing craft fields
- where the writer asks for help
- which examples they open
- whether they ignore or complete tasks
- whether they prefer theory or direct action
- whether they write in screenplay, prose, YouTube, stand-up, or pitch mode
- whether they respond better to diagnosis, teaching, examples, or templates

These must be opt-in or carefully scoped. Do not silently build surveillance-like tracking.

### PfHU adaptation examples

If writer is `first` + `guided`:

```text
Teach plainly. Show one example. Ask one question. Route to the right builder step.
```

If writer is `experienced` + `studio`:

```text
Show concise diagnostic. Skip the beginner definition. Offer alternatives.
```

If writer has `coaching_level = off`:

```text
Do not surface Academy guidance unless user opens it.
```

If writer chooses `adapting`:

```text
Emphasize translation from source material: what becomes a scene, what becomes voiceover, what must be externalized.
```

If writer chooses `pitching`:

```text
Emphasize clarity, market promise, reader-facing assets, and producer-room framing.
```

---

## 9. Character Truth Engine relationship

Academy should use the Character Truth Engine to teach character logic.

The Character Truth Engine answers:

```text
Would this character say or do this?
```

Academy answers:

```text
What does the writer need to understand or fill in so the character works?
```

### Example: missing wound

Engine result:

```text
verdict: insufficient_data
missingInputs: wound
```

Academy teaching:

```text
A wound is the past hurt that makes a character overreact under pressure.
What past hurt still controls this character?
```

Project action:

```text
Open Guided Character Builder → Wound step
```

### Example: stress regression

Engine result:

```text
A high-integrity character can regress under pressure if the scene makes the pressure visible.
```

Academy teaching:

```text
A character can betray their baseline if the scene cornered them hard enough.
Show the pressure on the page before the choice.
```

Project action:

```text
Return to editor → revise scene pressure beat
```

### Example: voice mismatch

Engine result:

```text
Dialogue is florid but the character voice is clipped and guarded.
```

Academy teaching:

```text
Voice is not just what a character says. It is what they avoid saying.
Try one short sentence and let silence carry the second beat.
```

Project action:

```text
Open Voice step or revise dialogue line
```

---

## 10. Current Academy implementation snapshot

Current code provides a useful starting point.

### Existing step seed

`src/lib/academy.server.ts` defines 13 guided steps:

1. `create_project`
2. `logline`
3. `protagonist`
4. `antagonist`
5. `theme`
6. `story_arc`
7. `scene_cards`
8. `opening_scene`
9. `act1`
10. `midpoint`
11. `rough_draft`
12. `table_read`
13. `pitch`

### Existing step behavior

`src/lib/academy.functions.ts` can:

- seed project guided steps,
- list guided steps,
- update status,
- auto-unlock the next step,
- apply step output to project data,
- create characters from generated protagonist/antagonist output,
- save logline and story arc data,
- create scene cards,
- append script blocks.

### Existing lesson metadata

`src/components/guided/stepMeta.ts` currently stores:

```ts
concept
why
example
task
aiHelper
aiLabel
destination
```

This is useful, but it is not yet a full Academy model.

### Existing StepCoach UI

`src/components/editor/StepCoach.tsx` currently shows:

- guided step label,
- concept,
- task,
- progress checks,
- primary action,
- mark complete,
- example toggle,
- back to guided path.

This is the right base component, but future Academy work should make the lesson/action/check loop stronger.

---

## 11. Curriculum spine: First Screenplay Path

The current 13-step path should remain the first Academy curriculum spine.

Each step should eventually have:

- learning goal,
- artifact created,
- feature/page used,
- mastery signal,
- Basic Mode explanation,
- Advanced Mode diagnostic angle,
- PfHU adaptation notes.

### 1. Create Project

Learning goal: Understand that a project has format, tone, genre, and length constraints.

Artifact: project record.

Feature/page: new project dialog / dashboard.

Mastery signal: project exists with title and project type.

Basic explanation:

```text
Your project is the container for your story. Format, tone, and genre help SceneSmith guide the next steps.
```

Advanced diagnostic angle:

```text
Format determines pacing, structural density, and pitch expectations.
```

### 2. Logline

Learning goal: Compress the story into protagonist, goal, obstacle, stakes, and hook.

Artifact: project logline.

Feature/page: logline composer / project metadata.

Mastery signal: 25-40 word logline with protagonist, goal, obstacle, stakes.

Basic explanation:

```text
A logline is your story in one sentence.
```

Advanced diagnostic angle:

```text
A weak logline reveals a weak story engine.
```

### 3. Protagonist

Learning goal: Define want, need, wound, fear, lie, contradiction, voice, and moral pressure profile.

Artifact: protagonist character profile.

Feature/page: Casting Wall / Guided Character Builder.

Mastery signal: protagonist has external goal, internal need, wound, core lie, fear, baseline/stress behavior.

Basic explanation:

```text
Your protagonist needs something they chase and something deeper they resist.
```

Advanced diagnostic angle:

```text
The protagonist's need should collide with their strategy for getting the want.
```

### 4. Antagonist

Learning goal: Build opposition that pressures the protagonist's values.

Artifact: antagonist character profile.

Feature/page: Casting Wall / Guided Character Builder.

Mastery signal: antagonist has want, pressure function, worldview, moral contrast, and relationship to protagonist conflict.

Basic explanation:

```text
The antagonist is not just bad. They force your hero to reveal who they are.
```

Advanced diagnostic angle:

```text
A strong antagonist is an alternate answer to the theme.
```

### 5. Theme

Learning goal: Turn topic into moral argument.

Artifact: theme statement.

Feature/page: Story Arc page.

Mastery signal: theme is a debatable sentence, not a topic.

Basic explanation:

```text
Theme is what your story is trying to prove.
```

Advanced diagnostic angle:

```text
Theme should pressure choices, not decorate dialogue.
```

### 6. Story Arc

Learning goal: Track protagonist transformation across the story.

Artifact: story arc record.

Feature/page: Story Arc page.

Mastery signal: opening state, midpoint shift, darkest moment, climax choice, final state.

Basic explanation:

```text
Your story arc is how the character changes because of what happens.
```

Advanced diagnostic angle:

```text
Arc movement should be visible through choices, not speeches.
```

### 7. Scene Cards

Learning goal: Plan the story as ordered scene units with purpose and turn.

Artifact: scene cards.

Feature/page: Scenes page / Script Map.

Mastery signal: each scene has heading, purpose, conflict/turn, and rough order.

Basic explanation:

```text
A scene card says what happens and why the scene belongs.
```

Advanced diagnostic angle:

```text
Every scene should shift value, reveal information, or force a choice.
```

### 8. Opening Scene

Learning goal: Make a promise about tone, genre, conflict, and story energy.

Artifact: opening scene script blocks.

Feature/page: Writer's Desk.

Mastery signal: opening scene establishes tone, visual action, protagonist/world pressure, and a question.

Basic explanation:

```text
The opening tells the reader what kind of story they are entering.
```

Advanced diagnostic angle:

```text
A great opening creates a contract with the audience.
```

### 9. Act 1

Learning goal: Move from setup to irreversible threshold.

Artifact: Act 1 outline or script pages.

Feature/page: Writer's Desk / Script Map.

Mastery signal: protagonist crosses a threshold and cannot simply return to normal.

Basic explanation:

```text
Act 1 ends when your character steps into the real story.
```

Advanced diagnostic angle:

```text
If the protagonist can still walk away, Act 1 has not locked.
```

### 10. Midpoint

Learning goal: Create a false win/false defeat that changes the story's direction.

Artifact: midpoint shift.

Feature/page: Story Arc / Scenes.

Mastery signal: midpoint changes goal, stakes, or understanding.

Basic explanation:

```text
The midpoint is the moment the story turns into a different kind of problem.
```

Advanced diagnostic angle:

```text
A midpoint should recontextualize the first half and weaponize the second.
```

### 11. Rough Draft

Learning goal: Finish a full pass before over-polishing.

Artifact: complete draft.

Feature/page: Writer's Desk.

Mastery signal: screenplay reaches end state / FADE OUT / complete draft threshold.

Basic explanation:

```text
Bad pages can be fixed. Missing pages cannot.
```

Advanced diagnostic angle:

```text
Draft completion creates the object revision can operate on.
```

### 12. Table Read

Learning goal: Hear dialogue, pacing, and scene rhythm.

Artifact: table read session / notes.

Feature/page: Table Read Studio.

Mastery signal: writer records or reviews performance notes.

Basic explanation:

```text
Your ear catches problems your eyes miss.
```

Advanced diagnostic angle:

```text
Performance reveals dead beats, exposition, and false emotional turns.
```

### 13. Pitch Package

Learning goal: Turn the project into a reader/producer-facing asset.

Artifact: pitch package.

Feature/page: Pitch page.

Mastery signal: logline, synopsis, tone statement, character summary, comparable framing, and next-step pitch materials.

Basic explanation:

```text
A pitch package helps someone understand why they should read the script.
```

Advanced diagnostic angle:

```text
Pitch materials translate craft into market clarity.
```

---

## 12. Lesson object model

Future Academy work should evolve beyond the current `STEP_META` shape.

A future-friendly lesson model:

```ts
type AcademyLesson = {
  id: string;
  stepKey?: string;
  title: string;
  concept: string;
  why: string;
  example: string;
  exercise: string;
  projectOutput: string;
  masteryCheck: string;
  beginnerPrompt?: string;
  advancedPrompt?: string;
  relatedFeature?: "editor" | "characters" | "story_arc" | "scenes" | "pitch" | "table_read";
  relatedFields?: string[];
  truthEngineHooks?: Array<"missing_wound" | "voice_mismatch" | "weak_pressure" | "flat_arc">;
  pfhuTags?: Array<"beginner" | "adapting" | "pitching" | "advanced" | "teaching">;
};
```

Do not require a DB schema change just to introduce this model. A first pass can live in TypeScript as metadata.

---

## 13. Mastery checks

Academy should not mark progress only because the user clicked a button.

Prefer artifact-based checks.

Examples:

### Logline mastery

Check for:

- not empty,
- 15-60 words,
- protagonist or subject present,
- goal/action present,
- obstacle/stakes language present.

### Character mastery

Check for:

- external goal,
- internal need,
- wound,
- fear,
- core lie,
- voice clue,
- baseline/stress behavior.

### Scene mastery

Check for:

- scene heading,
- visible action,
- purpose/turn,
- pressure/stakes,
- at least one change from beginning to end.

### Pitch mastery

Check for:

- logline,
- synopsis,
- tone statement,
- character summary,
- why now / why this story,
- next asset.

Mastery checks must not become rigid blockers. They should guide, not trap.

---

## 14. Academy UX rules

Academy must not bury the page.

Rules:

1. Teach briefly.
2. Apply immediately.
3. Return to writing.
4. Never open giant lessons inside the editor by default.
5. Never block typing with a lesson.
6. Never make the user complete a course before writing.
7. Never auto-overwrite project data.
8. Never invent permanent story facts without approval.
9. Keep lessons summonable.
10. Use one next action in Basic Mode.
11. Use diagnostics and evidence in Advanced Mode.
12. Keep Focus Mode sacred.

Academy surfaces may include:

- a compact StepCoach card,
- a lesson drawer,
- a guided builder step,
- a small example popover,
- a project artifact checklist,
- a post-analysis next-step card.

Academy should not become:

- a giant sidebar always open,
- a modal that interrupts typing,
- a course dashboard that delays writing,
- a chatbot wall of text,
- a gamified distraction.

---

## 15. Academy and AI

Academy may use AI only where existing AI architecture supports it and the user asks.

AI can:

- generate options,
- diagnose,
- suggest rewrites,
- create examples,
- explain craft,
- draft starter material.

AI must not:

- overwrite user work without consent,
- mark a step complete by itself,
- invent canon and save it without user review,
- replace the writer's decision,
- become the main Academy identity.

The Academy should be a writing school, not an AI demo.

---

## 16. First implementation phases

### Phase 1 — Doctrine and richer metadata

Create this document and use it as the feature-specific guide for Academy.

Then extend `STEP_META` or create a new typed lesson metadata module with:

- exercise,
- project output,
- mastery check,
- beginner prompt,
- advanced prompt,
- related fields,
- related feature,
- PfHU tags.

No schema change required.

### Phase 2 — Guided Character Builder integration

Use Truth Check missing inputs to route the writer into the right Character Builder step.

Example:

```text
Truth Check missing wound
→ open Character Builder: Wound step
→ ask one useful question
→ save only wound field
→ return to Truth Check or editor
```

Rules:

- never overwrite user text,
- fill empty fields only unless user confirms replacement,
- respect Basic/Advanced/PfHU signals,
- keep the writer oriented.

### Phase 3 — Academy lesson drawer

Build a reusable `AcademyLessonDrawer` or `AcademyLessonCard` that can be summoned from:

- StepCoach,
- Guided Character Builder,
- Scenes page,
- Story Arc page,
- Truth Check,
- eventually the editor.

The drawer should show:

- concept,
- why,
- example,
- exercise,
- project field/action,
- mastery check.

### Phase 4 — Applied exercises

Every lesson writes to actual project artifacts.

Examples:

- logline lesson writes to `projects.logline`,
- character wound lesson writes to `characters.wound`,
- midpoint lesson writes to `story_arcs.midpoint_shift`,
- scene turn lesson writes to `scenes` or `character_scene_states`,
- pitch lesson writes to pitch assets.

### Phase 5 — PfHU-informed lesson depth

Use `writerProfileSignals`-style logic to adapt Academy lesson depth.

Examples:

- `first` → more teaching and examples,
- `guided` → one next action,
- `adapting` → source-to-scene translation help,
- `experienced` → diagnostics,
- `pitching` → sellable assets and market clarity,
- `coaching_level = off` → no unsolicited Academy prompts.

### Phase 6 — Academy Library

Only after applied lessons work, add a searchable Academy Library.

The Library should organize lessons by craft domain:

- Story Foundations,
- Character,
- Scene Craft,
- Structure,
- Dialogue,
- Genre,
- Revision,
- Table Read,
- Pitch.

The Library is secondary. Applied lessons come first.

---

## 17. First Lovable implementation prompt after this doc

Use this prompt after this document is merged:

```md
# SceneSmith Academy — Phase 1 Metadata Upgrade

Read:

- `AGENTS.md`
- `docs/SCENESMITH_ACADEMY.md`
- `src/components/guided/stepMeta.ts`
- `src/components/editor/StepCoach.tsx`
- `src/lib/story-intelligence/writerProfileSignals.ts`
- `src/lib/story-intelligence/truthCoach.ts`

Goal:

Upgrade Academy step metadata without changing database schema or editor behavior.

Create a richer TypeScript lesson metadata shape that extends the current guided step metadata with:

- exercise
- projectOutput
- masteryCheck
- beginnerPrompt
- advancedPrompt
- relatedFields
- pfhuTags

Do not build a full Academy UI yet.

Edit StepCoach only if needed to safely display the new fields behind existing controls such as Show Example or a new Learn Why disclosure.

Respect modes:

- Basic: show concept, one exercise, one next action.
- Advanced: show diagnostic angle and mastery check.
- Focus: no Academy chrome.

Hard boundaries:

- no editor engine changes
- no autosave changes
- no DB schema changes
- no AI calls
- no new route
- no Academy Library yet

Return a plan before coding.
```

---

## 18. What Academy is not

SceneSmith Academy is not:

- a textbook dump,
- a generic writing blog,
- a passive video course,
- a chatbot pretending to teach,
- a prerequisite before writing,
- a gamified toy,
- a dashboard of disconnected lessons,
- an AI-first feature,
- a substitute for the page,
- a place where unfinished product ideas go to hide.

Academy must always lead back to creation.

---

## 19. Non-negotiable boundaries

Do not change these as part of Academy work unless the user explicitly requests it:

- `useScreenplayDocument`
- `ScreenplayLine`
- `screenplayKeymap`
- screenplay persistence
- autosave
- Enter/Tab/slash behavior
- typing behavior
- payments
- webhooks
- entitlements
- database schema

Academy features must preserve:

- local-first writing,
- stable caret,
- no focus loss,
- no first-character loss,
- no duplicate blocks,
- no server echo overwriting active text,
- page-first UX.

---

## 20. North star

SceneSmith Academy should feel like having a world-class writing teacher in the studio, not a class you have to leave the studio to attend.

The writer should feel:

```text
I know what to do next.
I understand why it matters.
I can apply it immediately.
My project is getting better.
I am still the writer.
```

That is the Academy.
