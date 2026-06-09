# 01_IMPLEMENTATION_ROADMAP.md

# ScreenPlay Pro Implementation Roadmap

## Core Rule

Do not build everything at once.

Current priority:

> Stage 1 — Get the editor working.

If typing does not work, nothing else matters.

## Stage 1 — Editor and Writing Studio

Build or fix:

- project dashboard access to editor
- Writing Studio layout
- central screenplay editor
- left scene navigator
- right character/notes/future-assistant sidebar
- local-first screenplay blocks
- stable local IDs
- basic autosave
- manual scene creation
- manual character creation
- save status
- refresh persistence
- translation-key-ready UI strings

Success criteria:

1. User can create a project.
2. User can open the Writing Studio.
3. User can click the page and type immediately.
4. Enter creates the next screenplay block.
5. Tab and Shift+Tab change block type without losing focus.
6. Content survives refresh.
7. Local typing is not blocked by network timing.
8. The user never wonders where to write.

Do not build advanced AI, pitch decks, table reads, Academy polish, full live collaboration, storyboard, or production scheduling during Stage 1.

## Stage 2 — Story Data Model

Add the durable data model:

- projects
- scripts
- scenes
- script_blocks
- characters
- locations
- notes
- arcs
- beats
- project_members
- comments
- drafts
- diagnostics

Goal: every feature persists to project data. No disconnected demo panels.

## Stage 3 — Character Bible and Scene Intelligence

Build:

- Character Bible
- character profiles
- wants, needs, wounds, fears
- voice style
- relationship notes
- character scene appearances
- scene metadata
- scene purpose
- conflict
- emotional shift
- setup/payoff markers

Goal: characters and scenes are connected.

## Stage 4 — Script Brain

Build project-aware diagnostics only after the editor and data model are stable:

- analyze current scene
- analyze script summary
- character consistency
- scene purpose
- dialogue voice
- pacing
- theme
- setup/payoff
- revision missions

AI suggestions must be reviewable and must not overwrite user work without approval.

## Stage 5 — Draft Revisions

Build:

- project snapshots
- scene-level revisions
- compare versions
- restore scene version
- restore full draft
- branch from snapshot
- label draft
- summarize changes
- collaborator attribution

Goal: writers can explore rewrites without losing work.

## Stage 6 — Writers' Room

Feature name: Writers' Room.

Internal sync/versioning name: ScriptSync.

Start with:

- invites
- roles
- permissions
- comments
- scene assignments
- scene locking
- change attribution
- asynchronous collaboration

Later add live presence, real-time cursors, full multiplayer editing, and chat.

Goal: collaboration preserves authorship and script integrity.

## Stage 7 — Import Pipeline

Support pasted text, txt, docx, pdf, rtf, fountain, and eventually fdx.

Detect scenes, characters, locations, dialogue, action, transitions, and formatting issues.

Always show a review screen before committing imported content.

## Stage 8 — Pitch Deck System

Generate decks from approved project data:

- title
- logline
- synopsis
- genre
- tone
- audience
- themes
- characters
- story world
- visual style
- comparables
- creator statement
- episode guide
- contact

Goal: write once, reuse project data everywhere.

## Stage 9 — Table Read Studio

Build:

- narrator voice
- character voice profiles
- scene audio generation
- regenerate selected line
- store clips
- export audio

Later add subtitles, images, and story video export.

## Stage 10 — Academy

Build:

- Guided Mode
- Professional Mode
- first screenplay walkthrough
- embedded micro-lessons
- contextual lessons from diagnostics
- exercises applied to the user's project

Goal: teach while the user writes.

## Stage 11 — Multilingual Expansion

Localization must be architected from the beginning.

Separate UI language, project language, screenplay language, Academy language, AI response language, export language, and collaborator language.

## Lovable Credit-Saving Rules

1. Implement the smallest useful step.
2. Do not create speculative UI for later stages.
3. Do not duplicate components.
4. Do not create fake panels disconnected from persistence.
5. Preserve working editor behavior before visual polish.
6. Read the relevant docs before coding.
7. Do not hardcode user-facing strings.
8. Keep Stage 1 focused on writing.
