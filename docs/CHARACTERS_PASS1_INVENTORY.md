# Pass 1 — Pre-Implementation Approval Document

**Status: awaiting approval.** No Pass 1 code lands until this document
is signed off. It answers the five items required by the plan
amendments: the Character Reference Inventory, merge-conflict policy,
undo policy, normalization rules, and RLS matrix.

---

## 1. Character Reference Inventory

Every place a character id, name, alias, or embedded reference lives in
the database today, and what a merge of `merged_id → primary_id` must do
to it. Any row we forget here is a data-loss bug at merge time.

### 1.1 Direct FK columns → `characters.id`

| Table | Column | On merge | Notes |
|---|---|---|---|
| `character_arcs` | `character_id` | Redirect. If both primary and merged already have an arc, keep primary's; snapshot merged's arc into `character_merges.snapshot.arcs[]`. | One-arc-per-character assumed today; validate. |
| `character_evidence_events` | `character_id` | Redirect all rows. | High-volume; batch. |
| `character_relationships` | `character_id` **and** `related_character_id` | Redirect both sides. Then deduplicate by `(character_id, related_character_id)`; merge trust/conflict/notes into a conflict record for the user to resolve. Self-relationships (both sides now equal) are deleted. | Two-sided; easy to double-count. |
| `character_repair_snapshots` | `character_id` | Redirect. | Historical; safe. |
| `character_scene_arc_states` | `character_id` | Redirect. Deduplicate by `(character_id, scene_id)`; conflicts go to `field_conflicts`. | |
| `character_scene_states` | `character_id` | Redirect. Deduplicate by `(character_id, scene_id)`; conflicts to `field_conflicts`. | |
| `character_snapshots` | `character_id` | Redirect. | |
| `script_blocks` | `character_id` | Redirect (dialogue attribution). | The user-facing change most writers will see immediately. |
| `writing_events` | `character_id` | Redirect. | Analytics only; low risk. |
| `character_candidates` | `merged_into_character_id` | Redirect if it pointed at the merged record. | |

### 1.2 Text-name and speaker-label columns

Names in text columns must be rewritten on merge so future imports and
searches resolve to the surviving character, and so `project_alias_memory`
learns the mapping.

| Table | Column | On merge |
|---|---|---|
| `characters.name` (merged record) | Move value into `character_aliases.alias_text` on primary with `alias_kind='manual'` and `source='merge'`. |
| `characters.speaker_labels[]` (merged record) | Union into primary's array. |
| `characters.canonical_name`, `display_name`, `rank`, `title` (merged record) | Copied into `character_merges.snapshot`. Primary's stay unless user picks merged's value in the conflict dialog. |
| `import_block_candidates.proposed_character_name` | **Not rewritten.** Add row to `project_alias_memory` so re-analysis resolves it. Preserves the parser's original observation. |
| `script_blocks.content` where a character name appears in action text | **Not rewritten.** Text stays as the writer wrote it. Aliases handle recognition. |

### 1.3 Array / JSON references

| Table | Path | On merge |
|---|---|---|
| `vault_scenes.linked_character_ids` (uuid[]) | Replace merged id with primary id; dedupe array. |
| `pitch_packages.character_bible` (jsonb) | Walk for any key/value equal to merged id and rewrite. Snapshot original into `character_merges.snapshot`. |
| `suggestions.payload` / `context` (jsonb) | Walk for `character_id` keys equal to merged id; rewrite. Snapshot original. |
| `arena_entries.content` and related jsonb | Not rewritten. Aliases handle recognition; user data preserved. |

### 1.4 Downstream assets

| Table | Column | On merge |
|---|---|---|
| `audio_assets` (if bound to character voice) | `character_id` (verify column) | Redirect if present. Voice assignment on primary stays unless conflict. |
| `storyboard_assets` (if bound to character) | `character_id` (verify column) | Redirect if present. |

Both tables will be inspected during the Pass 1 migration; the actual
FK columns will be confirmed against `information_schema` before code
lands, and this doc updated in the same PR.

### 1.5 Explicitly out of scope for automatic rewrite

