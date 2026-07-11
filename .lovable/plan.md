# Characters System Rebuild — Plan

Your diagnosis is right, and it matches what I see in the code: `CastCleanupPanel` opens by default at the top of the route, `DetectedSpeakersPanel` is buried below the cast grid, `CharacterProfileDialog` has 11 tabs, and detected screenplay text is written straight into `public.characters` rather than into a candidate layer. The fix is architectural, not cosmetic.

Below is the plan. I'm proposing to ship it in five passes so each one is independently verifiable and reversible.

---

## Product principles (locking these in first)

1. **Detection creates candidates, never characters.** Nothing the parser finds is canonical until a human accepts it.
2. **Three data tiers** on every character: canonical (human-approved), behavioral (inferred), temporal (scene-state). Inferred values never overwrite canon.
3. **One name everywhere: "Characters."** "Casting Wall" survives only as the label of the card view.
4. **Guided and Advanced are two shapes of the same data**, gated by onboarding signals — not two schemas.
5. **Truth Check is a verb, not a tab** — invoked from scene, dialogue, relationship, or profile context.

---

## Pass 1 — Candidate integrity (stop the bleeding)

New table `character_candidates`:

```text
id, project_id, detected_name, normalized_name,
source_block_ids[], dialogue_line_count, scene_count,
candidate_type: speaker | mentioned | possible_duplicate,
confidence numeric, status: pending | accepted | ignored | rejected,
merged_into_character_id, first_seen_at, last_seen_at
```

- RLS scoped via `is_project_member` / `can_edit_project`; standard GRANTs.
- Detection pipeline (`src/lib/import/**`, `voiceCheck.functions.ts`, sync paths) writes here, not into `characters`.
- Promotion RPC `accept_character_candidate(_id, _overrides)` inserts into `characters` with provenance and marks candidate `accepted`.
- Existing parser structural rejects stay; candidates additionally require ≥1 real dialogue block before surfacing as `speaker`.
- Server-side dedupe by `normalized_name` (uppercase, strip parentheticals, collapse whitespace).

## Pass 2 — Existing-data repair (one-time, reversible)

- Migration classifies existing `characters` rows into: `keep`, `quarantine_obvious` (scene headings, transitions, act labels, punctuation-only, time-of-day tails), `review` (ambiguous), `merge_duplicate`.
- Auto-quarantine only the obvious structural set into a new `characters.quarantined_at` column (soft-delete); everything else surfaces in the Detected Characters inbox.
- Snapshot table `character_repair_snapshots` stores pre-repair rows for 30-day undo; expose a "Restore" action.
- Screenplay text is never touched. Scene/script_block references to quarantined rows are preserved via provenance.

## Pass 3 — Landing page redesign

Route: `/characters/:projectId` (routing unchanged; UI rebuilt).

```text
Characters                                    Review 15 · + Character
Build your cast and protect character truth.

[Cast] [Relationships] [Arc]                  Search…

Filters (left rail)                Cards grid (right)
  All 13
  Importance: Main/Supporting/Minor
  Function: Protagonist/Antagonist/Mentor/Foil/Catalyst/Love/Comic/Custom
  Needs attention 3
```

- Remove default-open `CastCleanupPanel`. Cleanup + detected speakers merge into one `<DetectedCharactersInbox>` drawer opened by the "Review N" chip.
- Remove the permanent right inspector on iPad/desktop. Clicking a card opens the full Character Workspace (see Pass 4).
- Split legacy filter buckets: **Importance** (Main/Supporting/Minor/Unassigned) and **Story function** (Protagonist/Antagonist/Mentor/Foil/Catalyst/Love/Comic/Custom). Existing `type`/category data migrates into the new axes.
- New card body: name, function · importance, one-line want, one-line pressure, arc summary, scene count, relationship count, profile-strength label ("Seed / Developing / Rounded / Deep"). Icons get labels or go away.

## Pass 4 — Character Workspace (replaces 11-tab modal)

Full-route workspace `/characters/:projectId/$characterId` — not a modal.

Persistent header: avatar, name, function · importance, profile-strength meter, `Run Truth Check`, `Generate Full` (guarded).

