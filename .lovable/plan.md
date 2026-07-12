# Audit + Studio Menu Consolidation

## Part 1 — Where we sit vs AGENTS.md and recent docs

### Solid (shipped and matches doctrine)

- **Prime Directive (local-first editor):** `useScreenplayDocument` + `ScreenplayLine` + `screenplayKeymap` + `screenplayPersistence` in place. Acceptance-test path exists.
- **Story Intelligence:** Character Truth Engine, `truthCoach`, `writerProfileSignals`, WouldTheyDoThis flow tests all present.
- **ITS/PfHU Importation (Phases 1–5):** `story_universes`, `source_documents`, `import_extraction_runs`, entity extraction + identity resolution, `renderResolvedScreenplay`, promotion + tests, Character Bible route with versioning, Bible peek + Importation Center, PDF export (Pro-gated) and pitch embed.
- **Characters system rebuild:** Identity Engine, Candidate Inbox, Cast Landing, Guided Builder, Portrait Intelligence + Cast Style Presets + candidate grid + approval, cross-project style import, voice preview wired to table read, cached table-read audio.
- **Focus Mode / Editor UX:** `FocusAccessoryBar`, Scene Heading & Recent Character chips, snapshot capture/diff/restore/undo, snapshot-aware pitch export.
- **Producer:** Pitch Deck PDF via jsPDF, Table Read with polling + cache, Bible slides in pitch.
- **Platform:** Stripe replacement, yearly + promo codes, AI metering + Buy More Credits, admin coupons route, readiness/gating (`resolveMenuGate` + `RouteReadinessGate`), route matrix tests, i18n sweep, presence + invite flow (Phase 1).
- **Security:** anon EXECUTE revoked on `get_usage_snapshot`; webhook idempotency table.

### Partial / needs the next pass

- **Voice Studio (`SCENESMITH_VOICE_STUDIO.md`):** dictation, spoken brainstorm, session preservation not started.
- **World Building / Epic Fantasy Universe (`SCENESMITH_WORLD_BUILDING.md`, `SCENESMITH_EPIC_FANTASY_UNIVERSE_PLATFORM.md`):** Bible + universe scaffolding exists, but World Graph, Atlas, maps, cosmology, timelines, genealogy, spoiler-aware continuity — all still TODO.
- **Review Intelligence & Argument Studio:** not implemented (no fact/interp/preference separation, no counterargument tester).
- **Scene-to-Screen pipeline:** Shot Wall marked Beta; deterministic parser → Production Graph → shot approvals → asset lineage not built.
- **Arena v1 vs `SCENESMITH_ARENA_SCORING_AND_PROGRESSION.md`:** tables shipped, but solo SceneSmith Studio Score, Round 2/3 progression, blind-judging UX, release-gate checklist not complete; per doctrine Arena must stay disabled until gates pass.
- **Writers' Room / Collaboration:** Phase 1 presence only; roles, permissions, conflict protection, revision-aware multiplayer still open.
- **Academy:** lessons seeded but PfHU-driven repair loops and cumulative skill evidence not yet wired into practice.
- **i18n:** initial sweep done; ongoing enforcement for every new string.

### Doctrinal risks to watch

- Several new panels (Coach, Truth Check, Importation) risk becoming "disconnected demo panels" — must round-trip to project data model.
- Menu currently exposes many destinations that require a project even when no project is picked (the exact complaint below).

---

## Part 2 — Studio Menu consolidation ("three different links" problem)

### Diagnosis

Without a picked project, every `needsProject: true` item in **Editor**, **Producer**, and parts of **Studio** falls through `resolveMenuGate` → `blockedBy: "pick_project"` → `targetTo: "/projects"`. Visually there are ~10 rows, but they all click through to `/projects`. That is the "three different links" the user sees.

### Fix — project-context aware menu

No new business logic; presentation-layer only.

1. **Introduce a "Project context" header at the top of the sheet.**
  - When no project is picked: show a single prominent **"Pick a project"** card (icon + short copy + button) that opens `/projects`. Collapse Editor + Producer + project-dependent Studio items into a single disabled summary row: *"Editor, Producer, Characters and 6 more unlock after you pick a project."* with a chevron that expands to preview labels (still routing to `/projects`).
  - When a project **is** picked: show the project name + a lightweight switcher (link to `/projects`) and render Editor / Producer groups fully as today.
