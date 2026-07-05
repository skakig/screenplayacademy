# Character Truth Engine

## Purpose

SceneSmith Studio needs a unified story intelligence layer that connects the work already started in characters, relationships, scene states, TMH, and coaching.

This layer is the **Character Truth Engine**.

It answers a writer's most important character question:

> Would this character say this, do this, hide this, betray this person, sacrifice here, or regress under this pressure?

The engine must make SceneSmith feel less like a collection of panels and more like a living studio that understands story behavior.

---

## Product Position

The screenplay editor remains the product.

The Character Truth Engine supports the page. It does not replace the writer, rewrite the screenplay without permission, or turn SceneSmith into a chatbot.

The engine should help the writer understand:

- who a character is
- what pressure reveals
- why a scene changes them
- whether dialogue matches their voice
- whether behavior is earned
- whether relationships are moving
- whether the story's moral arc is coherent

The writer stays in control.

---

## Related Internal Systems

SceneSmith should pull together three internal intelligence ideas that already exist across the user's work:

### TMH — The Moral Hierarchy

TMH is the moral-behavior layer. It models how a person or character behaves under pressure on a 1-9 scale.

In SceneSmith, TMH is not a judgment label. It is story physics.

It helps determine:

- baseline behavior
- stress regression
- aspirational behavior
- shadow behavior
- moral temptation
- moral test
- redemption path
- corruption path

### ITS — Intelligent Tutoring System

ITS is the teaching layer.

It helps the writer understand craft one step at a time, especially in Basic Mode.

In SceneSmith, ITS should:

- explain story concepts simply
- ask one useful question at a time
- diagnose the writer's next obstacle
- teach moral pressure, want/need, wound, voice, scene turns, and relationship shifts
- adapt feedback to beginner vs. advanced users

### PfHU — Profile for Human Understanding

PfHU is the adaptive understanding layer.

It tracks how the writer thinks, where they struggle, what they skip, and what kind of help works.

In SceneSmith, PfHU should eventually learn:

- the writer's experience level
- recurring craft blind spots
- whether they need examples, direct instructions, or diagnostic critique
- which concepts repeatedly require repair
- how much explanation to give before returning to the page

PfHU is for writer coaching. It is not a surveillance layer, and it must not get in the way of writing.

---

## Current State

The repo already contains partial scaffolding:

- TMH levels and labels
- character profile fields
- moral wound / blind spot / temptation / virtue / vice fields
- TMH baseline, stress, aspiration, and shadow fields
- character arc movement fields
- relationship fields such as trust, conflict, public dynamic, private truth, and power dynamic
- scene-state fields such as goal, fear, tactic, moral pressure, relationship shift, secret status, continuity notes, and TMH level in scene
- scene arc diagnostics around purpose, turn, stakes, moral pressure, theme, and relationship change
- AI functions that can generate character, backstory, TMH profile, voice, visual prompt, pressure tests, contradictions, and scene-use suggestions

These are useful pieces, but they are not yet a unified engine.

The goal is not to add more unrelated widgets. The goal is to connect the existing pieces into one coherent reasoning layer.

---

## Core Principle

A character is not a list of traits.

A character is a pattern of behavior under pressure.

The engine should always reason from:

```text
Character core + moral pressure + relationship pressure + scene context + arc position = likely behavior
```

---

## Engine Layers

### 1. Character Core

The stable identity profile.

Inputs may include:

- name
- role
- archetype
- want / external goal
- need / internal need
- wound
- lie
- fear
- secret
- contradiction
- voice style
- speech patterns
- visual identity
- TMH baseline
- TMH stress
- TMH aspirational
- TMH shadow

Questions answered:

- Who are they?
- What do they want?
- What do they need?
- What are they hiding?
- What do they sound like?
- What pressure breaks them?

---

### 2. Moral Pressure Layer

The TMH behavior layer.

Inputs may include:

- baseline TMH
- stress TMH
- aspirational TMH
- shadow TMH
- moral wound
- moral blind spot
- core temptation
- core virtue
- core vice
- moral test
- what they justify
- what they would never do
- what they might do under pressure
- redemption path
- corruption path

Questions answered:

- What do they do when afraid?
- What do they justify?
- What moral line will they not cross?
- What pressure causes regression?
- What choice would prove growth?
- What choice would prove corruption?

---

### 3. Relationship Pressure Layer

The relational behavior layer.

Inputs may include:

- relationship type
- trust level
- conflict level
- public dynamic
- private truth
- power dynamic
- secret between them
- wants from the other
- other wants from them
- relationship arc

Questions answered:

- Who has power in this relationship?
- What does each person want from the other?
- What truth is hidden?
- Who would betray whom?
- Who would protect whom?
- What pressure makes the relationship change?

---

### 4. Scene Behavior Layer

