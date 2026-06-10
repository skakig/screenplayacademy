# Plan — Cinematic Writer's Room Visual Redesign

Scope: `visualdesign.md` only. Import pipeline comes in a separate pass after this lands. All work is **presentation-only** — no changes to editor typing engine, persistence, auth, AI calls, Supabase schema, or routes (routes keep their URLs; only labels change). AGENTS.md prime directive holds: the screenplay page is sacred and must never lose focus, caret, or behavior.

## Guardrails (non-negotiable)

- Do **not** touch `useScreenplayDocument.ts`, `screenplayKeymap.ts`, `screenplayPersistence.ts`, `LocalDraftStore`, `SupabasePersistenceAdapter`, or the local-first block model.
- Do **not** rename route files or URLs — labels change in nav/UI strings only (keeps `/editor/:projectId`, `/characters`, etc. stable).
- Do **not** introduce remote `@import` in `src/styles.css` (font loading via `<link>` in `__root.tsx`).
- All copy goes through `t()` keys (existing i18n infra). EN strings updated; other locales stay stubbed.
- Every pass ends with the Stage-1 acceptance test still passing.

## Phased build (matches visualdesign.md §21)

### Pass V1 — Tokens & Theme System
- Replace tokens in `src/styles.css` with the two cinematic palettes (Midnight Screening Room / Writer's Desk) using `oklch` equivalents of the supplied hex.
- Add `--font-display` (Cormorant Garamond), `--font-ui` (Inter), keep `--font-script` (Courier Prime). Load via `<link>` in `__root.tsx` head.
- Add light-mode block under `:root` and dark-mode under `.dark` (or vice versa) so the existing theme toggle just works.
- Update `.screenplay-paper` and `.screenplay-canvas` to consume the new tokens (paper feels warmer in light, deeper desk in dark).
- Keep all existing token names (`--background`, `--primary`, `--accent`, `--gold`, etc.) so shadcn components and current screens don't break.

### Pass V2 — Navigation Rename + Microcopy
- Add new i18n keys (`nav.studioLobby`, `nav.scriptVault`, `nav.writersDesk`, `nav.sceneBoard`, `nav.castingWall`, `nav.storySpine`, `nav.dramaticPulse`, `nav.shotWall`, `nav.rehearsalRoom`, `nav.producerRoom`, `nav.screenplaySchool`, `nav.studioSettings`, plus AI role labels and CTA copy from §6/§19).
- Update `AppShell.tsx`, `ProjectNav.tsx`, dashboard cards, settings, etc. to use the new labels. URLs unchanged.
- Replace generic CTAs: "New Project" → "Start a Script", "Coach Recommendations" → "Director's Notes", etc.

### Pass V3 — Landing Page
- Rebuild `src/routes/index.tsx` with the cinematic split hero, layered product mockup (screenplay page + corkboard cards + dossier + storyboard frame + waveform + director note), and the section list from §7.
- Use design tokens only. No new functionality. Preserve all CTAs to `/auth` and `/pricing`.

### Pass V4 — Auth & Onboarding Atmosphere
- Restyle `src/routes/auth.tsx` with "Welcome back to the studio. Your script is waiting." copy and CTAs from §8.
- Restyle `src/routes/_authenticated/onboarding.tsx` with the 3-step "What are we making?" / "What kind of story?" / "How much help?" flow. Persist selections to existing onboarding fields (no schema change — reuse existing profile fields where possible; if a field doesn't exist, store in `profiles.onboarding_metadata` jsonb if present, otherwise defer the field and just route forward).

### Pass V5 — Studio Lobby (Dashboard)
- Restyle `dashboard.tsx` and `GuidedDashboard.tsx` as project lobby with slate-style project cards and the screenplay pipeline strip (Idea → Logline → … → Pitch). Pure visual; data sources unchanged.

### Pass V6 — Writer's Desk Layout (Editor chrome)
- In `editor.$projectId.tsx` and `ScreenplayDocumentEditor.tsx`: rename sidebars to **Script Map** (left) and **Director's Chair** (right), introduce Writer / Studio / Rehearsal mode toggle wired to the existing `useWriteMode` / `StudioModeToggle` hooks.
- Tune chrome so the paper page is visually dominant (reduce panel weight, soften borders, use new paper/desk tokens). **No edits to the line-editing engine.**

### Pass V7 — Creative Panels Polish
- Scene Board (`scenes.$projectId.tsx`) → index-card aesthetic.
- Casting Wall (`characters.$projectId.tsx`) → dossier card aesthetic, reusing existing data.
- Director's Chair (`CoachPane.tsx` / `CoachPanel.tsx`) → role-based studio tools presentation (Script Doctor, Dialogue Punch-Up, etc.) over the existing AI surface. Roles map to existing tools; no new AI endpoints in this pass.
- Rehearsal Room (`tableread.$projectId.tsx`) → theatre/table-read visual treatment.

### Pass V8 — Motion, Responsive, A11y
- Subtle hover/lift on cards, soft theme crossfade, slide-in for Director's Chair (Motion for React — already in stack).
- Tablet → drawers; mobile → writing-first with bottom sheet for block type + tools.
- Honor `prefers-reduced-motion`. Verify WCAG AA contrast on both themes. Visible focus rings on the new accent.

## Acceptance per pass
- Stage-1 typing acceptance test from `AGENTS.md` still passes.
- Theme toggle works on every screen.
- No hardcoded color utilities (`text-white`, `bg-[#...]`) introduced — semantic tokens only.
- Light mode feels like a writer's desk; dark mode feels like a midnight screening room.
- Screenplay page remains the visually dominant element on the editor route.

## Out of scope (handled in later passes)
- Import pipeline (next user-requested pass after V1–V8 land).
- Storyboard image generation, table-read voice features, pitch deck builder logic.
- Any database schema changes.
- Translating UI strings beyond EN (i18n keys added, other locale catalogues stay stubbed per current state).

## Suggested first pass to implement
**Pass V1 (tokens & theme)** — it unblocks every other pass, is low-risk, and produces an immediate visible shift toward the Cinematic Writer's Room aesthetic without touching any logic.

Confirm and I'll start with V1; we can chain V2–V8 as discrete passes so you can review each before moving on. Import pipeline plan follows after V-series lands.