Four sections instead of eleven tabs:

- **Identity** — name/aliases/age/occupation, story role, importance, visual, voice.
- **Psychology** — goal/need/fear/wound/lie/secret/values, attachment, PfHU signals, TMH baseline & ceiling, stress regression.
- **Story** — arc, relationships, scenes, knowledge state, decisions, promises/consequences, contradictions, continuity warnings.
- **Production** — visual refs, casting notes, voice assignment, wardrobe state, performance notes, generator reference pack.

Guided vs Advanced:

- `writerProfileSignals` picks the shape. Guided = one-question-at-a-time Academy flow that writes into the same canonical fields; Advanced = the sectioned professional workspace.
- A visible "Switch to Guided / Advanced" toggle overrides the default per user.
- Every inferred value is rendered as a suggestion chip with **Accept as canon / Dismiss** — nothing gets promoted silently.

## Pass 5 — Intelligence integration

- Formalize the three tiers in the type layer (`CanonicalCharacter`, `BehavioralModel`, `TemporalCharacterState`) and route existing engines to the right tier:
  - `characterTruthEngine`, `truthCoach`, TMH scoring → behavioral.
  - `character_scene_states`, `scene_arc_beats` → temporal.
  - Everything under Identity + user-accepted Psychology → canonical.
- Truth Check becomes a shared action bound to (character, optional scene, optional block). Entry points: scene toolbar, dialogue line menu, relationship card, workspace header, editorial review.
- Feed Production Graph / generator reference packs from canonical + latest temporal snapshot only — never from unpromoted inferences.
- Extend `series continuity` and Academy coaching to consume the same tiered model so onboarding, review, table read, and generation all agree on "who this person is right now."

---

## Technical notes

- **Migrations:** `character_candidates`, `character_repair_snapshots`, `characters.quarantined_at`, `characters.importance` (enum), `characters.story_function` (enum + custom text), plus GRANTs and RLS via existing helpers.
- **Server functions:** `detectCharacterCandidates`, `acceptCharacterCandidate`, `ignoreCharacterCandidate`, `rejectCharacterCandidate`, `mergeCharacters`, `quarantineCharacter`, `restoreQuarantinedCharacter`, `runCharacterTruthCheck({characterId, sceneId?, blockId?})`.
- **Files touched:** `src/routes/_authenticated/characters.$projectId.tsx`, `src/components/characters/*` (cleanup + detected panels collapse into `DetectedCharactersInbox`; `CharacterProfileDialog` retires in favor of `CharacterWorkspace`), `src/lib/characters/*`, `src/lib/import/parser.ts` (candidate emission), `src/lib/story-intelligence/*` (tier plumbing), `StudioMenu` label to "Characters".
- **Tests:** parser → candidates (never characters); repair migration classification snapshot; workspace routing + Guided/Advanced signal resolution; Truth Check invocation from all four entry points; RLS on new tables.
- **i18n:** all new copy through `t()`; add keys under `characters.*`, `characters.candidates.*`, `characters.workspace.*`.
- **Route Matrix / gating:** update `studioMenuManifest` label + `RouteReadinessGate` empty state for zero-character projects.

---

You’re right. Lovable’s plan is architecturally strong, but it still reads like a database refactor with a new route attached.

It says what the system should store and how the workflow should be divided, but not what the user should actually experience.

The missing layer is:

**Interaction design, visual hierarchy, and emotional clarity.**

For a Character system this important, that cannot be implied. It needs to be specified.

**What is still missing from Lovable’s plan**

**1. No visual design language**

There is no guidance for:

- page composition
- card density
- typography hierarchy
- use of color
- empty states
- progressive disclosure
- iPad behavior
- motion
- icon meaning
- visual emphasis
- what should feel cinematic versus administrative

Without that, Lovable may rebuild the same clutter with cleaner data.

**2. No primary user journey**

The plan needs to define what happens when:

- a first-time writer opens Characters
- an experienced writer opens Characters
- the parser detects a new speaker
- a writer creates a character manually
- the writer wants to understand one character quickly
- a senior editor wants to inspect consistency
- a showrunner wants continuity status

