# SceneSmith → Best-in-class screenplay app

## The disconnect (what you're seeing)

Right now the "Editor" shows two seeded labels (`INT. AFRICAN DESERT`, `STEPHAN`) and a row of `+ Block` buttons. There is no visible page, no cursor parked in a line you can type into, no manuscript sidebar, no save indicator near where you'd be typing, and no way to see what scene you're on relative to the whole script. That's why it feels like "scene/character and that's it."

The fix is not another tweak to block buttons. The fix is to rebuild the Editor as a **manuscript** — a single, scrollable script page with a navigator on the left, a writing surface in the middle, and a coach on the right — and to wire your existing AI to do the structural thinking *for* the writer.

---

## 1. The manuscript surface (the actual "where I write")

Replace the centered "blocks panel" with a Final-Draft–style page:

```text
┌──────────────────────────────────────────────────────────────┐
│  ░ Manuscript ░       │   PAGE 3 of 12   ▎Act I · Scene 4   │
│                       │                                      │
│  ▸ Act I              │   INT. AFRICAN DESERT — DAY          │
│    • Sc 1 Cold open   │                                      │
│    • Sc 2 Meet Stephan│   Wind. A figure crests the dune.    │
│    • Sc 3 The call ●  │                                      │
│  ▸ Act II             │              STEPHAN                 │
│    • Sc 4 ...         │        (squinting at the sun)        │
│                       │   I told them I'd come back.         │
│  Characters (auto)    │                                      │
│   ● Stephan  42 lines │   ▍                                  │  ← live caret
│   ● Amira     8 lines │                                      │
│                       │                                      │
│  + New scene          │   ─── Scene 5 ─────────────────────  │
└──────────────────────────────────────────────────────────────┘
                                  [ NOW: Action  · Tab to change · ⏎ new line · ✨ AI ]
```

Key changes:

- **One continuous editable page**, not a panel of buttons. Click anywhere → caret appears → type. Empty doc opens with the caret already inside an empty Scene Heading line and a placeholder hint ("INT./EXT. LOCATION — TIME").
- **Persistent left navigator (Manuscript Index)**: Acts → Scenes → beats. Click jumps to that scene; current scene is highlighted; drag to reorder scenes.
- **Page + scene counter** in the top bar of the page ("Page 3 of 12 · Act I · Scene 4 of 7").
- **Always-visible Save state** anchored to the page header, not the corner of the app.
- **Scene dividers** rendered between scenes so the writer can see the shape of the script while scrolling.

## 2. Auto-detect characters and scenes (your "scene review" idea)

A background analyzer runs on idle (debounced ~1.5s after typing stops) and on scene break:

