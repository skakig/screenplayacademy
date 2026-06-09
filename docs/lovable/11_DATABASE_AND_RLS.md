# 11_DATABASE_AND_RLS.md

# Database and RLS Guidance

## Purpose

ScreenPlay Pro must use a coherent project data model. Do not create disconnected UI panels that do not persist to project-owned tables.

The screenplay editor is local-first, but project data must persist safely in Supabase.

## Core Rule

All project-owned tables must enforce user ownership or membership through RLS.

No user should ever see, edit, export, or analyze another user's private project unless they are an approved project member.

## Core Tables

Recommended long-term tables:

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
```

Stage 1 should focus on:

```text
profiles
projects
scripts
script_blocks
scenes
characters
notes
```

## Project Membership

Use `project_members` as the central authorization table for collaboration.

Suggested fields:

```text
id uuid primary key
project_id uuid references projects(id)
user_id uuid references auth.users(id)
role text
status text
created_at timestamptz
updated_at timestamptz
```

Suggested roles:

```text
owner
co_writer
editor
producer
commenter
viewer
```

## Permission Concepts

Future permissions may include:

```text
can_edit_script
can_edit_characters
can_comment
can_invite
can_export
can_manage_billing
can_run_ai
can_generate_table_read
can_generate_pitch_deck
```

Stage 1 can keep permissions simple, but the schema should not block future Writers' Room collaboration.

## Script Blocks

The editor should store structured blocks, not only one giant screenplay text blob.

Suggested fields:

```text
id uuid primary key
project_id uuid references projects(id)
script_id uuid references scripts(id)
scene_id uuid references scenes(id) null
block_type text
content text
order_index integer
metadata jsonb
created_by uuid references auth.users(id)
updated_by uuid references auth.users(id)
created_at timestamptz
updated_at timestamptz
```

Editor local state should use a stable local ID and store the Supabase UUID separately as `serverId`.

Do not use the Supabase UUID as a React key if it can replace a local key and remount the editor line.

## Scenes

Suggested fields:

```text
id uuid primary key
project_id uuid references projects(id)
script_id uuid references scripts(id)
title text
scene_heading text
location text
time_of_day text
order_index integer
summary text
purpose text
conflict text
emotional_shift text
metadata jsonb
created_by uuid references auth.users(id)
updated_by uuid references auth.users(id)
created_at timestamptz
updated_at timestamptz
```

Stage 1 can derive scenes from scene heading blocks and gradually persist richer scene records.

## Characters

Suggested fields:

```text
id uuid primary key
project_id uuid references projects(id)
name text
description text
role text
want text
need text
wound text
fear text
voice_style text
metadata jsonb
created_by uuid references auth.users(id)
updated_by uuid references auth.users(id)
created_at timestamptz
updated_at timestamptz
```

Stage 1 only needs name and description if necessary.

## Notes

Notes should link to project, scene, character, or script block when possible.

Suggested fields:

```text
id uuid primary key
project_id uuid references projects(id)
scene_id uuid null
character_id uuid null
script_block_id uuid null
content text
created_by uuid references auth.users(id)
updated_by uuid references auth.users(id)
created_at timestamptz
updated_at timestamptz
```

## RLS Policy Concept

For project-owned tables, a user can access rows if they are a member of the project.

Conceptual policy:

```sql
exists (
  select 1
  from project_members pm
  where pm.project_id = project_id
    and pm.user_id = auth.uid()
    and pm.status = 'active'
)
```

For owner-only actions, require role = `owner`.

For edit actions, require a role with edit permission.

## AI Data Safety

AI functions must only receive project data the requesting user is authorized to access.

Never run AI analysis on project data without checking project membership.

AI outputs should be stored as diagnostics or suggestions tied to project_id and created_by.

## Collaboration Safety

Before full real-time collaboration, build:

- project membership
- roles
- comments
- scene locks
- revisions
- change attribution

Do not build full live multiplayer editing until these foundations exist.

## Stage 1 Rule

Stage 1 must not break typing to satisfy persistence.

Typing is local-first.

Supabase sync is background.

If a save fails, local writing must continue and the user must see a calm save status.