Those users should not all see the same experience.

**3. No clear “at a glance” promise**

The page should immediately answer:

Who matters?

Who is underdeveloped?

Who is contradictory?

Who appears where?

Who changed?

Who needs review?

The current plan describes filters and cards, but not the visual hierarchy that makes those answers obvious.

**4. No mobile/iPad interaction model**

This is critical because your screenshots show iPad landscape use.

The plan needs to explicitly say:

- no three-column permanent layout
- no oversized modal
- no horizontal tab strip with eleven items
- no dense maintenance panel above the real content
- no tiny unlabeled icons
- no destructive actions in the main browse state

**5. No “delight”**

This is still a creative app.

The Character system should feel like opening a living cast bible, not a CRM.

There should be visual warmth, character portraiture, status, momentum, and narrative identity.

&nbsp;

**What I would add: Character Experience Doctrine**

Lovable should add a dedicated UX section to the plan.

**Product experience goal**

The Characters system should feel like a living cast bible: cinematic, calm, intelligent, and immediately understandable.

It should not feel like:

- database administration
- parser cleanup
- enterprise CRM
- an AI dashboard
- a form library
- a spreadsheet with portraits

**Visual hierarchy**

The page should have four layers of attention:

**1. Project cast summary**

A slim top summary:

13 Characters

4 Main

6 Supporting

3 Need Attention

2 Detected

This should be visually light.

**2. Character cards**

The main visual surface.

Cards should emphasize:

- portrait or monogram
- name
- importance
- function
- one-line want
- one-line pressure
- arc direction
- scene count
- profile strength

**3. Review inbox**

A compact status chip or side drawer.

Not a giant warning box.

**4. Character workspace**

A full focused screen.

No background clutter.

&nbsp;

**Better landing page structure**

**Desktop / iPad landscape**

┌───────────────────────────────────────────────────────────┐

│ Characters                                  + Character   │

│ Build your cast and protect character truth.              │

│                                                           │

│ 13 Characters   3 Need Attention   2 Detected             │

├───────────────────────────────────────────────────────────┤

│ Cast | Relationships | Arc                                │

│ Search...                                  Filter ▾       │

├───────────────────────────────────────────────────────────┤

│                                                           │

│ [Character Card] [Character Card] [Character Card]        │

│ [Character Card] [Character Card] [Character Card]        │

│                                                           │

└───────────────────────────────────────────────────────────┘

The sidebar filters can become a drawer or compact filter control on iPad.

That will give the cast room to breathe.

**Character card design**

The current cards feel busy and technical.

A better card:

[Portrait]

&nbsp;

STEPHAN

Main · Protagonist

&nbsp;

Wants to return home without becoming

the man war demands.

&nbsp;

Pressure

Cowardice disguised as caution

&nbsp;

Arc

Avoidance → Courage

&nbsp;

12 scenes · 3 relationships

&nbsp;

Profile: Developing

Actions should be simple:

Open Character

More ···

No unexplained icon strip.

**Visual states**

Use restrained state colors:

- neutral for healthy
- amber for needs attention
- red only for conflict or serious continuity issue
- blue/purple for inferred intelligence
- green for approved/canonical

Do not flood the page with warnings.

&nbsp;

**Better Detected Characters experience**

This should feel like a review inbox, not a cleanup tool.

Button:

Review 15 detected items

Drawer:

Detected Characters

&nbsp;

Suggested

HANS

24 lines · 8 scenes

[Add] [Ignore]

&nbsp;

Needs Repair

CUT TO:

Likely transition

[Remove] [Rename]

&nbsp;

Possible Duplicate

HANS

Matches HANS (12 scenes)

[Merge] [Keep Separate]

Each item should show:

- why it was detected
- confidence
- source scenes
- what will happen
- safe action
- undo

The user should never have to interpret raw parser errors.

&nbsp;

**Character workspace experience**

Lovable’s four-section architecture is right, but the interaction needs more thought.

**Persistent top summary**

STEPHAN

Main · Protagonist

&nbsp;

Wants: Return home

Needs: Moral courage