- `arena_votes.score_character_truth` — score column, not a reference.
- `characters.character_arc` / `character_type` — self-columns on the
  merged record; captured in the snapshot.
- `pitch_packages.character_bible` **narrative prose** — walked for id
  references only, prose left alone.
- `writer_profiles.character_voice_score` — aggregate score, not an id.

---

## 2. Merge Conflict Policy

**No auto-merge of established `characters` rows.** Auto-collapse is
allowed only *before* candidate promotion, for exact formatting
variants of a single detection (`HANS`, `HANS (V.O.)`,
`HANS (CONT'D)`, `HANS (O.S.)`) — this operates on
`character_candidates`, not on `characters`.

For every merge of established records the user sees a Merge Review
dialog with:

1. **Primary vs. merged summary**: name, speaker labels, portrait, arc,
   TMH, scene count, dialogue-line count, relationships count.
2. **Field-by-field conflict grid** for every non-empty scalar field
   that differs. For each row: primary value, merged value, radio for
   which wins, "keep both as alias" for name-like fields.
3. **Relationship conflicts**: when primary and merged both have a
   relationship to the same third character, show trust/conflict/notes
   side by side.
4. **Scene-state conflicts**: when both have a state for the same
   `scene_id`, show the diff and let the user pick or take the union
   of notes.
5. **Evidence panel**: overlapping scenes, dialogue samples, alias
   history, co-occurrence check. Confidence score displayed but never
   used as authority.
6. **Confirm** requires the user to type the surviving name.

Conflict resolution rules the engine applies automatically only when
there is no conflict:

- Empty vs. non-empty scalar → non-empty wins.
- Array-valued fields (`speaker_labels`, tags, aliases) → union.
- Timestamps → keep primary's.
- Portrait / voice → primary's unless primary is empty.

---

## 3. Undo Policy

Every merge writes a full snapshot into `character_merges.snapshot`
covering: the merged `characters` row, all FK rows redirected, all
jsonb blobs rewritten, and the field-conflict resolutions the user
picked.

Undo has two paths:

**Exact undo (default when safe).** Allowed when no dependent row
touched by the merge has been modified since the merge timestamp.
Restores the merged `characters` row, redirects FKs back, and rewrites
jsonb blobs to the snapshot. `project_alias_memory` entries created by
this merge are removed.

**Conflict-aware restore.** Triggered when any dependent row has been
edited after the merge. The user sees a restore preview showing:

- Rows that will restore cleanly.
- Rows that were edited post-merge (writer's edits kept, restored
  values discarded, or vice versa — user picks per row).
- Rows created post-merge on the primary that reference concepts from
  the merged record; user chooses to keep on primary, move to
  restored, or duplicate.

Both paths are themselves logged as a new `character_merges` row of
kind `undo` so undo-of-undo works.

Merges are undoable for **90 days**; after that the snapshot is
retained but undo requires an admin confirm because dependent data has
almost certainly moved.

---

## 4. Normalization Rules

Normalization is used **only for matching**. The source name on
`characters.name` is never overwritten by normalization. Normalized
forms live in `character_aliases.normalized` and are compared there.

Applied in order:

1. Trim, collapse internal whitespace.
2. Unicode NFKD, strip combining marks (diacritics fold).
3. Uppercase.
4. Strip trailing parentheticals matching `(V\.?O\.?)`, `(O\.?S\.?)`,
   `(CONT'?D)`, `(PRE-?LAP)`, `(FILTERED)`.
5. Strip punctuation except `-` and `'` inside tokens.
6. Rank/title extraction (not removal from the display form):
   recognise leading tokens `LT.`, `LIEUTENANT`, `CAPT.`, `CAPTAIN`,
   `MAJOR`, `COL.`, `COLONEL`, `GEN.`, `GENERAL`, `SGT.`, `SERGEANT`,
   `CMDR.`, `COMMANDER`, `OBERLEUTNANT`, `HAUPTMANN`, `HERR`, `FRAU`,
   `DR.`, `MR.`, `MRS.`, `MS.`, `SIR`, `LADY`, `KING`, `QUEEN`,
   `PRINCE`, `PRINCESS`. Recorded as `rank`/`title` evidence with the
   remainder as normalized name; the untouched original stays on the
   record.
