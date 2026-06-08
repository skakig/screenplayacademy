# LOVABLE_NEXT_PROMPT.md

Read `AGENTS.md` and `docs/SCREENPLAY_EDITOR_CONTRACT.md` first.

Your task is only Pass 1:

Create `/editor-lab` as a local-only screenplay editor proving the writing engine.

## Do not touch

- production `/editor/:projectId`
- Supabase persistence
- React Query persistence
- CoachPane
- StoryPulse
- Academy
- storyboard
- table read
- pitch
- characters
- pricing
- auth

## Goal

Prove that the screenplay writing engine works locally before integrating it into the production editor.

The lab route should have:

- one screenplay paper page
- local-only blocks
- stable local IDs
- no server IDs
- no network dependency
- no ghost button
- no fake editable div

## Required behaviors

- editor opens with one focused scene-heading line
- typing works immediately without clicking buttons
- Enter creates the correct next screenplay block
- Tab cycles block type and keeps focus
- Shift+Tab cycles backward and keeps focus
- Character → Enter → Dialogue works
- Dialogue → Enter → Character works
- click below the last line creates a real editable line
- slash command menu works
- autosize works
- 30 seconds sustained typing causes no caret jump

## Acceptance test

1. Open `/editor-lab`.
2. Type `int african desert day`.
3. Press Enter.
4. Type `The sun burns across an endless sea of sand.`
5. Press Enter.
6. Press Tab until the current line is Character.
7. Type `STEPHAN`.
8. Press Enter.
9. Type `Just a few more clicks.`
10. Press Enter.
11. Type `COMMANDER`.
12. Press Enter.
13. Type `You are lost, soldier.`
14. Keep typing for 30 seconds.

Expected:

- first character never disappears
- Enter always creates the correct next line
- Tab changes type and keeps focus
- Character → Dialogue → Character → Dialogue works naturally
- no blur
- no caret jump
- no duplicate blocks
- no accidental delete

## Stop condition

Stop after `/editor-lab` works.

Do not integrate into the production editor yet.

Do not add new product features.

The screenplay editor is the product.
