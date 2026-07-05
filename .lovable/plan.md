## Scope

Build the reusable **Character Truth Engine** foundation plus one proof-of-value UI ("Would They Do This?"). Pure TS module + tests + a single new tab inside the existing `CharacterProfileDialog`. No editor changes, no new routes, no new tables, no AI calls in the engine itself.

## Files to create

1. `**src/lib/story-intelligence/characterTruthEngine.ts**` — pure TypeScript, no React / Supabase / AI / UI imports.
  - Types: `CharacterTruthVerdict`, `CharacterTruthResult`, `SceneContext`, `RelationshipContext`, `ArcContext`, `EvidenceItem`.
  - Exports (all pure, deterministic):
    - `summarizeMoralProfile(character)` → `{ baseline, stress, aspirational, shadow, gap, drift, label }`.
    - `predictStressResponse(character, sceneState?)` → predicted TMH level under given pressure + rationale.
    - `evaluateActionFit(character, actionText, ctx?)` → `CharacterTruthResult`.
    - `evaluateDialogueFit(character, dialogueText, ctx?)` → `CharacterTruthResult`.
    - `evaluateScenePressure(character, sceneState, relCtx?)` → flags "moral pressure without choice", "no stakes change", etc.
    - `detectCharacterContradictions(character, arc?, relationships?)`.
    - `summarizeMoralTrajectory(characterArc, sceneStates?)` → ascent / descent / regression / flat / unearned.
    - `findMissingCharacterTruthInputs(character, relationships?, sceneStates?)` → structured `{ field, prompt }[]` (prompts are writer-facing, not raw field names).
  - Internal helpers (not exported): keyword scans for betrayal/violence/self-sacrifice/lie signals in action + dialogue text; voice-fit scoring against `voice_style`, `sentence_rhythm`, `directness_level`, `emotional_openness`, `humor_style`, `subtext_pattern`, `silence_pattern`; TMH regression logic (baseline vs stress vs pressure level).
  - Evidence: every rule that fires pushes `{ source, field, value }` — the engine explains what it used.
2. `**src/lib/story-intelligence/characterTruthEngine.test.ts**` — Vitest. Covers all 10 required cases from the prompt.
3. `**src/components/characters/WouldTheyDoThisTab.tsx**` — client component; renders inside the profile dialog. Contains:
  - Optional scene picker (queries `scenes` for this project; defaults to none).
  - Textarea for the proposed action or line.
  - Radio: "Action" | "Dialogue" (drives which engine fn to call).
  - Analyze button → runs the engine locally in the browser (no server round-trip, no AI).
  - Result block: verdict pill, confidence, reasons, suggested adjustment, missing inputs, collapsible "Evidence used" list (Advanced-only).
  - Mode gating via existing `useWriteMode()` hook: Focus hides the tab entirely; Basic shows verdict + single teaching sentence; Advanced shows the full evidence + missing-inputs list.
  - Strict read-only: no mutations, no writes, no toast prompting user to save anything.

## Files to edit

1. `**src/components/characters/CharacterProfileDialog.tsx**`
  - Add one new tab `truth` with a `Scale`/`Gavel` lucide icon between `personality` and `tmh`. Grid becomes `grid-cols-11`.
  - Wire `<TabsContent value="truth">` to `<WouldTheyDoThisTab character={local} projectId={projectId} />`.
  - Hide the trigger when `writeMode === "focus"` (via existing hook).
  - No other changes to the dialog.
2. `**src/hooks/use-write-mode.ts**` — no code change; just consumed. (Confirm it exposes the current mode; if not already imported here, import it.)

## Files NOT touched

Editor files (`useScreenplayDocument`, `ScreenplayLine`, `screenplayKeymap`, persistence, autosave), slash menu, payments, webhooks, entitlements, arc.functions.ts, characters.functions.ts, RelationshipsTab, SceneUsageTab, CharacterArcSection, DB schema/migrations.

## Tests to add (`characterTruthEngine.test.ts`)

1. Character with no want/need/wound → `evaluateActionFit` returns `insufficient_data` and lists those three in `missingInputs`.
2. L7 baseline + L2 stress under high-pressure scene → verdict `strained`, reasons cite the stress drop, evidence includes `tmh_baseline` + `tmh_stress` + scene pressure field.
3. Character with `wound` containing "betray" → betrayal-themed scene state marked high pressure.
4. Dialogue that contradicts `voice_style` (e.g. florid line vs "clipped, dry") → `strained`, never automatically `contradicts`.
5. Scene state with `moral_pressure` set but empty `character_choice`/`scene_turn` → `evaluateScenePressure` flags "moral pressure without choice."
6. Two relationship contexts (high-trust+high-conflict vs low-trust stranger) → engine returns more reasons + higher confidence for the former.
7. Flat TMH across ≥4 scene states → `summarizeMoralTrajectory` returns `flat` with warning message.
8. `suggestedFixes` are always advisory strings — assert no engine call mutates its input character object (deep-freeze input in test).
9. Every fired rule adds an `evidence` entry with a real `field` name that exists on the character/scene input.
10. `findMissingCharacterTruthInputs` returns array of `{ field, prompt }` — assert `prompt` is a writer-facing question, not the raw field name.