Pressure response: Avoidance

TMH: L3 → L6 potential

Arc: Avoidance → Courage

&nbsp;

Run Truth Check

This gives immediate orientation.

**Section navigation**

Use a vertical or compact segmented nav:

Identity

Psychology

Story

Production

Inside each section, use grouped cards, not one giant form.

**Identity**

Basic Identity

Story Function

Visual Identity

Voice

**Psychology**

Want & Need

Wound & Lie

Fear & Secret

Values & Moral Pressure

**Story**

Arc

Relationships

Scene Presence

Continuity

**Production**

Casting

Voice

Wardrobe

Visual Reference

Generator Pack

**Guided mode**

The guided mode should not show the full advanced navigation.

It should feel like a conversation:

Let’s build Stephan.

&nbsp;

What does Stephan want more than anything right now?

Then:

Why can’t he simply get it?

Then:

What part of himself is he protecting?

A clear progress marker:

3 of 8

And a button:

Save & Continue

The current guided dialog is technically one-question-at-a-time, but still surrounded by all the advanced tabs. That defeats the purpose.

**Advanced mode**

Advanced mode can show the full structured workspace.

The toggle should be visible but quiet:

Guided | Advanced

Not “basic” versus “advanced,” because “basic” can sound inferior.

&nbsp;

**Senior editor view**

This is another missing piece.

The Character system should support a review lens:

Character Integrity

Voice Consistency

Moral Alignment

Relationship Continuity

Arc Progression

Scene Contradictions

A senior editor should see:

STEPHAN

&nbsp;

Character Integrity: Strong

Voice Drift: 2 scenes

Moral Regression: Explained

Arc Continuity: 1 warning

Relationship Contradictions: 0

Then click into evidence.

This should eventually be a review mode, not mixed into the writer’s creation form.

&nbsp;

**Motion and polish**

Subtle only:

- cards fade/slide in on filter change
- accepted candidate animates into the cast
- profile-strength meter updates smoothly
- saved-state feedback is quiet
- drawer transitions are fast
- no full-page spinners when avoidable
- skeletons preserve layout
- no modal-on-modal behavior

**Accessibility**

Specify:

- minimum tap target sizes for iPad
- keyboard navigation
- visible focus states
- descriptive icon labels
- no color-only status
- screen-reader labels for profile strength and warnings

&nbsp;

**Naming system**

Lock this down:

Global menu: Characters

Page title: Characters

Card view: Cast

Review system: Detected Characters

Individual screen: Character

Analysis action: Truth Check

Do not use “Casting Wall” as the global feature name.

It can remain a visual metaphor in copy:

Cast View

but not as a second product name.

&nbsp;

**Acceptance criteria should include UX**

Lovable’s current test plan is mostly technical.

Add:

**Landing page UX**

- user understands the page purpose within 5 seconds
- no cleanup panel dominates the page
- no unlabeled icons
- primary action is obvious
- detected items are visible but non-intrusive
- cards are readable on iPad landscape
- no permanent inspector on iPad
- empty state explains what to do next

**Guided workflow**

- beginner can create a useful character without seeing advanced terminology
- user can pause and resume
- progress is visible
- no advanced tabs appear unless requested
- every answer maps to canonical fields

**Advanced workflow**

- professional can reach any field in two interactions or fewer
- character summary remains visible
- Truth Check is accessible from the header
- continuity warnings link to evidence
- inferred values are visually distinct from canon

**Detected Characters**

- user understands why each item appears
- user can add, ignore, merge, rename, or remove
- every action is reversible
- no parser output silently becomes canon

&nbsp;

**What I would send back to Lovable**

The architecture is approved, but the plan is incomplete without a dedicated Character Experience pass.

Do not treat the new landing page and workspace as ordinary route rebuilds. Add a UX specification covering:

- visual hierarchy
- iPad-first responsive behavior
- guided and professional user journeys
- character-card design
- Detected Characters inbox interaction
- workspace layout
- canonical versus inferred visual treatment
- senior editor review view
- accessibility
- motion and save feedback
- user-facing acceptance criteria

The Characters landing page must feel like a living cast bible, not a database console.

