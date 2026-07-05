## Writer Modes: Focus / Basic / Advanced

Reuses existing hooks and storage. No schema changes. No editor engine changes.

- Focus ↔ `useWriteMode` (localStorage)
- Basic ↔ `preferred_mode = "guided"` (+ `coaching_level` "teaching"/"active")
- Advanced ↔ `preferred_mode = "studio"`

### Pass 1 — Rename visible labels

Update `src/components/editor/WriterDeskModeToggle.tsx`:

- Relabel Writer→Focus, Studio→Advanced, Rehearsal→Basic.
- Reorder as Focus | Basic | Advanced.
- Keep internal `DeskMode` values but map cleanly; when selecting Basic, also bump `coaching_level` to `"teaching"` if currently `"off"`/`"gentle"`.
- Route all labels/toasts through `t()` (`mode.focus`, `mode.basic`, `mode.advanced`, `mode.focus.toast`, etc.).

Update `src/components/settings/ModeSettings.tsx` copy to Basic/Advanced (values unchanged).

Update `src/components/editor/StudioModeToggle.tsx` labels similarly (or retire in favor of `WriterDeskModeToggle` on the editor route).

### Pass 2 — Strict Focus Mode in editor route

In `src/routes/_authenticated/editor.$projectId.tsx`, derive `const focus = useWriteMode().on`. Gate rendering so when `focus` is true, we do NOT render:

- `GuidedRail`
- left `StoryNavigatorPane` / Script Map aside + mobile Sheet trigger (`PanelLeft`)
- right `CoachPane` aside + mobile Sheet trigger (`PanelRight`)
- `FeatureDock`
- `GuidedStepStrip`
- `CanvasToolbar` (or collapse to a tiny floating button opening a Popover of its actions)
- `StoryBuilder` empty-state helper cards
- Top-bar AI/Import/Pitch/Table Read/Storyboard buttons

Keep visible in Focus:

- `ScreenplayDocumentEditor`
- `AutosaveIndicator` (compact)
- `SaveStatusBanner` (only when erroring)
- Small centered "Focus" pill with "Exit Focus" button and hint "Esc to exit"
- `WriterDeskModeToggle` (small, top-right)

Add global `Esc` handler at the route level: if `focus` on and no modal/menu open, toggle focus off. Do not steal typing focus — attach on `window` with capture=false and ignore when target is a textarea/contenteditable, only firing when key is bare `Escape`.

### Pass 3 — First-run mode chooser

New component `src/components/editor/FirstRunModeDialog.tsx`:

- Uses `Dialog` from `@/components/ui/dialog`.
- Shows only when `onboarding.app_walkthrough_completed !== true` AND localStorage flag `lovable.modeChooser.v1` unset.
- Three cards: Focus / Basic / Advanced with the promise copy from the spec (via i18n keys).
- On select:
  - Focus → set `useWriteMode.on = true` (toggle if off), mark localStorage flag, mark walkthrough completed via `upsertOnboarding({ app_walkthrough_completed: true })`.
  - Basic → `upsertOnboarding({ preferred_mode: "guided", coaching_level: "teaching", app_walkthrough_completed: true })`, ensure Focus off.
  - Advanced → `upsertOnboarding({ preferred_mode: "studio", app_walkthrough_completed: true })`, ensure Focus off.
- Mount inside the editor route (renders under `AppShell`), gated on `onboarding` query resolved.
- Add "Reopen mode chooser" link in `ModeSettings` that clears the localStorage flag and reopens.

### Pass 4 — Simplify Basic Mode

In the editor route when `preferred_mode === "guided"` AND not in Focus:

- Hide `FeatureDock`.
- Collapse `CanvasToolbar` to a small button.
- Right pane: force `CoachPane` default tab to guided/coach; hide advanced diagnostics tabs.
- Keep `GuidedRail` + `GuidedStepStrip` + one `StepCoach` card visible; suppress additional teacher/insights panels.
- No changes to Advanced Mode behavior.

### Pass 5 — i18n keys

Add to `src/lib/i18n/keys.ts` (English fallbacks) and use via `t()` in every touched surface:

```
mode.focus, mode.basic, mode.advanced
mode.focus.tagline, mode.basic.tagline, mode.advanced.tagline
mode.focus.pill, mode.focus.exit, mode.focus.escHint
mode.chooser.title
mode.settings.reopenChooser
```

No hardcoded English in new/edited JSX.

### Pass 6 — QA

Manual pass in `/editor-lab` then `/editor/$projectId` following `docs/EDITOR_ACCEPTANCE_TESTS.md` + the three mode acceptance tests in the spec. Verify:

- First-character not lost after entering Focus.
- Esc exits Focus and restores prior panes.
- Basic hides FeatureDock but keeps guided rail + one coach card.
- Advanced unchanged.

This plan is approved with four adjustments:

1. Do not instantiate useWriteMode() separately in the editor route and toggle unless it is backed by shared context/store state. Use one Focus state source and pass it down, or refactor the hook to expose shared state.
2. Esc should exit Focus Mode even while the screenplay textarea is focused, unless a modal, slash menu, autocomplete, or popover has consumed the key event.
3. The first-run mode chooser should be gated primarily by the new versioned localStorage flag lovable.modeChooser.v1, so existing users also see it once. After selection, update onboarding and set the local flag.
4. In Settings, rename “Reopen mode chooser” to “Show setup chooser next time I open the editor” unless the chooser can actually open from that route.

Keep the rest of the plan. No schema changes. No editor engine changes. No AI behavior changes. Focus Mode is subtraction, Basic Mode is guidance, Advanced Mode is the full studio.

One more small thing: they should also hide FeatureDock in Focus Mode. The current editor route already hides side asides when writeMode.on, but FeatureDock still renders at the bottom unconditionally.  That is the exact kind of “one little leftover dock” that ruins Focus Mode.

### Files touched

- edit `src/components/editor/WriterDeskModeToggle.tsx`
- edit `src/components/editor/StudioModeToggle.tsx`
- edit `src/components/settings/ModeSettings.tsx`
- edit `src/routes/_authenticated/editor.$projectId.tsx` (gating only; no editor engine changes)
- new  `src/components/editor/FirstRunModeDialog.tsx`
- new  `src/components/editor/FocusPill.tsx` (small exit control)
- edit `src/lib/i18n/keys.ts` (add mode.* keys)
- create `docs/WRITER_MODES_FOCUS_BASIC_ADVANCED.md` (spec doc from user)

### Out of scope

No changes to `useScreenplayDocument`, `ScreenplayDocumentEditor`, `ScreenplayLine`, keymap, persistence, DB schema, or AI behavior.