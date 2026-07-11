# Characters System — Rebuild Doctrine

Status: **Pass 0 — Freeze in effect.** No further "polish" edits on the deprecated
Characters surfaces (see file list below). Passes 1–6 replace them.

---

## What "Passes 3–5" actually shipped (and did not)

The prior commit titled *"Completed passes 3–5"* modified only two files: the
existing Characters route and the existing character modal. It did **not**
deliver the approved architecture. Concretely, the following remained
unchanged and are the reason we are restarting:

- `CastCleanupPanel` is still rendered directly on the landing page.
- `DetectedSpeakersPanel` is still a separate panel below the grid — the
  two concepts (suspicious saved characters vs. detected speakers) were
  supposed to become one Detected Characters Inbox.
- The permanent right-side inspector is still there (the cramped iPad
  layout we agreed to remove).
- Filters and buckets are still driven by `group_name` (Main Cast /
  Supporting Cast / Antagonists / …) — the promised split into
  **Importance** (Lead / Supporting / Minor / Background) and **Story
  Function** (Protagonist / Antagonist / Mentor / Foil / …) is not the
  primary UI.
- There is no visible character-merge workflow. Duplicate `Hans`, duplicate
  `Major Friedrich`, duplicate `Oberleutnant` records remain unresolved.
- There is no alias / spelling / rank-title intelligence in the UX.
- Guided mode is still inside `CharacterProfileDialog` — 11 flat tabs were
  reorganized into 4 pillars with the same forms nested underneath. A
  beginner still opens a modal showing *Build | Identity | Psychology |
  Story | Production* while trying to answer the first question.
- Advanced vs. Guided is not a genuinely different experience; both revolve
  around the same modal.
- Portrait generation exists but is buried inside Production → Visual with
  no brief, provider choice, candidate set, canonical/alternate model, or
  lineage.
- Cards on the landing page are still information-poor (initial + name +
  icon row + percentages) rather than showing want / pressure / arc.
- Inferred / temporal data is labelled with a chip but still commingled
  with canonical fields — no proposal lifecycle.

This document is the single source of truth for the rebuild.

---

## Deprecated surfaces (frozen)

Do not extend, restyle, refactor, or feature-flag these files. They will be
retired at the pass indicated.

| File | Retired at |
|---|---|
| `src/components/characters/CharacterProfileDialog.tsx` | End of Pass 5 |
| `src/components/characters/CastCleanupPanel.tsx` | Unmounted at Pass 2, deleted at Pass 3 |
| `src/components/characters/DetectedSpeakersPanel.tsx` | Unmounted at Pass 2, deleted at Pass 3 |
| `src/routes/_authenticated/characters.$projectId.tsx` | Route body replaced at Pass 3 |

Each file carries a `// DEPRECATED — see docs/CHARACTERS_REBUILD.md` header.

---

## Rules that apply to every pass

1. **One pass at a time.** No parallel polish.
2. **Acceptance is behavioural.** A pass is complete only when the
   scripted end-to-end walkthrough is demonstrated. "Fields exist" and
   "route exists" do not count.
3. **Screenshot approval gates visual passes** (3, 4, 5, 6) *before* code
   is written, at iPad landscape (1180×820).
4. **`CharacterProfileDialog` is not extended.** It is retired, not
   re-tabbed.
5. **Every merge of established records requires human confirmation.**
   Auto-merge is permitted only for exact formatting variants of a single
   detection candidate before canonical creation (e.g. `HANS`,
   `HANS (V.O.)`, `HANS (CONT'D)` collapsing into one candidate).
6. **Rank / title / temporal labels / co-occurrence are evidence**, not
   destructive normalization rules.
7. **Guided quality checks are advisory.** "Continue writing" is always
   available.
8. **Inferred material is a versioned proposal**, not an alternate value
   in the same column.
9. **Structural junk is rejected pre-persistence** at the parser. The
   Structural Junk inbox is for existing corruption and genuinely
   ambiguous detections.
10. **The identity engine runs in shadow mode** before it changes import
    behaviour.

---

## The seven passes

| # | Name | Ships |
|---|------|-------|
| 0 | Freeze & Acknowledge | This doc + deprecation headers. No user-visible change. |
| 1 | Identity Resolution & Merge Engine | Schema, pure engine, server fns, one merge-review dialog behind a debug link. Shadow mode. |
| 2 | Detected Characters Inbox | Single drawer replaces both existing panels. Parser writes candidates, not characters. |
| 3 | Landing Page | Portrait-led cards, Importance + Story Function filters, no inspector, no cleanup on page. |
| 4 | Guided Character Builder | Dedicated full-screen route, one question at a time, role-scaled depth, ITS/PfHU-driven. |
| 5 | Character Bible Workspace | Dedicated full-screen route with Read/Edit/Analyze modes and proposal lifecycle. `CharacterProfileDialog` deleted. |
| 6 | Portrait Workflow | Brief → provider → 4 candidates → canonical + alternates + lineage. |

Full acceptance criteria for each pass live in `.lovable/plan.md`.

---

## Amendments accepted at plan approval

- Do not auto-merge existing canonical records.
- Before Pass 1 code, produce a **Character Reference Inventory** and
  policies for merge conflicts, undo, normalization, and RLS. See
  `docs/CHARACTERS_PASS1_INVENTORY.md`. Pass 1 code does not begin until
  that document is approved.
- Exact undo is permitted only when no dependent data has changed since the
  merge; otherwise a conflict-aware restore workflow is used.
- Rank / title / temporal labels / co-occurrence are evidence signals, not
  normalization that overwrites the source name.
- Portrait generation must include cost preview, provider/model lineage,
  privacy & rights metadata, moderation, failure handling, and a
  configurable candidate count.
- Additional acceptance tests: same-name distinct characters, numbered
  roles (`SOLDIER #1`, `SOLDIER #2`), young/older variants, keep-separate
  memory, merge conflicts, post-merge edits, large casts, real Supabase
  RLS.