Remove the permanent right inspector, giant warning panel, unlabeled icon rows, and eleven-tab modal.

Use one consistent naming system:

- Characters
- Cast
- Detected Characters
- Character
- Truth Check

Guided users should see a focused one-question-at-a-time flow with no advanced tabs visible. Advanced users should see a professional four-section workspace.

Add explicit iPad acceptance tests using the current landscape dimensions shown in the screenshots.

Before implementation, produce low-fidelity wireframes for:

1. Characters landing page
2. Detected Characters drawer
3. Guided Character flow
4. Advanced Character workspace
5. Senior Editor review lens

Do not begin Pass 3 or Pass 4 until those wireframes are approved.

That last condition matters.

The data-layer work can begin now, but the visual rebuild should not start until Lovable shows the page structure first. Otherwise we risk getting a technically cleaner version of the same clutter.You’re right. Lovable’s plan is architecturally strong, but it still reads like a database refactor with a new route attached.

It says what the system should store and how the workflow should be divided, but not what the user should actually experience.

The missing layer is:

**Interaction design, visual hierarchy, and emotional clarity.**

For a Character system this important, that cannot be implied. It needs to be specified.

**What is still missing from Lovable’s plan**

**1. No visual design language**

There is no guidance for:

- page composition
- card density
- typography hierarchy
- use of color
- empty states
- progressive disclosure
- iPad behavior
- motion
- icon meaning
- visual emphasis
- what should feel cinematic versus administrative

Without that, Lovable may rebuild the same clutter with cleaner data.

**2. No primary user journey**

The plan needs to define what happens when:

- a first-time writer opens Characters
- an experienced writer opens Characters
- the parser detects a new speaker
- a writer creates a character manually
- the writer wants to understand one character quickly
- a senior editor wants to inspect consistency
- a showrunner wants continuity status

Those users should not all see the same experience.

**3. No clear “at a glance” promise**

The page should immediately answer:

Who matters?

Who is underdeveloped?

Who is contradictory?

Who appears where?

Who changed?

Who needs review?

The current plan describes filters and cards, but not the visual hierarchy that makes those answers obvious.

**4. No mobile/iPad interaction model**

This is critical because your screenshots show iPad landscape use.

The plan needs to explicitly say:

- no three-column permanent layout
- no oversized modal
- no horizontal tab strip with eleven items
- no dense maintenance panel above the real content
- no tiny unlabeled icons
- no destructive actions in the main browse state

**5. No “delight”**

This is still a creative app.

The Character system should feel like opening a living cast bible, not a CRM.

There should be visual warmth, character portraiture, status, momentum, and narrative identity.

&nbsp;

**What I would add: Character Experience Doctrine**

Lovable should add a dedicated UX section to the plan.

**Product experience goal**

The Characters system should feel like a living cast bible: cinematic, calm, intelligent, and immediately understandable.

It should not feel like:

- database administration
- parser cleanup
- enterprise CRM
- an AI dashboard
- a form library
- a spreadsheet with portraits

**Visual hierarchy**

The page should have four layers of attention:

**1. Project cast summary**

A slim top summary:

13 Characters

4 Main

6 Supporting

3 Need Attention

2 Detected

This should be visually light.

**2. Character cards**

The main visual surface.

Cards should emphasize:

- portrait or monogram
- name
- importance
- function
- one-line want
- one-line pressure
- arc direction
- scene count
- profile strength

**3. Review inbox**

A compact status chip or side drawer.

Not a giant warning box.

**4. Character workspace**

A full focused screen.

No background clutter.

&nbsp;

**Better landing page structure**

**Desktop / iPad landscape**

┌───────────────────────────────────────────────────────────┐

│ Characters                                  + Character   │

│ Build your cast and protect character truth.              │

│                                                           │

│ 13 Characters   3 Need Attention   2 Detected             │

├───────────────────────────────────────────────────────────┤

│ Cast | Relationships | Arc                                │

│ Search...                                  Filter ▾       │

├───────────────────────────────────────────────────────────┤

│                                                           │

│ [Character Card] [Character Card] [Character Card]        │

