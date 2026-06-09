# 00_DEEP_RESEARCH_SCREENPLAY_PRO.md

# ScreenPlay Pro / Screenplay Academy

## Building the World's Best AI-Native Collaborative Screenplay Studio

## Executive Summary

ScreenPlay Pro / Screenplay Academy is an AI-native collaborative screenplay studio. It is not merely a screenplay editor with AI features attached. The screenplay editor is the center of the product, and every other system exists to support the writer's ability to write, revise, understand, collaborate on, pitch, teach, perform, and eventually publish a story.

The app should combine:

- a professional screenplay editor
- scene and project organization
- a Character Bible
- story arc and character arc tracking
- whole-script AI analysis
- draft revisions and version history
- Writers' Room collaboration
- commenting and role-based permissions
- import for `.txt`, `.docx`, `.pdf`, `.rtf`, `.fountain`, and eventually `.fdx`
- pitch deck generation
- ElevenLabs-style table read generation
- character voice profiles
- future character visual generation
- Academy/tutorial content
- multilingual/i18n architecture
- export for screenplay, coverage reports, pitch decks, audio, and future story videos

The first strategic rule is simple:

> The app must answer "Where do I write?" immediately.

If the editor is weak, unclear, hidden, or secondary, the product fails. Everything else should orbit the writing surface.

---

## Product Constitution

### What ScreenPlay Pro Is

ScreenPlay Pro is:

1. A professional screenplay writing environment.
2. A collaborative Writers' Room.
3. A story intelligence system.
4. A character and arc management system.
5. An AI script doctor.
6. A pitch deck generator.
7. A table read and performance studio.
8. A screenplay education platform.
9. A future media-generation pipeline.

### What ScreenPlay Pro Is Not

ScreenPlay Pro is not:

1. A generic dashboard.
2. A basic notes app.
3. A chatbot with a screenplay text box.
4. A collection of disconnected panels.
5. A prompt playground.
6. A Final Draft clone with AI stickers.
7. A database admin interface pretending to be a creative app.

---

## Non-Negotiable Product Principles

1. **The editor is the center.** The main screen must make writing obvious and beautiful.
2. **The project data model is the source of truth.** Characters, scenes, arcs, notes, revisions, comments, pitch decks, and table reads must connect to the project.
3. **AI assists; it does not seize authorship.** AI may diagnose, explain, suggest, and optionally rewrite, but it must not overwrite user work without explicit approval.
4. **Collaboration must preserve authorship.** Co-writing should track who changed what, when, and why.
5. **Drafts must be scene-aware and project-aware.** Revision history should work at the whole-script level and scene level.
6. **Import should create structure.** Imported scripts should populate scenes, characters, locations, and story metadata.
7. **Pitch decks should use project data.** The pitch system should not invent disconnected marketing fluff.
8. **Table reads should use character voice profiles.** Voice assignment belongs to the Character Bible.
9. **Academy should teach in context.** Lessons should appear when they help the writer solve a current writing problem.
10. **Everything must be localization-ready.** No hardcoded user-facing strings.

---

## Competitive Lessons

### Final Draft

Final Draft owns industry credibility, automatic screenplay formatting, production readiness, and professional expectations. ScreenPlay Pro should respect professional formatting, export expectations, reports, and production-friendly outputs.

Learn:

- industry-standard screenplay formatting matters
- export reliability matters
- production workflow expectations matter

Avoid:

- legacy-feeling desktop complexity
- heavy interfaces that intimidate new writers

Differentiate:

- AI-native story analysis
- Academy guidance
- media pipeline
- collaborative story intelligence

### WriterDuet

WriterDuet is strong at collaboration, revision history, import/export, line history, co-writing, comments, and read-aloud workflows.

Learn:

- collaboration must be trustworthy
- line/draft history matters
- import/export matters

Avoid:

- launching chaotic live editing before history, permissions, and conflict safety are mature

Differentiate:

- Writers' Room plus Script Brain plus Character Bible plus Academy plus Pitch Deck plus Table Read Studio

### Arc Studio

Arc Studio proves modern screenplay software can feel elegant, structured, and collaborative.

Learn:

- clean writing surfaces matter
- beat cards and notes should live close to the script
- writers-room workflows are valuable

Avoid:

- overbuilding production management before writing works

Differentiate:

- whole-script AI diagnostics, embedded teaching, and story data model as canon

### Highland

Highland demonstrates the value of minimalism and writing flow.

Learn:

- writing should feel calm
- writers should not fight UI
- formatting should fade into the background

Avoid:

- overwhelming the writing page with every future panel

Differentiate:

- Professional Mode for focus; Guided Mode for Academy and AI support

### StudioBinder

StudioBinder shows how a script can become the source of production assets: breakdowns, schedules, reports, boards, and planning.

Learn:

- screenplay data can power downstream outputs
- production and pitch artifacts should derive from the script

Avoid:

