# AGENTS.md — ScreenPlay Pro / Screenplay Academy

## Product Identity

ScreenPlay Pro / Screenplay Academy is an AI-native collaborative screenplay studio.

It is not a generic dashboard, note-taking app, chatbot wrapper, or disconnected collection of panels.

The central user experience is writing a screenplay. Every feature must support writing, revising, understanding, collaborating on, pitching, teaching, performing, or exporting the screenplay.

## Prime Directive

The screenplay editor is the product.

The app must answer this immediately:

> Where do I write?

Do not work on StoryPulse, storyboard, table read, Academy polish, AI buttons, pitch pages, character panels, or visual design until the screenplay editor passes the writing acceptance test.

The user must be able to open the editor and write naturally.

## Required Documentation Reading Order

Before implementing a feature, Lovable and all coding agents must read:

1. `AGENTS.md`
2. `docs/lovable/00_DEEP_RESEARCH_SCREENPLAY_PRO.md`
3. `docs/lovable/01_IMPLEMENTATION_ROADMAP.md`
4. `docs/lovable/10_I18N.md`
5. `docs/lovable/11_DATABASE_AND_RLS.md`
6. The feature-specific file for the requested task.

For current Stage 1 editor work, also read:

- `docs/lovable/02_WRITING_STUDIO.md`
- `docs/lovable/STAGE_1_LOVABLE_PROMPT.md`

## Current Priority — Stage 1

Fix the main screenplay writing engine and Writing Studio.

The editor must behave like a professional screenplay app:

- Click page and type.
- Enter creates the next screenplay block.
- Tab changes the current block type.
- Character + Enter creates Dialogue.
- Dialogue + Enter creates Character.
- Action + Enter creates Action.
- Scene Heading + Enter creates Action.
- Click below the last line creates a new writable line.
- Typing must never depend on Supabase/network timing.
- No focus loss.
- No caret jump.
- No first-character loss.
- No duplicate blocks.
- No remounts caused by server ID changes.

## Build Sequence

Do not skip ahead. Build in this order:

1. Writing Studio/editor
2. Project, script, scene, and script block persistence
3. Character Bible connected to scenes
4. Draft revisions and local-first history
5. Script Brain diagnostics
6. Writers' Room collaboration
7. Import pipeline
8. Pitch Deck system
9. Table Read Studio
10. Academy
11. Multilingual expansion

## Architecture Rule

The screenplay editor must be local-first.

Supabase is a background sync target, not the live writing surface.

Typing path:

```text
User input → local state → rendered page → background sync
```

Never:

```text
User input → Supabase mutation → React Query update → rendered page
```

## React Key Rule

Every screenplay line must use a stable local ID as its React key.

Correct:

```tsx
<ScreenplayLine key={block.id} block={block} />
```

where `block.id` is a stable local ID such as `local-abc123`.

Supabase UUIDs must be stored separately as `serverId`.

Never replace a React key when Supabase returns a UUID.

## Editor Files

Primary editor files:

- `src/components/editor/useScreenplayDocument.ts`
- `src/components/editor/ScreenplayDocumentEditor.tsx`
- `src/components/editor/ScreenplayLine.tsx`
- `src/components/editor/screenplayKeymap.ts`
- `src/components/editor/screenplayPersistence.ts`

Route file:

- `src/routes/_authenticated/editor.$projectId.tsx`

The route should stay slim. It should fetch project data and compose layout. It should not own low-level typing logic.

## i18n Requirement

Do not hardcode user-facing strings.

All labels, buttons, empty states, errors, tooltips, modals, navigation items, onboarding text, and toast messages must use translation keys.

Bad:

```tsx
<button>Save Project</button>
```

Good:

```tsx
<button>{t('project.save')}</button>
```

See `docs/lovable/10_I18N.md`.

## AI Behavior Rule

AI must behave like a professional screenplay editor, not an uncontrolled ghostwriter.

AI may:

- analyze
- diagnose
- explain
- suggest
- optionally rewrite when requested

AI must not:

- overwrite user work without consent
- invent permanent story facts without user approval
- ignore existing project canon
- impersonate copyrighted or real-person mentors
- produce generic advice disconnected from the current script

## Collaboration Rule

Collaborative features must preserve:

- authorship
- revision history
- project ownership
- permissions
- scene integrity
- draft integrity

Do not build full live multiplayer editing until local-first writing, revisions, roles, permissions, and conflict protection exist.

## Do Not Do

Do not add new features while the editor is broken.

Do not add more buttons to compensate for broken writing.

Do not use a ghost `div role="button"` as an editor line.

Do not make the user click “Start typing.”

Do not create blocks by waiting for Supabase before allowing typing.

Do not invalidate `['blocks', projectId]` during active typing.

Do not let React Query server echo overwrite focused or dirty local text.

Do not make the toolbar or side panes steal focus while writing.

Do not create disconnected demo panels that do not persist to the core project data model.

## Required Local-First Model

```ts
type LocalBlock = {
  id: string;            // stable local ID, used as React key forever
  serverId?: string;     // Supabase UUID after persistence
  block_type: string;
  content: string;
  order_index: number;
  metadata?: any;
  status: "clean" | "dirty" | "saving" | "error";
};
```

## Required Block Transitions

Enter behavior:

- `scene_heading` → `action`
- `action` → `action`
- `character` → `dialogue`
- `dialogue` → `character`
- `parenthetical` → `dialogue`
- `transition` → `scene_heading`
- `shot` → `action`
- `note` → `action`

Tab behavior:

Cycle current block type and keep focus.

Cycle order:

1. Scene Heading
2. Action
3. Character
4. Dialogue
5. Parenthetical
6. Transition
7. Shot
8. Note

Shift+Tab cycles backward.

Shift+Enter creates a soft newline only in Action and Note blocks.

## Required Acceptance Test

This exact test must pass before any other work is considered complete:

1. Create a brand-new project.
2. Open the editor.
3. Do not click any editor buttons.
4. Type: `int african desert day`
5. Press Enter.
6. Type: `The sun burns across an endless sea of sand.`
7. Press Enter.
8. Press Tab until the current line is Character.
9. Type: `STEPHAN`
10. Press Enter.
11. Type: `Just a few more clicks.`
12. Press Enter.
13. Type: `COMMANDER`
14. Press Enter.
15. Type: `You are lost, soldier.`
16. Keep typing for 30 seconds.

Expected result:

- First character is not lost.
- Enter creates the correct next block.
- Tab changes type and focus stays.
- Character → Dialogue → Character → Dialogue works naturally.
- No blur.
- No caret jump.
- No duplicate blocks.
- No deleted blocks unless the user intentionally deletes.
- Autosave is quiet.
- Refresh restores all content.
- Simulated network failure does not stop local writing.

## Credit-Saving Workflow

Before integrating into the production editor, build and verify the editor in an isolated lab route:

`/editor-lab`

The lab route should have no Supabase, no AI, no CoachPane, no StoryPulse, no Academy, no storyboard, no table read.

The lab route must prove local writing works first.

Once `/editor-lab` passes the acceptance test, integrate the same engine into `/editor/:projectId`.

## Final Rule

If typing does not work, nothing else matters.
