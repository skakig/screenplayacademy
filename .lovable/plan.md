
# Where we stand vs. the docs (audit) and where to go next

## 1. Completion audit against recent `.md` docs

### Solidly implemented (Stage-1 through mid-stage)
- **Screenplay editor engine** (`docs/SCREENPLAY_EDITOR_CONTRACT.md`, `EDITOR_LAB_SPEC.md`, `EDITOR_ACCEPTANCE_TESTS.md`, `LOVABLE_PASS_SEQUENCE.md`): local-first blocks, stable local IDs, keymap, autoformat, persistence, scene navigator, focus accessory bar, chips, guided step strip, draft backup, `editor-lab` route. Passes 1–3 largely landed.
- **Characters system** (`CHARACTERS_REBUILD.md`, `CHARACTER_TRUTH_ENGINE*.md`): Identity Engine, Candidate Inbox, Cast landing, Guided Builder, portrait candidates + approval, style presets, voice preview, cross-project style import, Truth Engine + Truth Coach with tests.
- **ITS/PfHU Importation** (`docs/ITS_PfHU_Importation.md`, `lovable/ITS_IMPORTATION_AUDIT.md`): Phases 1–5 in `src/lib/importation/` — source preservation, extraction runs, world entities, identity resolution, promotion (idempotent + tested), knowledge map spine, resolved-segment rendering, promote-characters API with idempotency, Character Bible + versions + edit + PDF + pitch embed.
- **Payments/entitlements**: Stripe replaced Paddle, yearly + promo codes, metered AI, buy-credits, tier gating.
- **Table Read / Voice**: cached audio, shared voice-settings, in-builder preview.
- **Menu / readiness**: StudioMenu pillars, readiness gate system, route-matrix tests.

### Partially implemented
- **Writers' Room / collaboration** (`04_WRITERS_ROOM_COLLAB.md`, `lovable/collaboration.md`): invites, roles, members, presence + carets, comments/suggestions scaffolding, live scene session hook. Missing: scene locking, change attribution, revision comparison, full multiplayer editing, permissions matrix wired end-to-end into every editor action.
- **Draft revisions** (`05_DRAFT_REVISIONS.md`): local editor history + `DraftHistoryPanel` + backup, but no scene-level snapshots, named drafts, compare/restore, branch-from-snapshot, or AI change summaries.
- **Script Brain** (`03_SCRIPT_BRAIN.md`): manuscript analyzer + coach recommendations exist; no project-wide diagnostics dashboard (setup/payoff, pacing, theme, revision missions).
- **Screenplay Import** (`SCREENPLAY_IMPORT_PIPELINE.md`): screenplay `.txt` heuristic only. Missing docx/pdf/rtf/fountain/fdx, OCR, transcription, LLM extractor.
- **World / Universe** (`SCENESMITH_WORLD_BUILDING.md`, `EPIC_FANTASY_UNIVERSE_PLATFORM.md`): entity extraction, universes, world tiers in bible PDF. Missing: World Graph views, maps, timelines UI, canon governance workflow, continuation package.
- **Arena** (`SCENESMITH_ARENA_*`): v1 tables + flows exist but gated; SceneSmith Studio Score, blind judging, TMH/Anti-Thesis scoring pipeline, Round 2/3 progression not yet wired end-to-end.
- **Academy** (`SCENESMITH_ACADEMY.md`): lessons + filters + contextual help, coach persistence. Missing: repair loops keyed to writer_profile weaknesses, level-aware progression, mastery gates.
- **i18n** (`10_I18N.md`): sweep done for many surfaces but still incomplete across new importation/bible/arena UI.

### Not yet implemented (per current docs)
- **Voice Studio** (`SCENESMITH_VOICE_STUDIO.md`): dictation/STT, spoken brainstorming, session preservation → artifact proposals.
- **Scene-to-Screen pipeline** (`SCENESMITH_SCENE_TO_SCREEN_PIPELINE.md`): Production Graph, shot planning, storyboards→video, lip sync, sequence assembly.
- **Review Intelligence & Argument Studio** (`SCENESMITH_REVIEW_INTELLIGENCE_AND_ARGUMENT_STUDIO.md`): continuity audits, adaptation compare, counterargument tests, evidence-backed reviewer packs.
- **Story Production Platform** (`SCENESMITH_STORY_PRODUCTION_PLATFORM.md`): Story Graph, approvals, production graph, departments.
- **Writer Modes** (`WRITER_MODES_FOCUS_BASIC_ADVANCED.md`): three-mode UI is partial (Focus/Studio toggles present; Basic/Advanced feature gating incomplete).
- **World Lore Canon Architecture** (`WORLD_LORE_CANON_ARCHITECTURE.md`): canon/belief/inference typing, retcon workflow.
- **Screenplay Language Intelligence** (`SCREENPLAY_LANGUAGE_INTELLIGENCE.md`): partial (autoformat, chips); dialogue voice/style diagnostics not wired.

## 2. Recommended next direction (careful, small passes)

Order chosen to (a) protect the writing engine, (b) finish threads already in-flight before opening new ones, and (c) keep each pass shippable and testable.

**Pass A — Finish ITS/PfHU thread (small, low-risk).**
- Wire Character Bible → Editor: click a character mention to open the resolved identity in a side panel.
- Extend `import` UI to expose the new resolved-segment pipeline (badges for canon vs. inferred, source doc chips) in `ImportWizard.tsx`.
- Add a document upload → `source_documents` path for `.txt` beyond screenplay (paste + docx text extraction), still one provider, so the corpus spine gets exercised.

**Pass B — Draft Revisions Stage 5 (fills a documented gap that unblocks Writers' Room).**
- Add scene-level snapshots (`scene_revisions`) + named project drafts (`drafts`).
- UI: version dropdown on scene, compare view (text diff), restore scene, restore full draft.
- Wire authorship (`created_by`) so it plugs directly into collaboration later.

**Pass C — Writers' Room Stage 6 core (build on Pass B).**
- Scene locking + assignments (already partly scaffolded in `assignments.ts`, `live-collab/permissions.ts`).
- Change attribution using the revisions table from Pass B.
- Permissions matrix wired to editor actions (edit, comment, resolve, lock).
- Defer live multiplayer editing until locking + revisions are stable.

**Pass D — Script Brain Stage 4 dashboard.**
- Project-level diagnostics page using existing `manuscriptAnalyzer`, Truth Engine, and coach recs.
- Setup/payoff and pacing analyzers as pure TS modules with tests, surfaced as a `Revision Missions` inbox.

**Pass E — Arena stabilization to first public gate** (per `ARENA_SCORING_AND_PROGRESSION.md`).
- Implement solo SceneSmith Studio Score path (TMH + Anti-Thesis + Truth) returning immediate results; keep public Arena disabled until release gates pass.

Everything past Pass E (Voice Studio, Scene-to-Screen, Review Intelligence, World Graph/Atlas) is intentionally deferred: they are large, cross-cutting, and depend on the revisions + collaboration + diagnostics foundations above.

## 3. What I need from you before building

Pick the next pass (A / B / C / D / E) — or confirm A → B → C in that order — and I’ll produce the concrete build plan for just that pass and stop at its acceptance test, per `LOVABLE_PASS_SEQUENCE.md`.