- jumping to production management too early

Differentiate:

- own the creative-development layer first: story, character, arcs, revisions, table read, pitch

### Sudowrite and Novelcrafter

Modern AI writing tools show that durable story memory is essential. ScreenPlay Pro should not force users to repeatedly explain their characters, world, plot, and tone.

Learn:

- AI needs a persistent story bible
- character/lore memory matters
- suggestions should be contextual

Avoid:

- generic ghostwriting disconnected from project canon

Differentiate:

- screenplay-native story memory: scenes, script blocks, characters, arcs, setup/payoff, diagnostics, draft revisions, table read voices, pitch assets

---

## Recommended Architecture

### Frontend

Recommended pattern:

- React / TypeScript
- local-first screenplay editor
- stable local block IDs
- i18n from day one
- split-pane Writing Studio layout
- command palette later
- autosave state
- offline-friendly local draft cache later

The editor should store screenplay blocks, not one giant blob.

Block types:

- `scene_heading`
- `action`
- `character`
- `dialogue`
- `parenthetical`
- `transition`
- `shot`
- `note`

### Backend

Recommended pattern:

- Supabase Auth
- Supabase Postgres
- Supabase Storage
- Edge Functions for AI/import/export/audio
- RLS on all project-owned tables
- background job tables for long tasks

### AI Services

AI logic should live in service functions, not directly in UI components.

Core services:

- `analyze_scene`
- `analyze_script`
- `extract_characters`
- `extract_locations`
- `extract_scenes`
- `generate_pitch_deck`
- `generate_coverage_report`
- `suggest_next_scene`
- `run_dialogue_voice_check`
- `generate_revision_missions`
- `recommend_academy_lesson`

Every AI output should be stored as a diagnostic, suggestion, draft artifact, or pending approval item.

### Collaboration

Future collaboration should be called **Writers' Room**.

The underlying sync/versioning system may be called **ScriptSync**.

Start with:

- project members
- roles
- permissions
- comments
- scene assignments
- scene locking
- change attribution

Only later add:

- live cursors
- full multiplayer editing
- presence
- chat

### Media Pipeline

Table Read Studio should generate audio per scene/line and cache results. Regenerate only changed lines to control cost.

Character voices belong to character records or linked voice profiles.

---

## Core Data Model

Recommended entities:

```text
profiles
projects
project_members
scripts
script_blocks
scenes
characters
character_scene_appearances
locations
arcs
arc_beats
beats
notes
comments
drafts
draft_snapshots
scene_revisions
diagnostics
ai_suggestions
import_jobs
exports
pitch_decks
pitch_deck_slides
voice_profiles
table_reads
table_read_clips
academy_lessons
academy_progress
user_language_preferences
project_language_settings
```

Essential relationships:

```text
user -> projects via project_members
project -> scripts
script -> script_blocks
script -> scenes
scene -> script_blocks
scene -> characters via character_scene_appearances
project -> characters
project -> locations
project -> arcs
arc -> arc_beats
project -> drafts
draft -> draft_snapshots
scene -> scene_revisions
project -> diagnostics
diagnostic -> ai_suggestions
project -> pitch_decks
pitch_deck -> pitch_deck_slides
character -> voice_profiles
project -> table_reads
table_read -> table_read_clips
user -> academy_progress
```

---

## AI Mentor System

Do not impersonate real or copyrighted creators.

Use generic mentor archetypes:

- Story Sage
- Script Doctor
- Structure Coach
- Dialogue Coach
- Character Analyst
- Scene Surgeon
- Producer
- Academy Tutor
- Mythic Mentor

These are not celebrity clones. They are tool modes.

Each mentor should provide a different lens:

- Story Sage: myth, theme, transformation
- Script Doctor: structure, pacing, clarity
- Structure Coach: act breaks, sequence logic, beat maps
- Dialogue Coach: voice, subtext, rhythm
- Character Analyst: wounds, wants, contradictions
- Scene Surgeon: conflict, scene purpose, cuts
- Producer: marketability, budget, pitch fit
- Academy Tutor: teaches while helping
- Mythic Mentor: archetypes and journey patterns

AI must not claim to be George Lucas, Joseph Campbell, or any real writer/filmmaker.

---

## Success Criteria

ScreenPlay Pro succeeds when:

1. A user can open a project and instantly write.
2. Writing does not depend on network timing.
3. Scenes, characters, arcs, and notes persist to a coherent data model.
4. AI understands the project and references existing canon.
5. Draft history protects the writer.
6. Collaboration preserves authorship.
7. Imports create usable project structure.
8. Pitch decks and table reads derive from project data.
9. Academy teaches in context.
10. Localization is ready from the beginning.

---

## Immediate Priority

Current priority is Stage 1:

> Get the editor and Writing Studio working.

Do not build advanced AI, table reads, pitch decks, or full collaboration until Stage 1 passes acceptance tests.