Run with `bunx vitest run src/lib/story-intelligence/characterTruthEngine.test.ts`.

## Exact UI placement for "Would They Do This?"

- Inside `CharacterProfileDialog`, new tab **"Truth Check"** (`value="truth"`), icon `Scale`, positioned after **Personality**, before **TMH**.
- Renders only when a character is loaded; empty state prompts the writer to type an action or line.
- No new dashboard, no new top-level route, no visible surface outside this dialog.

## Risks

- **Overfitting to keywords.** Text scans for "betray"/"lie"/"kill" can misfire. Mitigation: keyword hits only *raise the pressure score*, they never flip verdict alone; verdict requires character-level evidence (TMH, wound, arc).
- **False certainty.** Small data → confident-sounding output. Mitigation: confidence is a function of evidence count; ≤2 evidence items caps at `low`.
- **Mode leakage.** Focus writers should never see this. Mitigation: hide the `TabsTrigger` entirely, not just the panel — writer never sees the tab.
- **Grid width.** `grid-cols-10` → `grid-cols-11` on tabs list; verify no overflow at the current dialog width (`max-w-5xl`). Fallback: shorten label to "Truth."
- **Engine complexity creep.** Kept the module pure and free of Supabase; any DB lookups happen in the tab component and are passed in as plain objects.

This is a **very good plan**. I would approve it, but with a few amendments before Lovable starts coding.

The best part is that they understood the boundary:

pure engine first, tests second, one proof UI, no editor changes.

That is exactly right.

But there are **seven important fixes** I’d send back.

&nbsp;

**My verdict**

**Approve with amendments.**

The plan is strong enough to move forward, but it needs a few guardrails so the first version does not become either too weak or too cluttered.

&nbsp;

**Amendments I would require**

**1. Do not rely only on**

**useWriteMode()**

**for Basic vs Advanced**

Lovable says:

Mode gating via existing useWriteMode() hook: Focus hides the tab; Basic shows verdict + single teaching sentence; Advanced shows full evidence.

Careful. useWriteMode() has historically been about **Focus / write mode**, not necessarily the full **Focus / Basic / Advanced** app mode.

So tell Lovable:

Do not assume `useWriteMode()` knows Basic vs Advanced.

&nbsp;

Use `useWriteMode()` only to determine Focus visibility if that is all it exposes.

&nbsp;

For Basic vs Advanced behavior, use the existing onboarding/preferred mode source, route context, or pass an explicit `mode` prop into `WouldTheyDoThisTab`.

&nbsp;

If mode cannot be determined safely, default to Advanced-style output inside the Character Profile, but never show this tab in Focus Mode.

**2. The tab needs more than just**

**scenes**

Their UI says the optional scene picker queries scenes.

That is not enough for a real Character Truth result.

For this engine to work, the tab should also fetch/pass plain context objects when available:

- selected character
- character arc
- relationships
- character scene states
- scene arc beat for selected scene
- selected scene metadata

No Supabase inside the pure engine — but the UI component can fetch the data and pass it in.

Tell Lovable:

WouldTheyDoThisTab may query data, but the pure engine may not.

&nbsp;

The tab should fetch minimal context:

- character*_arcs for this character*

*- character_*relationships for this character

- character*_scene_*states for this character

- scene*_arc_*beats for selected scene, if a scene is selected

- scenes for scene picker

&nbsp;

Pass these as plain objects into the pure engine.

Without this, the proof feature will feel too shallow.

**3. Standardize**

**missingInputs**

The plan has a mismatch:

- CharacterTruthResult says missingInputs: string[]
- findMissingCharacterTruthInputs() returns { field, prompt }[]

The second one is better.

I would change the result type now:

missingInputs: Array<{

  field: string;

  prompt: string;

}>;

That way Basic Mode can turn missing inputs directly into teaching prompts.

**4. Avoid**

**Gavel**

The plan says Scale / Gavel.

Use **Scale** only.

A gavel implies judgment, punishment, legal verdict. TMH must not feel like moral condemnation. The icon should feel like balance, pressure, truth, and craft — not sentencing.

