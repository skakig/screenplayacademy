# Characters System — Real Rebuild Plan (Pass 0 → Pass 6)

Your critique is accurate. The previous "Passes 3–5" changed only the route file and the modal — it reorganized the old UI instead of replacing it. This plan freezes that work and rebuilds in small, verifiable passes. Each pass ships one thing, has an explicit acceptance test, and cannot be marked complete until that test is demonstrated end‑to‑end.

Guiding rules for every pass:

- **No parallel polish.** One pass at a time.
- **Acceptance is behavioral, not "files exist."** Screenshot + scripted walkthrough required.
- **Screenshot approval gates all visual passes** (3, 4, 5, 6) before code is written.
- `**CharacterProfileDialog` is deprecated** and removed from the primary workflow at Pass 5. It is not re‑nested or re‑tabbed.
- **iPad landscape (1180×820) is the design target.**

---

## Pass 0 — Freeze & Acknowledge (no user‑visible changes)

Purpose: stop the drift, write the truth down, and lock the old surfaces so no further "polish" touches them.

- Add `docs/CHARACTERS_REBUILD.md` documenting: what Passes 3–5 did not deliver (cleanup panel still on page, DetectedSpeakersPanel still separate, inspector still present, `group_name` filters still primary, no merge, no portrait flow, guided mode still inside modal), and the 7‑pass sequence below.
- Add a `// DEPRECATED — do not extend. See docs/CHARACTERS_REBUILD.md` header to `CharacterProfileDialog.tsx`, `CastCleanupPanel.tsx`, `DetectedSpeakersPanel.tsx`, and the current `characters.$projectId.tsx` route.
- No feature work. No layout change.

Acceptance: doc exists, headers in place, git diff contains only comments/docs.

---

## Pass 1 — Identity Resolution & Merge Engine (backend + one dialog)

The whole rebuild depends on this. Built and tested before any UI redesign.

**Data model (migration)**

- `character_aliases` (character_id, alias_text, alias_kind: `speaker_label` | `rank_title` | `variant` | `manual`, normalized, confidence, source, created_by).
- `characters` gains `canonical_name`, `display_name`, `rank`, `title`, `speaker_labels text[]`, `merged_into` (nullable FK), `archived_at`.
- `character_merges` (id, project_id, primary_id, merged_ids jsonb, field_conflicts jsonb, chosen_values jsonb, redirected_refs jsonb, snapshot jsonb, created_by, created_at). Enables undo.
- `project_alias_memory` (project_id, alias_text_norm, resolved_character_id) — remembered mappings for future imports.
- RLS + GRANTs per project ownership; snapshot table admin‑only writes via server fn.

**Pure engine (no React, no Supabase)**

- `src/lib/characters/identity/normalize.ts` — casing, punctuation, `(V.O.)`/`(O.S.)`/`(CONT'D)` stripping, rank/title extraction (`LT.`, `MAJOR`, `OBERLEUTNANT`, `COMMANDER`, etc.), diacritics fold.
- `src/lib/characters/identity/match.ts` — exact‑normalized, alias hit, Damerau‑Levenshtein for spelling variants, token‑set for multiword, rank‑stripped equivalence, co‑occurrence impossibility check (two "same" characters speaking in the same scene lowers confidence), scene overlap boost.
- `src/lib/characters/identity/proposeDuplicates.ts` — returns `{primary, candidates[], evidence[], confidence, action: "auto_merge"|"propose"|"keep_separate"}`.
- Confidence thresholds: ≥ 0.95 with rank/parenthetical‑only difference → auto; 0.75–0.95 → propose; < 0.75 → keep separate.

**Server functions**

- `proposeCharacterMerges(projectId)`, `mergeCharacters({ primaryId, mergedIds, chosenValues })`, `undoMerge(mergeId)`, `rememberAlias(projectId, alias, characterId)`.
- Merge redirects FKs across: `script_blocks`, `character_relationships` (both sides, dedupe), `character_scene_states`, `character_scene_arc_states`, `character_arcs`, `character_evidence_events`, `character_snapshots`, `character_candidates`, `suggestions`, `audio_assets`, `storyboard_assets`. Snapshot everything before writing.

