# Character Truth Engine — Source Systems and Lovable Project References

This document supplements `docs/CHARACTER_TRUTH_ENGINE.md`.

The Character Truth Engine should not be invented from scratch. It should adapt intelligence patterns already developed across related Lovable projects in this workspace.

Use these source systems for conceptual guidance only. Do not copy unrelated UI, routes, branding, database schemas, product flows, or unfinished implementation details into SceneSmith Studio.

---

## Target Project

### `@SceneSmith Studio`

SceneSmith Studio is the target implementation project.

Everything from the source systems must be adapted to screenwriting, character behavior, screenplay craft, and the writer's page-first workflow.

SceneSmith's product rule remains:

> The screenplay page is the product. Everything else is summoned.

---

## Primary Source Systems

### The Moral Hierarchy / themoralhierarchy.com

Use this as the source system for TMH doctrine.

If the Lovable workspace project appears under a different visible title, use the exact workspace project title when prompting Lovable. Possible related visible workspace projects include:

- `@personality-insight-analyzer`
- `@Persona Insights`

TMH source-system concepts to adapt:

- 1-9 moral hierarchy levels
- moral behavior under pressure
- baseline moral posture
- stress regression
- aspirational behavior
- shadow behavior
- moral blind spots
- moral tests
- report-style insight language
- practical application of moral analysis without shaming the user

In SceneSmith:

- TMH becomes character behavior under pressure.
- TMH is story physics, not moral condemnation.
- TMH should explain why a character behaves a certain way under pressure.
- TMH should help diagnose whether an action, line of dialogue, betrayal, sacrifice, or moral choice is earned.

Do not turn SceneSmith into a TMH assessment app. The screenplay remains central.

---

### `@VerbBros Academy`

Use this as the source system for ITS / adaptive teaching patterns.

VerbBros Academy source-system concepts to adapt:

- Intelligent Tutoring System patterns
- guided onboarding
- learner modeling
- repair loops
- one-concept-at-a-time teaching
- beginner-friendly explanations
- progressive disclosure
- adaptive difficulty
- teaching through examples, not abstract lectures
- language-learning style feedback loops adapted to screenplay craft

In SceneSmith:

- ITS becomes screenplay craft coaching.
- Basic Mode should teach one next step at a time.
- The app should explain want, need, wound, lie, voice, scene turn, relationship shift, and moral pressure in simple language.
- The app should diagnose what the writer is missing, then give one clear action.

Do not copy VerbBros UI, lesson routes, language drills, CEFR mechanics, or unrelated classroom flows. Adapt the tutoring intelligence only.

---

### PfHU / Profile for Human Understanding

PfHU is not a separate visible product title in every workspace view, the relevant prior work  lives in:

- `@VerbBros Academy`

Use these as source references for adaptive human-understanding patterns.

PfHU source-system concepts to adapt:

- understanding the user's skill level
- tracking what the user skips or repeatedly struggles with
- adapting the amount of explanation
- detecting whether the user needs examples, direct instruction, or advanced critique
- remembering conceptual blind spots
- shaping the next coaching prompt based on prior behavior

In SceneSmith:

- PfHU becomes writer-adaptive guidance.
- It should help the app decide whether to teach, nudge, diagnose, or stay silent.
- It should never feel like surveillance.
- It should never get in the way of writing.

Do not expose raw PfHU logs as a user-facing panel in the first pass.

---

## Recommended Lovable Prompt Pattern

When prompting Lovable for Character Truth Engine work, explicitly mention the source projects in the chat prompt:

```md
Use `@SceneSmith Studio` as the target implementation project.

Use The Moral Hierarchy / themoralhierarchy.com source system for TMH doctrine. If needed, inspect related workspace projects such as `@personality-insight-analyzer` or `@Persona Insights` for personality/moral-insight patterns.

Use `@VerbBros Academy` as the source-system reference for ITS, adaptive onboarding, repair loops, one-concept-at-a-time teaching, and PfHU-style writer guidance.

Do not copy unrelated UI, routes, branding, database tables, or product flows from those projects. Adapt the intelligence patterns into SceneSmith's screenplay and character engine.
```

---

## Implementation Boundary

For the first Character Truth Engine implementation:

- Build the pure engine inside SceneSmith.
- Reuse SceneSmith's existing character, relationship, scene-state, arc, and TMH fields.
- Add tests before broad UI.
- Add only one proof feature: `Would They Do This?`
- Keep Focus Mode clean.
- Keep Basic Mode simple and teaching-oriented.
- Keep Advanced Mode powerful but summoned.

Do not build a giant cross-project dashboard.

---

## Canonical Adaptation Map

```text
The Moral Hierarchy / themoralhierarchy.com
→ TMH moral behavior under pressure
→ SceneSmith character behavior diagnostics

VerbBros Academy
→ ITS / adaptive tutoring / repair loops
→ SceneSmith screenplay craft coaching

PfHU / VerbBros Academy
→ user understanding and adaptive guidance
→ SceneSmith writer-specific coaching level

SceneSmith Studio
→ final product surface
→ screenplay page, Casting Wall, Director's Chair, Dramatic Pulse, Character Truth Engine
```

The result should feel like a beautiful screenplay studio with a living intelligence layer, not a pile of imported features.