Use the `Scale` icon. Do not use `Gavel`.

**5. Do not hard-code**

**grid-cols-11**

The Character Profile dialog is already crowded. Hard-coding grid-cols-11 may break on iPad.

Better:

Do not rely on a fixed `grid-cols-11` tab layout.

&nbsp;

Use a responsive, scrollable, wrapped, or compact tab layout. If necessary, label the tab “Truth” instead of “Truth Check” on smaller screens.

This matters because your app is already heavily tested on iPad.

**6. Use existing project scripts, not random commands**

Lovable says:

bunx vitest run src/lib/story-intelligence/characterTruthEngine.test.ts

bunx tsgo --noEmit

But the repo scripts already define test/build/lint in package.json.

So tell Lovable:

Use existing repo scripts where possible:

&nbsp;

npm run test

npm run build

npm run lint

&nbsp;

Only use `bunx vitest ...` for a targeted local test if Vitest is already available and the command works in this repo. Do not introduce `tsgo` unless it is already configured.

**7. Add one “engine limitation” message**

Because this first version is deterministic and no-AI, it should be honest.

In the UI, if evidence is thin, it should say:

“This is a first-pass truth check based on the character data currently filled in.”

That prevents the tool from feeling falsely magical.

&nbsp;

**What I would send back to Lovable**

This plan is approved with amendments.

&nbsp;

The overall direction is correct:

- pure TypeScript engine

- tests

- one proof UI

- no editor changes

- no new routes

- no schema changes

- no AI inside the pure engine

&nbsp;

Please apply these amendments before coding.

&nbsp;

## 1. Mode detection

&nbsp;

Do not assume `useWriteMode()` knows Basic vs Advanced.

&nbsp;

Use `useWriteMode()` only to determine Focus visibility if that is all it exposes.

&nbsp;

For Basic vs Advanced behavior, use the existing onboarding/preferred mode source, route context, or pass an explicit `mode` prop into `WouldTheyDoThisTab`.

&nbsp;

If mode cannot be determined safely, default to the normal Character Profile output, but never show this tab in Focus Mode.

&nbsp;

## 2. Fetch enough context for the proof UI

&nbsp;

`WouldTheyDoThisTab` may query Supabase, but the pure engine may not.

&nbsp;

The tab should fetch minimal context and pass plain objects into the engine:

&nbsp;

- `character_arcs` for this character

- `character_relationships` for this character

- `character_scene_states` for this character

- `scene_arc_beats` for selected scene, if a scene is selected

- `scenes` for the scene picker

&nbsp;

Do not put Supabase calls inside `characterTruthEngine.ts`.

&nbsp;

## 3. Standardize missing inputs

&nbsp;

Use structured missing inputs, not raw strings.

&nbsp;

Preferred type:

&nbsp;

