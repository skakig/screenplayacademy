## SceneSmith Studio — Studio Lobby Polish Pass

Scope: `src/routes/_authenticated/dashboard.tsx` only (plus a couple of i18n key additions). No editor, autosave, payments, entitlements, AI, or schema changes.

### Fix 1 — Quick-start cards preselect project type
- Add `const [initialType, setInitialType] = useState("Feature Film")` in `Dashboard`.
- Quick-start card `onClick`: `setInitialType(value); setOpen(true);`
- Change `NewProjectDialog` to accept `initialType` and `open` as props; use a `useEffect` keyed on `[open, initialType]` to reset `form.project_type` (and clear title/logline) whenever the dialog opens, so a second click with a different type actually re-seeds the select.

### Fix 2 — Metadata rebrand
- `head()` title: `"Studio Lobby — SceneSmith Studio"` (was `Screenplay Academy`).

### Fix 3 — Continue CTA when projects exist
- Compute `mostRecent = projects[0]` (list is already ordered by `updated_at desc` via the existing query; verify while editing and sort defensively if not).
- In the marquee header, when `mostRecent` exists, render a primary `Link` button: `Continue: {mostRecent.title}` → `/editor/$projectId`. Truncate long titles.
- Demote the "Start a Project" button next to it to `variant="outline"` so the continue action is the visual primary.
- Empty state ("The page is waiting") keeps `Start a Project` as primary.

### Fix 4 — "Start a Script" → "Start a Project"
- Rename in three places: hero button (line 159), empty-state button (line 196), and `NewProjectDialog` title (line 261).

### Fix 5 — Touch/iPad affordance on project cards
- Replace the hover-only `Open desk →` span with an always-visible `Open Writer's Desk →` on touch/small widths and hover-reveal on desktop:
  - Base: `opacity-100 md:opacity-60 md:group-hover:opacity-100` so it's always visible on mobile/tablet and softly present on desktop until hover.

### i18n
- Add the new visible strings to `src/lib/i18n/keys.ts` under `dashboard.*` (`studio_lobby`, `welcome_back`, `tagline`, `start_project`, `continue_prefix`, `new_on_slate`, `in_production`, `scripts_on_lot`, `setting_stage`, `page_waiting`, `page_waiting_body`, `open_writers_desk`, `updated_prefix`, `logline_pending`, `rolling`, `open_studio`, dialog field labels). Route them through `t()` in the dashboard. Keeps the codebase-wide i18n discipline consistent with the recent Academy/FeatureDock sweep.

### Acceptance
- Click "TV Pilot" → dialog opens with Type=TV Pilot preselected; same for Stage Play, Comic Script, Audio Drama, Short Film, Feature Film.
- Reopening with a different quick-start updates the Type select.
- Browser tab title reads "Studio Lobby — SceneSmith Studio".
- With ≥1 project, a `Continue: <title>` primary CTA appears and links to that project's editor; "Start a Project" is secondary.
- With 0 projects, "Start a Project" is the only/primary CTA.
- On tablet widths, "Open Writer's Desk →" is visible on cards without hovering.
- No changes to editor, autosave, payments/webhooks, entitlements, DB schema, or AI.

### Out of scope
Redesign of card layout, pipeline strip, PROJECT_TYPES list, or AppShell chrome.