**Only UI:** a single "Merge review" dialog reachable from a temporary debug link. Not integrated into the landing page yet.

**Acceptance tests (Vitest + one manual):**

1. `HANS`, `Hans`, `HANS (V.O.)`, `HANS (CONT'D)` → auto‑merge, single character, all speaker labels stored.
2. `Hans` vs `Hanns` → proposed at ~0.82, not auto.
3. `OBERLEUTNANT HANS‑DIETER VON ZWICK` vs `LT. HANS` → proposed with scene evidence panel showing overlapping scenes and dialogue counts.
4. Two `MAJOR FRIEDRICH` records → merge preserves union of relationships, scenes, notes, portrait; `undoMerge` restores both exactly (byte‑for‑byte on snapshotted fields).
5. After merging `LT. HANS` into `Hans‑Dieter von Zwick`, re‑importing a script containing `LT. HANS` resolves automatically via `project_alias_memory`.

**Not in this pass:** landing page redesign, inbox UI, portrait, guided mode.

---

## Pass 2 — Detected Characters Inbox (one drawer, replaces both panels)

- New `src/components/characters/inbox/DetectedCharactersInbox.tsx` — right‑side **drawer** (not a page section), opened from a single header badge `N need review`.
- Tabs inside: **New speakers · Likely duplicates · Spelling variants · Structural junk · Mentioned only · Ignored**.
- Each row shows evidence (scene count, dialogue count, sample line, confidence, "why we grouped these").
- Actions: Accept · Merge into… · Keep separate · Mark as mentioned · Ignore. Every action reversible from the **Ignored** tab.
- Deletes `CastCleanupPanel` and `DetectedSpeakersPanel` from the route render tree. Files stay for now but are unimported.
- Parser writes into `character_candidates` with `candidate_type: speaker | mentioned | structural_junk | background` — no more direct writes to `characters` from detection.

Acceptance: on a real screenplay import, the landing page shows only the badge; opening the drawer reveals categorized items; merging from the drawer uses the Pass 1 engine and produces one character. Screenshot approval required before Pass 3.

---

## Pass 3 — Characters Landing Page (visual rebuild, no profile work)

New route body at `/characters/:projectId`. Wireframe/screenshot approval **before** code.

- Header: project cast summary (lead / supporting / minor / background counts, attention count, inbox badge).
- Filters: **Importance** (Lead/Supporting/Minor/Background) and **Story function** (Protagonist/Antagonist/Mentor/Foil/Ally/Love Interest/Threshold Guardian/Custom). Old `group_name` filters removed from primary UI (kept as an "Advanced" toggle only).
- No permanent right‑side inspector. No cleanup panel on page.
- Portrait‑led cards showing: portrait, name, importance chip, story function, one‑line want, one‑line pressure, arc summary, scene + relationship counts, attention dot.
- iPad‑landscape first; desktop scales up.

Acceptance: iPad screenshots at 1180×820 for empty, sparse, and populated projects — approved before merge.

---

## Pass 4 — Guided Character Builder (dedicated full‑screen route)

Route: `/characters/:projectId/:characterId/build`. Not a modal. `CharacterProfileDialog` is not used.

- Single‑question flow. One prompt visible at a time with explanation, example, optional "Tell me more," Save & Continue.
- Question sequence scaled by importance:
  - Background: name · visual distinction · function (3 steps).
  - Minor: + goal · voice cue (5 steps).
  - Supporting: + want · fear · contradiction · one key relationship · arc contribution (10 steps).
  - Lead: full sequence including TMH baseline/stress/aspirational, wound→lie linkage, 2–3 relationships, transformation arc.
- Question sequencing driven by `resolveWriterGuidance` (existing ITS/PfHU signals) — depth of explanation, whether examples are shown, whether concept labels appear.
- Quality gate at the end: actionable want, want≠need, wound↔lie linkage, meaningful contradiction, plausible arc, TMH range coherent, at least one relationship, distinguishable voice cue. Result: "Foundation complete · 2 areas worth strengthening" (not "9/9").
- Exit CTAs: **Review Character** (→ Pass 5 Bible) · **Generate Portrait** (→ Pass 6) · **Return to Script**.