The scene-specific state layer.

Inputs may include:

- scene heading
- scene purpose
- scene turn
- external plot change
- stakes change
- theme connection
- moral pressure
- relationship change
- character goal in scene
- fear in scene
- tactic
- secret status
- emotional state
- TMH level in scene
- source script blocks

Questions answered:

- What does the character want right now?
- What fear is active right now?
- What tactic are they using?
- What moral pressure is present?
- What changes by the end of the scene?
- Does the character move morally, emotionally, or relationally?
- Is the scene doing dramatic work?

---

### 5. Coaching / ITS Layer

The writer-facing teaching layer.

In Basic Mode, the engine should teach.

Examples:

- "Your character needs a want before this scene can work."
- "This is a moral pressure moment. Choose what they are tempted to do."
- "The dialogue sounds clever, but it does not reveal what they fear."
- "This relationship has conflict, but no private truth yet."

In Advanced Mode, the engine should diagnose.

Examples:

- "This action fits the stress profile but contradicts the aspirational arc."
- "The scene applies pressure but does not force a choice."
- "The relationship shift is unearned because the trust/conflict state did not change."
- "The character speaks in the right rhythm, but the subtext is too direct for their voice pattern."

---

## Required Engine Outputs

The engine should prefer structured results over loose prose.

Suggested output shape:

```ts
export type CharacterTruthVerdict =
  | "fits"
  | "strained"
  | "contradicts"
  | "insufficient_data";

export type CharacterTruthResult = {
  verdict: CharacterTruthVerdict;
  confidence: "low" | "medium" | "high";
  reasons: string[];
  suggestedFixes: string[];
  missingInputs: string[];
  evidence: Array<{
    source: "character" | "tmh" | "relationship" | "scene" | "arc" | "script";
    field: string;
    value?: string | number | null;
  }>;
};
```

The evidence field matters. The app should explain what it used, not pretend to know things without support.

---

## Pure Engine Module

Create the engine as pure TypeScript first.

Suggested file:

```text
src/lib/story-intelligence/characterTruthEngine.ts
```

Rules:

- no React
- no Supabase calls
- no AI calls
- no UI imports
- deterministic where possible
- easy to test

Suggested exports:

```ts
summarizeMoralProfile(character)
predictStressResponse(character, sceneState?)
evaluateActionFit(character, actionText, context)
evaluateDialogueFit(character, dialogueText, context)
evaluateScenePressure(character, sceneState, relationshipContext?)
detectCharacterContradictions(character, arc?, relationships?)
summarizeMoralTrajectory(characterArc, sceneStates?)
findMissingCharacterTruthInputs(character, relationships?, sceneStates?)
```

AI may later wrap this module, but the first pass should establish the deterministic reasoning contract.

---

## First Proof Feature

Do not build a giant dashboard first.

Build one proof feature:

## Would They Do This?

Location options:

- Character Profile
- Director's Chair
- Scene tools drawer

Input:

- selected character
- optional scene
- action or dialogue text

Output:

- verdict
- confidence
- reasons
- suggested adjustment
- missing data needed
- evidence used

Example:

```text
Would STEPHAN say this?
"I don't care who gets hurt. I just want to win."
```

Output style:

```text
Verdict: Strained

Why:
- His baseline suggests he wants to appear principled.
- His stress profile allows selfish regression, but the line is too direct for his voice.
- His wound points toward avoidance, not open cruelty.

Better direction:
Let him justify the selfish choice as duty, intelligence, or necessity.
```

The proof feature must not edit the script. It only analyzes.

---

## UI Principles

The engine should be powerful but not noisy.

### Focus Mode

No visible Character Truth UI.

### Basic Mode

Show one helpful teaching prompt at a time.

Example:

```text
This scene needs pressure.
What could force STEPHAN to choose between looking smart and doing the right thing?
```

### Advanced Mode

Allow deeper diagnostics, but keep them summoned.

No permanent wall of analysis should crowd the screenplay page.

---

## AI Behavior Rules

AI may:

- analyze
- diagnose
- explain
- suggest
- propose alternatives
- ask clarifying questions

AI must not:

- overwrite screenplay text without explicit consent
- overwrite character fields without confirmation
- invent permanent canon facts without approval
- treat TMH as moral judgment of the writer
- produce generic advice detached from current character/scene data
- hide which fields it used to reason

When data is missing, the engine should say so.

Correct:

```text
I cannot evaluate the betrayal yet because this character has no wound, fear, or relationship data with Hans.
```

Incorrect:

```text
This character would betray Hans because that would be dramatic.
```

---

## Data Inputs to Reuse First

Do not start with schema migration unless absolutely necessary.

Reuse existing project data where possible:

