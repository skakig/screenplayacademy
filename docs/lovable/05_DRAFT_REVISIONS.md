# 05_DRAFT_REVISIONS.md

# Draft Revisions Specification

## Purpose

Draft revisions protect the writer's work and make collaboration safe.

ScreenPlay Pro must eventually support both project-level snapshots and scene-level revision history.

## Core Rule

Revision history must preserve authorship, scene integrity, and restoration options.

Do not treat revision history as a simple undo stack.

## Future Capabilities

Build revisions in this order:

1. local editor history
2. scene-level revision snapshots
3. full project draft snapshots
4. named drafts
5. compare versions
6. restore scene version
7. restore full draft
8. branch from snapshot
9. AI summary of changes
10. collaborator attribution

## Suggested Revision Objects

Drafts should track:

```text
id
project_id
script_id
name
label
created_by
created_at
metadata
```

Scene revisions should track:

```text
id
project_id
script_id
scene_id
snapshot_json
created_by
created_at
summary
```

## Compare Use Case

The app should eventually answer:

> What changed between Draft 2 and Draft 4, especially for this character's arc?

## Stage 1 Rule

Do not build full draft revisions during Stage 1.

Stage 1 must focus on local-first writing and safe persistence. However, editor architecture should not prevent future block-level and scene-level revision storage.