Acceptance: cold‑start walkthrough for each importance tier produces a coherent character in the promised step count with no advanced tabs visible.

---

## Pass 5 — Character Bible Workspace (dedicated full‑screen route)

Route: `/characters/:projectId/:characterId`. Not a modal. Replaces `CharacterProfileDialog` in the primary flow (dialog file deleted at end of pass).

- Left rail sections: **Summary · Identity · Psychology · Story · Production · Review**.
- Three modes on every section: **Read** (portrait of the person, default landing), **Edit**, **Analyze** (Truth Check, contradictions, continuity warnings). Editing is not the default.
- Inferred/Temporal data lives in a **proposals** column with lifecycle `suggested → accepted → dismissed → superseded`, evidence, and provenance — not commingled with canonical fields.
- Merge, alias management, and speaker label editing live in the Identity section (uses Pass 1 engine).

Acceptance: opening a completed character lands on Summary (Read), not a form; accepting an inferred proposal moves it to canonical with provenance; the old modal file is removed and no import references it.

---

## Pass 6 — Portrait Workflow (first‑class, not buried)

- Compile visual brief from Identity + Psychology + Production fields; user can edit brief.
- Provider selection (Lovable AI Gateway default; premium tier available).
- Generate 4 candidates → approve **Canonical** portrait, keep alternates as **Alternate appearances** (age, wardrobe, condition).
- Cards on the landing page render canonical portrait; Bible shows the whole set with lineage (brief version, provider, prompt, date, approver).
- Continuity reference pack export (zip of canonical + alternates + brief) for downstream storyboard/casting.
- Triggerable from the end of the Guided Builder ("Generate Portrait") and from Bible → Production.

Acceptance: end‑to‑end from Guided Builder exit → 4 candidates → set canonical → card updates on landing page → alternates retained with lineage.

---

The seven-pass rebuild is approved in principle, with the following required amendments.

Do not automatically merge existing canonical character records. Exact formatting variants may resolve to one candidate before canonical creation, but every merge of established records requires human confirmation.

Before implementing the merge engine, produce a Character Reference Inventory of every table, column, JSON path, and downstream asset that references a character. Merge and undo behavior must be defined for each reference.

Exact undo is permitted only when no dependent data has changed since the merge. Otherwise provide a conflict-aware restore workflow.

New obvious structural junk must be rejected before candidate persistence. The Structural Junk inbox is primarily for existing corruption and genuinely ambiguous detections.

Run the identity engine in shadow mode before replacing the current import behavior.

Treat ranks, titles, temporal labels, and co-occurrence as evidence—not destructive normalization rules.

Implement inferred character proposals as a versioned, evidence-backed lifecycle model rather than a single JSON column.

Guided quality checks are advisory and must always permit “continue writing.”

Portrait generation must include cost preview, provider/model lineage, privacy and rights metadata, moderation, failure handling, and selectable candidate count.

Add acceptance tests for same-name distinct characters, numbered roles, young/older variants, keep-separate memory, merge conflicts, post-merge edits, large casts, and real Supabase RLS.

Pass 0 may begin immediately. Before Pass 1 code, return the schema/reference inventory, merge conflict policy, undo policy, normalization rules, and RLS matrix for approval.

## What we are explicitly NOT doing

- No new character fields.
- No re‑tabbing or re‑nesting of the existing modal.
- No "one more polish pass" on the current route.
- No merges without evidence review (except the narrow auto‑merge band in Pass 1).

## Sequencing & credit discipline

- Passes ship in order. No pass starts before the prior pass's acceptance is demonstrated.
- Visual passes (3, 4, 5, 6) require screenshot approval **before** implementation, not after.
- Each pass gets its own commit and PR title matching the pass name — no more multi‑pass commits.

If you approve, I will start with **Pass 0** (freeze + doc + deprecation headers) and then move to **Pass 1** (identity/merge engine with the five acceptance tests) before touching any UI.