- `characters`
- `character_relationships`
- `character_scene_states`
- `character_arcs`
- `scene_arc_beats`
- `scenes`
- `script_blocks`
- `story_arcs`

The first engine pass should adapt to incomplete data and return `insufficient_data` when required fields are missing.

---

## Missing Data Strategy

When the engine cannot reason well, it should identify the missing craft input.

Examples:

- missing want
- missing need
- missing wound
- missing lie
- missing fear
- missing voice style
- missing TMH stress level
- missing relationship private truth
- missing scene goal
- missing moral pressure
- missing scene turn

In Basic Mode, missing inputs become teaching prompts.

In Advanced Mode, missing inputs become diagnostics.

---

## Relationship to Current Character Builder Work

The Character Builder should become the front door to this engine.

The guided builder should not just collect fields. It should explain why the field matters to behavior.

Examples:

- Want tells us what the character chases.
- Need tells us what would actually heal them.
- Wound tells us what pressure hurts.
- Lie tells us how they misread the world.
- Fear tells us what they avoid.
- Secret tells us what they protect.
- Voice tells us how truth leaks out.
- TMH tells us what they do under pressure.
- Relationships tell us who can trigger change.

---

## Acceptance Tests

The first implementation is not done until pure tests cover these cases:

1. A character with no want/need/wound returns `insufficient_data` for action-fit analysis.
2. A character with L7 baseline and L2 stress can regress under high pressure, but the result should explain the pressure source.
3. A character with a betrayal wound should flag betrayal-related scenes as high pressure.
4. Dialogue that contradicts `voice_style` should return `strained`, not automatically `contradicts`.
5. A scene with moral pressure but no choice should be flagged as incomplete.
6. A relationship with high trust and high conflict should produce more nuanced pressure than a low-trust stranger relationship.
7. A flat TMH trajectory across many scene states should produce a flat-arc warning.
8. Suggested fixes must not overwrite user work.
9. Evidence must list which fields were used.
10. Missing inputs must be returned as structured data.

---

## Implementation Phases

### Phase 1 — Doctrine and Contract

- Add this document.
- Do not build UI yet.

### Phase 2 — Pure Engine

- Add `src/lib/story-intelligence/characterTruthEngine.ts`.
- Add tests.
- Reuse current data shapes.

### Phase 3 — Proof UI

- Add "Would They Do This?" to Character Profile or Director's Chair.
- Analyze only.
- No script edits.

### Phase 4 — Basic Mode Teaching

- Use missing inputs and simple verdicts to teach one next step.
- Do not expose the full engine to beginners.

### Phase 5 — Advanced Diagnostics

- Add deeper scene/character/relationship diagnostics.
- Keep tools summoned, not permanently visible.

### Phase 6 — PfHU Learning Loop

- Log coaching outcomes later.
- Track what the writer skips, repairs, or repeatedly misunderstands.
- Adapt teaching style without disrupting writing.

---

## Out of Scope for First Pass

Do not:

- rebuild the screenplay editor
- change typing behavior
- change autosave or local-first persistence
- add a new dashboard before the proof feature
- rewrite existing character schema unless necessary
- make TMH the only model of character behavior
- expose PfHU logs as a user-facing surveillance surface
- let AI overwrite user work
- add noisy inline analysis to the screenplay page

---

## Lovable Build Prompt

Implement the foundation described in `docs/CHARACTER_TRUTH_ENGINE.md`.

Read first:

1. `AGENTS.md`
2. `docs/WRITER_MODES_FOCUS_BASIC_ADVANCED.md`
3. `docs/CHARACTER_TRUTH_ENGINE.md`
4. `src/components/characters/tmh.ts`
5. `src/components/characters/CharacterProfileDialog.tsx`
6. `src/components/characters/CharacterArcSection.tsx`
7. `src/components/characters/RelationshipsTab.tsx`
8. `src/components/characters/SceneUsageTab.tsx`
9. `src/lib/characters.functions.ts`
10. `src/lib/arc.functions.ts`

Goal:

Create the first reusable Character Truth Engine foundation.

Requirements:

- Add a pure TypeScript module under `src/lib/story-intelligence/`.
- No React, Supabase, or AI calls inside the pure engine.
- Reuse existing character, relationship, arc, scene-state, and TMH fields.
- Return structured verdicts with reasons, suggested fixes, missing inputs, and evidence.
- Add tests for moral pressure, dialogue fit, action fit, missing data, relationship pressure, and TMH trajectory.
- Add only one proof UI: "Would They Do This?"
- The proof UI analyzes only and must not edit screenplay text or profile fields.
- Keep Focus Mode clean.
- Keep Basic Mode beginner-friendly.
- Keep Advanced Mode powerful but summoned.

Do not add new unrelated AI tools. Do not rewrite the editor. Do not let this become a new dashboard before the engine contract works.