2. **Deduplicate destinations by gate.** In `StudioMenu.tsx`, when rendering a group, if every visible item currently resolves to the same `targetTo` (e.g. `/projects` or `/pricing`), render one **group-level CTA row** instead of N identical rows. Individual items stay in the manifest and reappear as soon as the block clears.
3. **Always-available rail stays flat.** School (Academy, Guided Path), Studio Lobby, Script Vault, Studio Settings, Pricing, Admin — these do not depend on a project and stay in the menu at all times.
4. **Recents strip.** Under the project header, show up to 3 recently opened projects (from an existing hook or `localStorage`) as one-tap chips so switching projects is a single click, not a detour through `/projects`.
5. **State chips unchanged.** Keep `StateBadges` (Lock / Beta / Setup / Pick a project / Needs data) but they only render on items that are actually reachable in the current context — no more "Pick a project" spam on 8 rows in a row.
6. **Telemetry.** Keep `emitMenuClick` and add a `context: "no_project" | "with_project"` field so we can measure the change.

### Files touched

- `src/components/StudioMenu.tsx` — new top "Project context" block, collapsed summary row when no project, group-level CTA collapsing, recents strip.
- `src/components/studioMenuManifest.ts` — no schema change; may add optional `collapseWhenAllBlocked: true` on a group for the dedup logic.
- `src/lib/readiness/menuGate.ts` — no logic change; export a helper `groupResolvesToSingleTarget(items, ctx)` used by the menu.
- `src/hooks/useRecentProjects.ts` (new, small) — read/write last-opened project IDs.
- No route changes. No schema changes. No changes to gating semantics — `RouteReadinessGate` remains the enforcement layer.

### Acceptance

- Open the menu with no project: **one** "Pick a project" CTA visible above the fold; Editor + Producer collapsed to a single "unlocks after project" row; School + Studio Lobby / Vault / Settings / Pricing still directly accessible.
- Open the menu after selecting a project: full Editor + Producer groups render, with per-item chips only where the *specific* item still needs data (e.g. Scene Board → "Needs scenes").
- Recents strip lets me switch between the last 3 projects without visiting `/projects`.
- Existing route-matrix tests continue to pass; add one new test that snapshots the collapsed vs expanded menu shape.

### What this plan explicitly does not do

- Does not restructure the four pillars (School / Editor / Producer / Studio) — the user liked that structure.
- Does not remove any destination — every current item is still reachable.
- Does not touch subscription, auth, editor engine, or any doctrine-critical foundation.

Say the word and I'll implement Part 2; if you want me to also open one of the Partial items above (Voice Studio, World Graph, Review Intelligence, Arena scoring, Scene-to-Screen), tell me which to queue next.

&nbsp;

Approved with the following amendments:

1. Treat this as a presentation-only Studio Menu pass. Do not modify editor behavior, entitlements, routes, schemas, or readiness semantics.
2. Collapse repeated rows only when every item is blocked by pick_project. Do not collapse separate tier-locked features merely because they all route to /pricing.
3. Academy remains always available. Guided Path remains project-dependent and must not be classified as always available.
4. The Studio group is already project-independent; do not include it in the collapsed project-dependent summary.
5. Prefer MENU_MANIFEST as the single source of menu structure and use an icon map, rather than adding more duplicated configuration to both GROUPS and the manifest. If that creates too much scope, keep both temporarily but strengthen the lockstep test.
6. Recent projects may use localStorage for convenience, but must be validated against the authenticated user’s accessible projects. Remove stale, deleted, or unauthorized entries.
7. Clicking a recent project should open that project’s Writer’s Desk, not merely /projects.
8. Add mobile, keyboard, screen-reader, collapsed/expanded, stale-recent, and project-switch acceptance tests.
9. Before implementation, report the current build, test, route-matrix, and i18n verification results.

Implement this menu consolidation only and stop after the acceptance report. Do not begin Voice Studio, World Graph, Review Intelligence, Arena scoring, or Scene-to-Screen in the same pass.