7. Numbered-role recognition: `SOLDIER #1`, `SOLDIER 1`, `SOLDIER
   ONE` — normalise the number, **never** collapse `#1` and `#2` as
   duplicates.

Similarity thresholds for propose-vs-keep-separate:

- Normalized-equal after rank strip → propose at 0.98 (rank kept as
  evidence, not merged automatically).
- Damerau-Levenshtein ≤ 1 on tokens ≥ 5 chars → propose at 0.85.
- Token-set inclusion (`HANS` ⊂ `HANS-DIETER VON ZWICK`) → propose at
  0.75, boosted by scene overlap and dialogue-style similarity, capped
  at 0.92. Never auto.
- Co-occurrence impossibility (both "identities" speak in the same
  scene) reduces confidence by 0.25 and adds an evidence warning.

Same-name distinct characters (two real `HANS` figures in one project)
are supported: the second acceptance from the inbox writes a new
`characters` row and records a "keep separate" decision in
`project_alias_memory` so the engine will not re-propose them.

---

## 5. RLS Matrix

All new tables in `public`. Standard grants (`authenticated`,
`service_role`; no `anon`). Ownership derived from `projects.user_id`
via a `has_project_access(project_id)` security-definer helper (already
used elsewhere; reused here).

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `character_aliases` | project member | project member | project member | project member |
| `characters` (added columns `canonical_name`, `display_name`, `rank`, `title`, `speaker_labels`, `merged_into`, `archived_at`) | existing policy | existing | existing (columns follow same policy) | existing |
| `character_merges` | project member | server fn only (via `service_role`) | **denied** | **denied** |
| `project_alias_memory` | project member | server fn only | server fn only | project member (to forget a mapping) |

Server functions:

- `proposeCharacterMerges(projectId)` — `requireSupabaseAuth`, checks
  project membership, read-only, safe.
- `mergeCharacters({ primaryId, mergedIds, chosenValues })` —
  `requireSupabaseAuth`, checks project membership on all ids, then
  performs the redirect + snapshot inside a single transaction using
  `supabaseAdmin` (loaded via `await import`). Refuses cross-project
  merges.
- `undoMerge(mergeId)` — same auth; runs exact-undo or conflict-aware
  restore.
- `rememberAlias`, `forgetAlias` — project member only, direct table
  writes under RLS.

Shadow-mode flag: `proposeCharacterMerges` runs during import and
writes its proposals to `character_candidates` with
`candidate_type='likely_duplicate'`. It **does not** merge anything
until the user acts.

---

## Acceptance tests Pass 1 must pass

1. `HANS`, `Hans`, `HANS (V.O.)`, `HANS (CONT'D)` from one import →
   single candidate promoted to one character; speaker labels union'd.
2. `Hans` vs `Hanns` → proposed at ~0.85, never auto.
3. `OBERLEUTNANT HANS-DIETER VON ZWICK` vs `LT. HANS` → proposed with
   scene evidence, rank captured, source names unchanged.
4. Two `MAJOR FRIEDRICH` records → user-confirmed merge preserves
   union of relationships, scenes, notes, portrait, TMH. `undoMerge`
   restores both byte-for-byte on snapshotted fields.
5. Post-merge edit → `undoMerge` triggers conflict-aware restore, not
   silent overwrite.
6. `LT. HANS` re-imported after merge → resolves via
   `project_alias_memory`, no new candidate.
7. Two genuinely distinct `HANS` characters kept separate → engine
   does not re-propose after user's "keep separate" decision.
8. `SOLDIER #1` and `SOLDIER #2` → never proposed as duplicates.
9. Numbered vs. named same import (`SOLDIER #1`, `SOLDIER #2`,
   `PRIVATE KRUEGER`) → three distinct candidates.
10. Cross-project merge attempt → refused with 403.
11. Merge with active RLS as a non-member of the project → refused.
12. 500-character project import → propose/merge stays under 5s p95.

Once this document is approved, Pass 1 begins with the migration and
the pure engine (no UI beyond the Merge Review dialog behind a debug
link).