│ [Character Card] [Character Card] [Character Card]        │

│                                                           │

└───────────────────────────────────────────────────────────┘

The sidebar filters can become a drawer or compact filter control on iPad.

That will give the cast room to breathe.

**Character card design**

The current cards feel busy and technical.

A better card:

[Portrait]

&nbsp;

STEPHAN

Main · Protagonist

&nbsp;

Wants to return home without becoming

the man war demands.

&nbsp;

Pressure

Cowardice disguised as caution

&nbsp;

Arc

Avoidance → Courage

&nbsp;

12 scenes · 3 relationships

&nbsp;

Profile: Developing

Actions should be simple:

Open Character

More ···

No unexplained icon strip.

**Visual states**

Use restrained state colors:

- neutral for healthy
- amber for needs attention
- red only for conflict or serious continuity issue
- blue/purple for inferred intelligence
- green for approved/canonical

Do not flood the page with warnings.

&nbsp;

**Better Detected Characters experience**

This should feel like a review inbox, not a cleanup tool.

Button:

Review 15 detected items

Drawer:

Detected Characters

&nbsp;

Suggested

HANS

24 lines · 8 scenes

[Add] [Ignore]

&nbsp;

Needs Repair

CUT TO:

Likely transition

[Remove] [Rename]

&nbsp;

Possible Duplicate

HANS

Matches HANS (12 scenes)

[Merge] [Keep Separate]

Each item should show:

- why it was detected
- confidence
- source scenes
- what will happen
- safe action
- undo

The user should never have to interpret raw parser errors.

&nbsp;

**Character workspace experience**

Lovable’s four-section architecture is right, but the interaction needs more thought.

**Persistent top summary**

STEPHAN

Main · Protagonist

&nbsp;

Wants: Return home

Needs: Moral courage

Pressure response: Avoidance

TMH: L3 → L6 potential

Arc: Avoidance → Courage

&nbsp;

Run Truth Check

This gives immediate orientation.

**Section navigation**

Use a vertical or compact segmented nav:

Identity

Psychology

Story

Production

Inside each section, use grouped cards, not one giant form.

**Identity**

Basic Identity

Story Function

Visual Identity

Voice

**Psychology**

Want & Need

Wound & Lie

Fear & Secret

Values & Moral Pressure

**Story**

Arc

Relationships

Scene Presence

Continuity

**Production**

Casting

Voice

Wardrobe

Visual Reference

Generator Pack

**Guided mode**

The guided mode should not show the full advanced navigation.

It should feel like a conversation:

Let’s build Stephan.

&nbsp;

What does Stephan want more than anything right now?

Then:

Why can’t he simply get it?

Then:

What part of himself is he protecting?

A clear progress marker:

3 of 8

And a button:

Save & Continue

The current guided dialog is technically one-question-at-a-time, but still surrounded by all the advanced tabs. That defeats the purpose.

**Advanced mode**

Advanced mode can show the full structured workspace.

The toggle should be visible but quiet:

Guided | Advanced

Not “basic” versus “advanced,” because “basic” can sound inferior.

&nbsp;

**Senior editor view**

This is another missing piece.

The Character system should support a review lens:

Character Integrity

Voice Consistency

Moral Alignment

Relationship Continuity

Arc Progression

Scene Contradictions

A senior editor should see:

STEPHAN

&nbsp;

Character Integrity: Strong

Voice Drift: 2 scenes

Moral Regression: Explained

Arc Continuity: 1 warning

Relationship Contradictions: 0

Then click into evidence.

This should eventually be a review mode, not mixed into the writer’s creation form.

&nbsp;

**Motion and polish**

Subtle only:

- cards fade/slide in on filter change
- accepted candidate animates into the cast
- profile-strength meter updates smoothly
- saved-state feedback is quiet
- drawer transitions are fast
- no full-page spinners when avoidable
- skeletons preserve layout
- no modal-on-modal behavior

**Accessibility**

Specify:

- minimum tap target sizes for iPad
- keyboard navigation
- visible focus states
- descriptive icon labels
- no color-only status
- screen-reader labels for profile strength and warnings

