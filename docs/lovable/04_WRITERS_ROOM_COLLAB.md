# 04_WRITERS_ROOM_COLLAB.md

# Writers' Room Collaboration Specification

## Feature Name

The collaboration feature is called **Writers' Room**.

The future sync/versioning engine may be called **ScriptSync**.

## Canonical Build Blueprint

Read `docs/lovable/collaboration.md` before implementing any Writers' Room work.

That document is the master collaboration plan for:

- roles
- permissions
- project membership
- invite flow
- comments
- scene assignments
- scene locks
- change attribution
- suggestions
- presence
- safe live collaboration
- RLS expectations
- Lovable pass sequencing

## Purpose

Writers' Room allows multiple people to work on the same screenplay project while preserving authorship, permissions, revision history, and script integrity.

## Core Rule

Do not build full live multiplayer editing until local-first writing, revisions, roles, permissions, and conflict protection exist.

## Roles

Suggested roles:

```text
owner
co_writer
editor
producer
commenter
viewer
actor_reader
assistant
```

## Permissions

Future permissions:

```text
can_view_project
can_view_script
can_edit_script
can_edit_assigned_scenes
can_edit_characters
can_edit_world_lore
can_comment
can_resolve_comments
can_suggest_changes
can_accept_suggestions
can_invite
can_manage_members
can_manage_roles
can_lock_scenes
can_override_locks
can_create_snapshots
can_restore_snapshots
can_export_pdf
can_export_fountain
can_generate_pitch_deck
can_generate_table_read
can_run_ai
can_manage_billing
```

## Stage Order

Build collaboration in this order:

1. project membership table
2. invite flow
3. roles and permissions
4. comments
5. scene assignment
6. scene locking
7. change attribution
8. suggestions and review mode
9. revision comparison
10. presence indicators
11. live cursors
12. full multiplayer editing

## Scene Locking First

Start with scene-level locking or section-based editing before full real-time editing.

This prevents two writers from corrupting the same part of the script.

## Authorship

Every change should eventually track:

- user_id
- timestamp
- affected block/scene
- previous value when revisioned
- new value when revisioned

## Stage 1 Rule

Do not build Writers' Room during Stage 1.

Stage 1 may include data model awareness so future collaboration is not blocked, but no collaboration UI should distract from fixing the editor.
