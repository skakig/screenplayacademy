# 03_SCRIPT_BRAIN.md

# Script Brain Specification

## Purpose

Script Brain is the future whole-script AI editor for ScreenPlay Pro.

It must behave like a professional screenplay editor, not an uncontrolled ghostwriter.

Do not build Script Brain until the editor, Writing Studio, and core project data model are stable.

## Core Rule

AI may analyze, diagnose, explain, suggest, and optionally rewrite when explicitly requested.

AI must not overwrite user work without consent.

AI must not invent permanent project canon without user approval.

## Future Capabilities

Script Brain should eventually provide:

- scene purpose analysis
- whole-script analysis
- pacing diagnostics
- character consistency checks
- dialogue voice checks
- setup/payoff tracking
- theme tracking
- act and sequence structure review
- genre promise review
- revision missions
- coverage report generation

## Diagnostic Storage

AI output should be stored as diagnostics or suggestions tied to:

- project_id
- script_id
- scene_id when applicable
- character_id when applicable
- created_by
- status

Suggested statuses:

```text
pending
accepted
dismissed
applied
archived
```

## AI Mentor Archetypes

Do not impersonate real writers, filmmakers, or copyrighted characters.

Use generic mentor modes:

- Story Sage
- Script Doctor
- Structure Coach
- Dialogue Coach
- Character Analyst
- Scene Surgeon
- Producer
- Academy Tutor
- Mythic Mentor

These are modes, not real-person clones.

## Stage 1 Rule

Do not build Script Brain in Stage 1.

Only reserve UI space for future assistance if helpful, but the current priority is the editor.