&nbsp;

**Naming system**

Lock this down:

Global menu: Characters

Page title: Characters

Card view: Cast

Review system: Detected Characters

Individual screen: Character

Analysis action: Truth Check

Do not use “Casting Wall” as the global feature name.

It can remain a visual metaphor in copy:

Cast View

but not as a second product name.

&nbsp;

**Acceptance criteria should include UX**

Lovable’s current test plan is mostly technical.

Add:

**Landing page UX**

- user understands the page purpose within 5 seconds
- no cleanup panel dominates the page
- no unlabeled icons
- primary action is obvious
- detected items are visible but non-intrusive
- cards are readable on iPad landscape
- no permanent inspector on iPad
- empty state explains what to do next

**Guided workflow**

- beginner can create a useful character without seeing advanced terminology
- user can pause and resume
- progress is visible
- no advanced tabs appear unless requested
- every answer maps to canonical fields

**Advanced workflow**

- professional can reach any field in two interactions or fewer
- character summary remains visible
- Truth Check is accessible from the header
- continuity warnings link to evidence
- inferred values are visually distinct from canon

**Detected Characters**

- user understands why each item appears
- user can add, ignore, merge, rename, or remove
- every action is reversible
- no parser output silently becomes canon

&nbsp;

**What I would send back to Lovable**

The architecture is approved, but the plan is incomplete without a dedicated Character Experience pass.

Do not treat the new landing page and workspace as ordinary route rebuilds. Add a UX specification covering:

- visual hierarchy
- iPad-first responsive behavior
- guided and professional user journeys
- character-card design
- Detected Characters inbox interaction
- workspace layout
- canonical versus inferred visual treatment
- senior editor review view
- accessibility
- motion and save feedback
- user-facing acceptance criteria

The Characters landing page must feel like a living cast bible, not a database console.

Remove the permanent right inspector, giant warning panel, unlabeled icon rows, and eleven-tab modal.

Use one consistent naming system:

- Characters
- Cast
- Detected Characters
- Character
- Truth Check

Guided users should see a focused one-question-at-a-time flow with no advanced tabs visible. Advanced users should see a professional four-section workspace.

Add explicit iPad acceptance tests using the current landscape dimensions shown in the screenshots.

Before implementation, produce low-fidelity wireframes for:

1. Characters landing page
2. Detected Characters drawer
3. Guided Character flow
4. Advanced Character workspace
5. Senior Editor review lens

Do not begin Pass 3 or Pass 4 until those wireframes are approved.

That last condition matters.

The data-layer work can begin now, but the visual rebuild should not start until Lovable shows the page structure first. Otherwise we risk getting a technically cleaner version of the same clutter.

Absolutely. That should be part of the **Character Bible**, not a disconnected image toy.

The key is that the portrait should be generated **from the approved character model**, not from a shallow prompt like “handsome detective, noir lighting.”

**The right flow**

The character gets built first:

Identity

→ Psychology

→ Story role

→ Visual traits

→ Voice and manner

→ Wardrobe

→ Era and setting

→ Cultural context

→ Emotional baseline

→ Production notes

Then the user reaches:

**Generate Character Portrait**

SceneSmith compiles the approved details into a provider-neutral visual brief and sends it to the selected image provider.

That means the user could choose:

- OpenAI
- Gemini
- Grok
- another supported image model
- future providers

SceneSmith should own the character definition. The provider only renders it.

**Why this matters**

A deep character model gives a much better image brief.

For example, not just:

A German officer in the desert

but:

Male, early 40s, tall but gaunt, sun-damaged skin, restrained posture,

Prussian military bearing weakened by exhaustion, intelligent eyes,

precise mustache, field uniform slightly too formal for the environment,

quietly anxious rather than aggressive, desert campaign setting,

1940s realism, natural light, documentary-style portrait.

The psychology should influence expression, posture, wardrobe condition, and visual energy without turning the prompt into pseudoscience.

**Portrait generation should be staged**

**1. Visual brief**

SceneSmith shows the exact compiled description before generation.

The writer can edit:

