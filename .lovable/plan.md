## Make the editor feel like a real screenplay writing surface

The root cause: blocks render as styled text without input affordances, and the primary action ("write the next line") is buried behind "+ Block" buttons. We'll fix the writing surface itself before anything else.

### 1. Make every block obviously editable

In `BlockEditor` (`src/routes/_authenticated/editor.$projectId.tsx`):
- Always render a visible `placeholder` (currently set but invisible because text colour matches background).
- On focus: thin left-border accent (`border-l-2 border-primary`) + subtle `bg-primary/[0.03]` highlight on the active line. Writers always know "I am here."
- Empty block: show the placeholder text in muted color + a blinking caret affordance, so a tap-target is obvious.
- Remove the pre-seeded `INT. AFRICAN DESERT` / `STEPHAN` content. New projects open with a single empty `scene_heading` block, focused, with placeholder `INT. LOCATION - DAY` and the cursor blinking inside it.

### 2. Smart Enter / Tab (the core writing flow)

Already half-wired in `handleKeyDown` — finish it:
- **Enter** on a non-empty line → insert next block with type derived from current:
  - `scene_heading` → `action`
  - `action` → `action` (writer can Tab to character)
  - `character` → `dialogue`
  - `dialogue` → `character` (most common next beat) or `action` if previous was action
  - `parenthetical` → `dialogue`
  - `transition` → `scene_heading`
- **Enter** on an empty line → cycle to a more useful type (e.g. empty `dialogue` → `action`) instead of creating yet another empty line.
- **Tab** → cycle element type of the *current* line (already implemented, surface it visibly).
- **Shift+Enter** → soft line break inside the same block.

### 3. Auto-format on type

In `handleChange`, when content matches a pattern AND block type doesn't match, auto-switch:
- `^(INT\.|EXT\.|INT\/EXT\.|EST\.)` → `scene_heading`
- `^FADE (IN|OUT)|^CUT TO:|^DISSOLVE TO:` → `transition`
- All caps single short line (< 40 chars, no period) → `character`
- Starts with `(` → `parenthetical`
Toast a tiny "→ Scene Heading" badge once per auto-format so the user learns the system.

### 4. Bottom command bar (mobile + always-visible affordance)

New component `src/components/editor/EditorCommandBar.tsx`:
- Sticky bar at bottom of the editor section.
- Shows: **current line element type** (chip), **← Prev / Next →** element buttons (Tab equivalents), **+ Newline (Enter)**, **AI ✨ Continue**.
- On mobile this floats above the keyboard. On desktop it sits under the screenplay canvas.
- Replaces the "+ Scene Heading / + Action / ..." row as the *primary* action surface. The old buttons stay in the left rail as power-user shortcuts.

### 5. Inline AI continue (ghost text)

New file `src/lib/editor/inlineSuggest.functions.ts` — server function `suggestNextLine` that takes recent blocks + project context and returns one suggested next-line completion.

In `BlockEditor`:
- When the block is empty and focused for > 800ms, fetch a suggestion and render it as ghost text inside the textarea (overlaid via an absolutely-positioned `<span>` matching font/size).
- **Tab** accepts the suggestion, **Esc** dismisses, any keystroke discards.
- Throttle to one in-flight request per block; cancel on blur.

### 6. Empty state that doesn't seed fake content

Update `EmptyEditorTeacher` (`src/components/editor/EmptyEditorTeacher.tsx`):
- No more `INT. AFRICAN DESERT` placeholder.
- Three clear paths: **Start writing** (creates one empty scene_heading, focused) / **Use template** (FADE IN + INT. scaffold) / **Draft with AI** (existing).
- "Start writing" is the primary, biggest button.

### 7. Onboarding nudges (small, in-context)

- First time a user focuses a block: tiny toast "Press Tab to change element type · Enter for next line".
- First time they type `INT.`: toast "Auto-formatted as Scene Heading".
- Stored once-per-user in `localStorage` (`lovable.editor.hints.v1`).

### Technical changes

**New files**
- `src/components/editor/EditorCommandBar.tsx`
- `src/lib/editor/inlineSuggest.functions.ts` (server function)
- `src/lib/editor/nextBlockType.ts` (pure helper for the Enter routing table)
- `src/lib/editor/autoFormat.ts` (pure regex helpers)
- `src/hooks/useInlineSuggestion.ts`

**Edited files**
- `src/routes/_authenticated/editor.$projectId.tsx` — wire command bar, remove seeded placeholder content, refine `BlockEditor` (focus styling, Enter/Tab routing via `nextBlockType.ts`, auto-format via `autoFormat.ts`, inline suggestion overlay).
- `src/components/editor/EmptyEditorTeacher.tsx` — new copy + "Start writing" primary.

**Not in scope this turn**
- Real Final-Draft style page breaks / pagination math (already roughly handled in StoryPulse).
- Drag-to-reorder blocks.
- Voice-to-text dictation.
- Collaborative cursors.
- Touching the right-side AI panel — it stays as-is; inline AI is additive.

### Why this order

Steps 1–3 are the minimum that fix the screenshot: writers immediately see *where* and *how* to type. Step 4 makes the primary controls thumb-reachable on mobile and gives a clear "what am I editing" indicator everywhere. Steps 5–7 are the polish that makes it feel modern.

Approve and I'll build it in this order, stopping after step 4 for you to try it before I add inline AI.