- **Character extraction** — any new ALL-CAPS speaker becomes a Character draft. Toast: *"New character detected: AMIRA. Add to cast?"* → one click adds them to Characters with auto-filled first-appearance scene and line count.
- **Scene extraction** — every `INT./EXT.` line creates/updates a Scene record (slug, location, time-of-day, page #, characters present).
- **Continuity hints** — if STEPHAN appears in scene 7 but was last seen wounded in scene 5, surface: *"Stephan was injured in Scene 5 — is that resolved?"*
- **Beat detection** — map scenes to the active Story Arc beats so the Guided Path progress updates automatically as the writer writes (no manual "mark complete" needed).

## 3. ITS / PfHU integration for characters — the real moat

This is where SceneSmith becomes genuinely unique. Treat every character as an **ITS learner-profile-shaped entity** and every scene as a **scenario instance** evaluated by PfHU.

### Each character gets a CharacterModel snapshot

Same shape as your `LearnerIdentitySnapshot`, but the "competence" dimensions become **voice dimensions**:


| Dimension              | What it captures                                        |
| ---------------------- | ------------------------------------------------------- |
| `register`             | formal ↔ casual ↔ vulgar                                |
| `verbosity`            | terse ↔ verbose                                         |
| `vocabulary_signature` | top-N distinctive lemmas                                |
| `emotional_baseline`   | confidence / engagement defaults                        |
| `goals[]`              | per-act objectives (drives arc)                         |
| `known_languages[]`    | leverages your transfer engine for bilingual characters |


The snapshot is **append-only at the event layer** (same PfHU doctrine): every line of dialogue is an evidence event; the character voice profile is a derived view.

### Each scene is a ScenarioPattern instance

Re-use the 16 canonical scenario patterns. A scene declares:

- `capability_type` (initiate / respond / clarify / repair / refuse / politeness_shift)
- `constraint_level` (1–5: a coffee chat vs. a hostage negotiation)
- `communicative_intent`, `environmental_stakes`, `success_condition`, `failure_branches[]`

### What the writer actually gets from this

- **Voice-drift detector**: PfHU compares each new Stephan line to his snapshot. If it drifts (suddenly verbose + formal), inline hint: *"This line reads 8% off Stephan's voice — closer to Amira's register. Rewrite in voice?"*
- **Arc coherence checker**: if Stephan's `goals[]` says Act II = "earn forgiveness" but his scenes show no repair attempts, the StoryPulse panel flags it.
- **Dialogue plausibility**: a scene tagged `constraint_level: 4 (hostage)` with `politeness_shift` capability flags lines that are too casual for the stakes.
- **Replayable critique**: because the event spine is append-only, the writer can scrub the timeline ("show me Stephan's voice at Act I Scene 3 vs. Act III Scene 12") — same replay property PfHU gives ITS.
- **Multilingual characters**: a Polish-accented English speaker can be modeled with the transfer engine so the AI suggests realistic L1-interference phrasing instead of generic "broken English."
- **Table-read mode**: feed each character's snapshot to a TTS voice; PfHU scores the read for pacing/clarity the same way it scores a learner.

### Why this is a unique benefit

No screenplay app today has a per-character behavioral runtime. Final Draft has formatting. WriterDuet has collaboration. Highland has minimalism. **SceneSmith would have a learner-state OS for fictional characters** — which is exactly the moat your VerbBros stack already builds.

## 4. Guided creative scaffolding (so the writer isn't expected to "know everything")

Add a **Story Builder** layer on top of the Editor for blank-page moments:

- **"I have an idea"** → 3-question wizard (genre, protagonist want, antagonist force) → AI generates logline + 8-beat outline + 3 character seeds → drops them into Guided Path and Manuscript Index.
- **"I have a scene in my head"** → write it freeform → AI back-fills: which act, which beat, what scene heading, who's in it, what the goal is — and inserts placeholders before/after.
- **"I'm stuck"** button on every scene → AI proposes 3 next-scene options based on the outline + character goals + last-scene state.
- **Inline ghost-text** (already planned) stays, but is now grounded in the character snapshot, not a generic LLM completion.

## 5. UX correctness pass (small but critical)

- Rename the Editor tab subtitle: **"Editor — write your screenplay"**.
- Empty editor opens with **one empty Scene Heading line, caret blinking, hint visible** — not seeded `INT. AFRICAN DESERT / STEPHAN`.
- Add **Save / Next scene / Outline** buttons to the page header (Cmd+S, Cmd+↵, Cmd+/).
- Redirect non-writing guided steps (logline, characters, story arc, pitch, table read) away from the Editor to their proper tab — never strand the user.
- Bottom command bar: keep `Change / New line / AI continue`, add `+ New scene` and `Voice-check`.

---

## What gets built (technical, in order)

1. **ManuscriptSurface** (`src/components/editor/ManuscriptSurface.tsx`) — single contenteditable page with virtualized scenes, caret-first focus, page counter.
2. **ManuscriptIndex** (`src/components/editor/ManuscriptIndex.tsx`) — left rail: acts/scenes/characters, drag-reorder, jump-to.
3. **Auto-analyzer** (`src/lib/editor/manuscriptAnalyzer.ts` + `analyzeManuscript.functions.ts` serverFn) — debounced extraction of characters, scenes, beats; writes to existing Scenes/Characters tables.
4. **CharacterModel runtime** (`src/lib/its/characterModel/**`) — mirrors `LearnerIdentitySnapshot` shape; append-only events table `character_evidence_events` (new migration with RLS + GRANTs).
5. **Scene-as-ScenarioPattern adapter** (`src/lib/its/scenarioPatternEngine/sceneAdapter.ts`) — maps a screenplay scene to one of the 16 canonical patterns.
6. **VoiceCheck serverFn** (`src/lib/editor/voiceCheck.functions.ts`) — compares a dialogue block to a character snapshot via Lovable AI (`google/gemini-3-flash-preview`), returns drift score + rewrite suggestions.
7. **StoryBuilder wizard** (`src/components/editor/StoryBuilder.tsx`) — 3-question kickoff that seeds outline/characters.
8. **Stuck/Continue/Ghost-text** — grounded in CharacterModel + outline, not a raw prompt.
9. **Empty-state + redirects** — remove seeded text; redirect non-writing guided steps to correct tab.
10. **Save/Next/Outline header + Cmd shortcuts**.

### Data (new tables, all with RLS + GRANTs to authenticated + service_role)

- `character_snapshots` — derived view of voice dimensions per character per project.
- `character_evidence_events` — append-only line-level evidence.
- `scene_patterns` — per-scene capability_type, constraint_level, success/failure metadata.

### AI usage

All Lovable AI Gateway via `createServerFn` + `requireSupabaseAuth`. Default model `google/gemini-3-flash-preview`; escalate to `google/gemini-2.5-pro` for full-manuscript arc analysis.

---

## Explicitly NOT in this plan

- Real-time multi-writer collaboration.
- PDF export pagination engine (use existing Download .txt for now; PDF is a follow-up).
- Voice-to-text dictation.
- Mobile-native editor (web responsive only).

## Open questions before I build

1. **Scope of v1** — do you want all 10 steps in one pass, or ship in two waves: (A) Manuscript surface + Index + auto-detect + empty-state fix, then (B) CharacterModel/PfHU integration + VoiceCheck + StoryBuilder? Yes.
2. **Character model storage** — OK to add the three new tables now, or keep the CharacterModel in-memory until wave B? Ok to add the three new tables now.
3. **VerbBros code reuse** — should I copy the ScenarioPattern + LearnerIdentitySnapshot shapes into SceneSmith (clean fork), or wire SceneSmith to call into a shared package later? Whatever is cleanest and most effective with fewer problems.