```ts

type MissingCharacterTruthInput = {

  field: string;

  prompt: string;

};

Then:

missingInputs: MissingCharacterTruthInput[];

This lets Basic Mode teach from the result.

**4. Icon / language**

Use the Scale icon only.

Do not use Gavel; it feels like judgment. TMH must feel like story physics, not moral condemnation.

Tab label:

- desktop: Truth Check
- compact/iPad fallback: Truth

**5. Tabs layout**

Do not hard-code grid-cols-11 if it causes overflow.

Use a responsive, scrollable, wrapped, or compact tabs layout. The Character Profile dialog must remain usable on iPad.

**6. Test/build commands**

Use existing repo scripts where possible:

npm run test

npm run build

npm run lint

Targeted Vitest is fine if it works in this repo, but do not introduce tsgo unless it is already configured.

**7. Honest confidence / limitation messaging**

If evidence is thin, cap confidence at low and show a small note:

“This is a first-pass truth check based on the character data currently filled in.”

Never invent certainty.

**8. No upsell yet**

Do not add TMH upsell CTAs in this pass.

The engine should create the future path to TMH Character Reports, but this pass is about trust and proof of value.

Future out-of-scope idea:  
“Generate full TMH Character Report.”

**9. Preserve all hard boundaries**

Do not touch:

- useScreenplayDocument
- ScreenplayLine
- screenplayKeymap
- screenplay persistence
- autosave
- Enter/Tab/slash behavior
- payments
- webhooks
- entitlements

Do not create:

- a new dashboard
- a new top-level route
- inline screenplay annotations
- AI-generated rewrite behavior

---

&nbsp;

## Overall assessment

&nbsp;

This is the right first implementation.

&nbsp;

It gives you a **free, client-side, proof-of-value engine** that can later become:

&nbsp;

- deeper TMH character reports

- Director’s Chair analysis

- Dramatic Pulse warnings

- Basic Mode teaching

- premium TMH cross-sell

&nbsp;

The cross-sell path is natural, but we should earn it first.

&nbsp;

First make the writer say:

&nbsp;

> “Whoa. It understands why my character would or wouldn’t do that.”

&nbsp;

Then TMH analysis becomes obvious.This is a **very good plan**. I would approve it, but with a few amendments before Lovable starts coding.

The best part is that they understood the boundary:

pure engine first, tests second, one proof UI, no editor changes.

That is exactly right.

But there are **seven important fixes** I’d send back.

&nbsp;

**My verdict**

**Approve with amendments.**

The plan is strong enough to move forward, but it needs a few guardrails so the first version does not become either too weak or too cluttered.

&nbsp;

**Amendments I would require**

**1. Do not rely only on**

**useWriteMode()**

**for Basic vs Advanced**

Lovable says:

Mode gating via existing useWriteMode() hook: Focus hides the tab; Basic shows verdict + single teaching sentence; Advanced shows full evidence.

Careful. useWriteMode() has historically been about **Focus / write mode**, not necessarily the full **Focus / Basic / Advanced** app mode.

So tell Lovable:

Do not assume `useWriteMode()` knows Basic vs Advanced.

&nbsp;

Use `useWriteMode()` only to determine Focus visibility if that is all it exposes.

&nbsp;

For Basic vs Advanced behavior, use the existing onboarding/preferred mode source, route context, or pass an explicit `mode` prop into `WouldTheyDoThisTab`.

&nbsp;

If mode cannot be determined safely, default to Advanced-style output inside the Character Profile, but never show this tab in Focus Mode.

**2. The tab needs more than just**

**scenes**

Their UI says the optional scene picker queries scenes.

That is not enough for a real Character Truth result.

For this engine to work, the tab should also fetch/pass plain context objects when available:

- selected character
- character arc
- relationships
- character scene states
- scene arc beat for selected scene
- selected scene metadata

No Supabase inside the pure engine — but the UI component can fetch the data and pass it in.

Tell Lovable:

WouldTheyDoThisTab may query data, but the pure engine may not.

&nbsp;

The tab should fetch minimal context:

- character*_arcs for this character*

*- character_*relationships for this character

- character*_scene_*states for this character

- scene*_arc_*beats for selected scene, if a scene is selected

- scenes for scene picker

&nbsp;

Pass these as plain objects into the pure engine.

Without this, the proof feature will feel too shallow.

**3. Standardize**

**missingInputs**

The plan has a mismatch:

- CharacterTruthResult says missingInputs: string[]
- findMissingCharacterTruthInputs() returns { field, prompt }[]

The second one is better.

I would change the result type now:

missingInputs: Array<{

  field: string;

  prompt: string;

}>;

That way Basic Mode can turn missing inputs directly into teaching prompts.

**4. Avoid**

**Gavel**

The plan says Scale / Gavel.

Use **Scale** only.

A gavel implies judgment, punishment, legal verdict. TMH must not feel like moral condemnation. The icon should feel like balance, pressure, truth, and craft — not sentencing.

Use the `Scale` icon. Do not use `Gavel`.

**5. Do not hard-code**

**grid-cols-11**

The Character Profile dialog is already crowded. Hard-coding grid-cols-11 may break on iPad.

Better:

Do not rely on a fixed `grid-cols-11` tab layout.

&nbsp;

Use a responsive, scrollable, wrapped, or compact tab layout. If necessary, label the tab “Truth” instead of “Truth Check” on smaller screens.

This matters because your app is already heavily tested on iPad.

**6. Use existing project scripts, not random commands**

Lovable says:

bunx vitest run src/lib/story-intelligence/characterTruthEngine.test.ts

bunx tsgo --noEmit

But the repo scripts already define test/build/lint in package.json.

So tell Lovable:

Use existing repo scripts where possible:

&nbsp;

npm run test

npm run build

npm run lint

&nbsp;

Only use `bunx vitest ...` for a targeted local test if Vitest is already available and the command works in this repo. Do not introduce `tsgo` unless it is already configured.

**7. Add one “engine limitation” message**

Because this first version is deterministic and no-AI, it should be honest.

In the UI, if evidence is thin, it should say:

“This is a first-pass truth check based on the character data currently filled in.”

That prevents the tool from feeling falsely magical.

&nbsp;

**What I would send back to Lovable**

This plan is approved with amendments.

&nbsp;

The overall direction is correct:

- pure TypeScript engine

- tests

- one proof UI

- no editor changes

- no new routes

- no schema changes

- no AI inside the pure engine

&nbsp;

Please apply these amendments before coding.

&nbsp;

## 1. Mode detection

&nbsp;

Do not assume `useWriteMode()` knows Basic vs Advanced.

&nbsp;

Use `useWriteMode()` only to determine Focus visibility if that is all it exposes.

&nbsp;

For Basic vs Advanced behavior, use the existing onboarding/preferred mode source, route context, or pass an explicit `mode` prop into `WouldTheyDoThisTab`.

&nbsp;

If mode cannot be determined safely, default to the normal Character Profile output, but never show this tab in Focus Mode.

&nbsp;

## 2. Fetch enough context for the proof UI

&nbsp;

`WouldTheyDoThisTab` may query Supabase, but the pure engine may not.

&nbsp;

The tab should fetch minimal context and pass plain objects into the engine:

&nbsp;

- `character_arcs` for this character

- `character_relationships` for this character

- `character_scene_states` for this character

- `scene_arc_beats` for selected scene, if a scene is selected

- `scenes` for the scene picker

&nbsp;

Do not put Supabase calls inside `characterTruthEngine.ts`.

&nbsp;

## 3. Standardize missing inputs

&nbsp;

Use structured missing inputs, not raw strings.

&nbsp;

Preferred type:

&nbsp;

```ts