- apparent age
- physical features
- ethnicity or cultural background
- body type
- hair
- costume
- era
- expression
- visual style
- framing
- setting

**2. Generate options**

Create several candidates:

Portrait A

Portrait B

Portrait C

Portrait D

**3. Approve one as reference**

The user selects:

**Set as Canonical Portrait**

Nothing generated becomes canon automatically.

**4. Preserve alternate looks**

Other images can remain as:

- alternate casting concept
- younger version
- older version
- flashback version
- injured state
- disguise
- wardrobe variation
- season variation

This becomes very valuable for long stories and world building.

**Character visual continuity**

Once approved, the portrait should feed:

- Character cards
- Writer’s Desk character sidebar
- Scene Board
- Relationships view
- Table Read
- Pitch Deck
- Storyboard
- generator prompt packages
- series continuity
- production design

Eventually SceneSmith should maintain a **Character Visual Reference Pack**:

Canonical portrait

Full-body reference

Profile view

Expression sheet

Wardrobe references

Color palette

Distinctive features

Do-not-change traits

Age variants

Scene-specific states

That pack can then be translated for each generator.

**Important data separation**

The system should distinguish:

**Canonical appearance**

Human-approved facts:

- height
- age range
- build
- face
- hair
- scars
- ethnicity
- defining features

**Visual interpretation**

Generated possibilities:

- portrait
- costume concept
- lighting
- composition
- actor-like visual interpretation

**Temporal appearance**

Scene-specific state:

- injury
- dirt
- age
- wardrobe
- hairstyle
- fatigue
- weather exposure
- disguise

That prevents one generated image from accidentally redefining the character.

**UI placement**

At the end of Guided Character creation:

Your character foundation is ready.

&nbsp;

[Review Character]

[Generate Character Portrait]

In Advanced mode, the same action belongs under **Production → Visual Identity**.

The character card should then show the approved portrait, not an arbitrary generated image.

**Provider architecture**

Do not hard-code the feature around one provider.

Use:

Character Model

→ Visual Brief Compiler

→ Image Provider Adapter

→ Generated Asset

→ Human Approval

→ Canonical Visual Reference

Every generated portrait should retain:

- provider
- model
- prompt
- negative instructions
- reference images
- settings
- cost
- generation date
- character version
- approval status

That gives us reproducibility and future continuity.

**Safety and rights**

The user should be warned against generating the likeness of a real person without rights or consent.

For professional production, each visual asset should store:

- likeness source
- consent status
- rights notes
- actor reference restrictions

**Add this to Lovable’s plan**

I would append:

Add a Character Visual Identity workflow to the Character Bible.

Character portraits must be generated only from human-approved canonical character data plus user-editable production notes.

Implement a provider-neutral Visual Brief Compiler and image-provider adapter interface. Do not bind canonical character data to one provider’s prompt format.

The workflow is:

1. Build character
2. Review compiled visual brief
3. Generate multiple portraits
4. Approve one as canonical
5. Preserve alternates and temporal variants

Generated images are proposed assets, never automatic canon.

The approved portrait must appear on Character cards and become reusable by the Writer’s Desk, Relationships, Table Read, Pitch Deck, Storyboard, Production Graph, and future generator exports.

Add a Character Visual Reference Pack supporting canonical portrait, full-body view, profile, expression sheet, wardrobe variants, age variants, and scene-specific states.

Store provider, model, prompt, reference assets, settings, cost, character version, rights metadata, and approval history for every generated asset.

Guided mode should offer “Generate Character Portrait” only after the core character foundation is complete. Advanced mode should expose it under Production → Visual Identity.

This is exactly the kind of feature visual writers will love because it turns the Character Bible into something they can actually see and emotionally connect with while writing.

&nbsp;

## Sequencing & risk

Ship Pass 1 + 2 together (both are data-layer and mutually dependent), then Pass 3, then Pass 4, then Pass 5. Each pass is behind no feature flag but is additive to what exists; the 11-tab dialog stays reachable via a hidden route until Pass 4 lands so nothing regresses mid-migration.

Approve and I'll start with Pass 1 + 2 (candidate table, detection rewiring, repair migration with snapshot/undo).