type MissingCharacterTruthInput = {

  field: string;

  prompt: string;

};

Then:

missingInputs: MissingCharacterTruthInput[];

This lets Basic Mode teach from the result.

**4. Icon / language**

Use the Scale icon only.

Do not use Gavel; it feels like judgment. TMH must feel like story physics, not moral condemnation.

Tab label:

- desktop: Truth Check
- compact/iPad fallback: Truth

**5. Tabs layout**

Do not hard-code grid-cols-11 if it causes overflow.

Use a responsive, scrollable, wrapped, or compact tabs layout. The Character Profile dialog must remain usable on iPad.

**6. Test/build commands**

Use existing repo scripts where possible:

npm run test

npm run build

npm run lint

Targeted Vitest is fine if it works in this repo, but do not introduce tsgo unless it is already configured.

**7. Honest confidence / limitation messaging**

If evidence is thin, cap confidence at low and show a small note:

“This is a first-pass truth check based on the character data currently filled in.”

Never invent certainty.

**8. No upsell yet**

Do not add TMH upsell CTAs in this pass.

The engine should create the future path to TMH Character Reports, but this pass is about trust and proof of value.

Future out-of-scope idea:  
“Generate full TMH Character Report.”

**9. Preserve all hard boundaries**

Do not touch:

- useScreenplayDocument
- ScreenplayLine
- screenplayKeymap
- screenplay persistence
- autosave
- Enter/Tab/slash behavior
- payments
- webhooks
- entitlements

Do not create:

- a new dashboard
- a new top-level route
- inline screenplay annotations
- AI-generated rewrite behavior

---

&nbsp;

## Overall assessment

&nbsp;

This is the right first implementation.

&nbsp;

It gives you a **free, client-side, proof-of-value engine** that can later become:

&nbsp;

- deeper TMH character reports

- Director’s Chair analysis

- Dramatic Pulse warnings

- Basic Mode teaching

- premium TMH cross-sell

&nbsp;

The cross-sell path is natural, but we should earn it first.

&nbsp;

First make the writer say:

&nbsp;

> “Whoa. It understands why my character would or wouldn’t do that.”

&nbsp;

Then TMH analysis becomes obvious.

## Out of scope for this pass

- AI-authored analysis (no `generateText` calls).
- TMH upsell CTAs / premium report generation.
- Director's Chair integration, Dramatic Pulse hooks, Basic Mode coach nudges outside this tab, inline editor annotations.
- New database tables, RLS, migrations, or edge functions.
- Auto-inserting suggested fixes into character fields or the screenplay.
- Cross-scene batch analysis, whole-script trajectory dashboards.
- Any change to entitlements/usage counters — the engine runs client-side and costs nothing.

## Acceptance

1. `src/lib/story-intelligence/characterTruthEngine.ts` exports the 8 functions with typed results.
2. All 10 tests pass under `bunx vitest run`.
3. Opening a character in the dialog shows a "Truth Check" tab (Basic/Advanced modes only).
4. Typing an action + clicking Analyze produces verdict + reasons + evidence with zero writes.
5. Missing character data yields `insufficient_data` with helpful prompts, not fake certainty.
6. Typecheck (`bunx tsgo --noEmit`) clean.
7. No file listed under "Files NOT touched" is modified.