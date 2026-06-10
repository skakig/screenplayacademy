# SceneSmith AI — Visual Design Direction

**Purpose:** Give Lovable a clear visual and UX target for the SceneSmith AI redesign.  
**North Star:** SceneSmith should feel like a private AI writer’s room, not a generic SaaS dashboard.

---

## 1. Core Problem

The current app has useful functionality, but the presentation feels too close to TMH / generic SaaS:

- Heavy dark/gold styling
- Dense dashboards and side panels
- Progress widgets that feel analytical instead of creative
- Generic labels like Dashboard, Coach, AI Assistant Tools
- The screenplay page competes with surrounding UI
- Auth and onboarding feel like a locked gate instead of an invitation

SceneSmith is a screenplay app. It should make the writer feel like they have entered a living creative studio where the movie can be written, seen, heard, rehearsed, and pitched.

The product should say: **“Welcome to your studio. The page is waiting.”**

---

## 2. Design Language

Use the design language: **Cinematic Writer’s Room**.

SceneSmith should feel like a blend of:

- Writer’s desk
- Film studio
- Screenplay page
- Corkboard scene wall
- Director’s chair
- Casting wall
- Rehearsal room
- Pitch room
- Screenplay school

The mood should be cinematic, warm, creative, intelligent, professional, slightly magical, and useful. It should not feel childish, corporate, overly serious, or TMH-like.

---

## 3. Design Principles

### The Page Is Sacred

The screenplay page is the hero. Navigation, sidebars, AI panels, progress cards, warnings, and tabs must never overpower the page.

### Creative, Not Administrative

Avoid making SceneSmith feel like project management software. Use screenplay-native language and visual metaphors.

### Show the Movie

Every major feature should support the promise:

> Write the script. See the scene. Hear the table read.

### Less Chrome, More Atmosphere

Use fewer heavy borders and boxes. Use subtle depth, paper surfaces, soft glow, scene-card textures, and elegant hierarchy.

### Dual Mood Support

Light and dark mode should feel like two creative spaces, not simple color inversions.

---

## 4. Theme Modes

## Dark Mode: Midnight Screening Room

Dark mode should feel like a quiet private film studio after hours.

Suggested palette:

```css
:root.dark {
  --bg-canvas: #070B10;
  --bg-studio: #0B1118;
  --bg-panel: #111821;
  --bg-panel-soft: #151E29;
  --paper: #F4EEE3;
  --paper-soft: #EFE5D6;
  --ink: #171411;
  --text-primary: #F4EFE8;
  --text-secondary: #B9C0C9;
  --text-muted: #7E8793;
  --accent: #D99A2B;
  --accent-soft: #F1BF5A;
  --accent-glow: rgba(217, 154, 43, 0.28);
  --blue-muted: #5E8FA3;
  --red-soft: #C75C46;
  --green-soft: #7B9E72;
  --border-subtle: rgba(255, 255, 255, 0.08);
  --focus-ring: rgba(217, 154, 43, 0.55);
}
```

## Light Mode: Writer’s Desk

Light mode should feel like a clean writing desk with screenplay paper, coffee, pencil notes, and morning light.

Suggested palette:

```css
:root.light {
  --bg-canvas: #F5F0E8;
  --bg-studio: #FBF7EF;
  --bg-panel: #FFFFFF;
  --bg-panel-soft: #F7F1E8;
  --paper: #FFFDF7;
  --paper-soft: #F8F0E3;
  --ink: #171411;
  --text-primary: #1D1A16;
  --text-secondary: #5D6470;
  --text-muted: #8A8177;
  --accent: #C9861A;
  --accent-soft: #E2A942;
  --accent-glow: rgba(201, 134, 26, 0.22);
  --blue-muted: #6F8FA3;
  --red-soft: #B85C4A;
  --green-soft: #6F8E6B;
  --border-subtle: rgba(35, 29, 22, 0.09);
  --focus-ring: rgba(201, 134, 26, 0.48);
}
```

---

## 5. Typography

Use three typographic voices:

1. **Display / cinematic headlines:** `Cormorant Garamond`, `Playfair Display`, `Libre Baskerville`, or `Georgia`.
2. **Interface text:** `Inter`, `Satoshi`, `Manrope`, or system sans.
3. **Screenplay page:** `Courier Prime`, `Courier Final Draft`, or `Courier New`.

Suggested tokens:

```css
--font-display: "Cormorant Garamond", "Playfair Display", Georgia, serif;
--font-ui: "Inter", system-ui, sans-serif;
--font-script: "Courier Prime", "Courier New", monospace;
--text-hero: clamp(3.5rem, 7vw, 7rem);
```

---

## 6. Rename the App Around Studio Spaces

| Current | New User-Facing Label | Feeling |
|---|---|---|
| Dashboard | Studio Lobby | Project home / production status |
| Projects | Script Vault | All scripts and drafts |
| Editor | Writer’s Desk | Primary writing surface |
| Scenes | Scene Board | Corkboard / index cards |
| Characters | Casting Wall | Character dossiers |
| Story Arc | Story Spine | Structure, arcs, reversals |
| StoryPulse | Dramatic Pulse | Rhythm, conflict, emotional charge |
| Storyboard | Shot Wall | Visual scene planning |
| Table Read | Rehearsal Room | Cast voices and performance |
| Pitch | Producer Room | Logline, synopsis, deck |
| Academy | Screenplay School | Guided learning path |
| Settings | Studio Settings | Preferences and AI controls |

Also replace:

- Coach → Director’s Chair
- AI Assistant Tools → Studio Tools
- Coach Recommendations → Director’s Notes
- Project Progress → Production Progress
- New Project → Start a Script
- Add Scene → Add Scene Card
- Run Tool → Run Script Doctor / Run Dialogue Punch-Up

---

## 7. Landing Page

Keep the core headline:

> Write the script.  
> See the scene.  
> Hear the table read.

Redesign the hero as a cinematic split layout.

### Left Side

- Badge: **AI-native screenwriting studio**
- Hero line above
- Supporting copy:
  > SceneSmith AI is your private writer’s room: screenplay editor, story coach, character bible, storyboard lab, table-read studio, and screenplay school in one place.
- Primary CTA: **Start Writing Free**
- Secondary CTA: **Open Sample Script** or **Watch 90-sec Demo**

### Right Side

Layered product mockup:

1. Center screenplay page
2. Corkboard scene cards behind it
3. Character dossier card
4. Small storyboard frame
5. Table-read waveform
6. Director’s note annotation

The landing page should communicate: **this is not only a text editor; this is where the movie starts becoming visible and audible.**

Suggested sections:

1. Hero
2. Everything a writer needs
3. From idea to pitch production pipeline
4. Writer’s Desk preview
5. Casting Wall preview
6. Rehearsal Room preview
7. Screenplay School preview
8. Pricing
9. Final CTA

Avoid generic SaaS gradient blobs and TMH-style hierarchy/progress motifs.

---

## 8. Auth and Onboarding

Auth should feel like entering the studio.

### Sign-In Copy

- Title: **Welcome back to the studio.**
- Subtitle: **Your script is waiting.**
- Google button: **Continue with Google**
- Email CTA: **Enter Studio**
- New user link: **Start your first script**

### New User First Experience

Step 1: **What are we making today?**

- Feature Film
- Short Film
- TV Pilot
- Stage Play
- Pitch Deck
- Just Exploring

Step 2: **What kind of story is trying to get out?**

- Comedy
- Drama
- Thriller
- Historical
- Faith / Redemption
- Action
- Romance
- Other

Step 3: **How much help do you want?**

- Just format my script
- Help me build the story
- Teach me as I write
- Co-write with me

Then create the first project and open the Writer’s Desk.

---

## 9. Studio Lobby

The dashboard should become a creative project lobby.

Project cards should feel like script slates, draft folders, mini movie posters, treatment packets, or writer’s notebooks.

Example card:

```text
THE ROAD TO EL ALAMEIN
Feature Film · Comedy · Draft 1

Page 12 of 100
Act I in progress
3 scenes need conflict
2 characters underdeveloped

Next: Strengthen Scene 2 reversal

[Open Writer’s Desk]
```

Production progress should use a screenplay pipeline:

```text
Idea → Logline → Treatment → First Draft → Rewrite → Table Read → Pitch
```

Do not use TMH-like progress blocks.

---

## 10. Writer’s Desk / Editor

The editor is the heart of SceneSmith. Create three modes.

### Writer Mode

Distraction-free writing:

- Centered screenplay page
- Minimal top chrome
- Collapsed sidebars
- Bottom command bar
- AI only appears when summoned
- Current block type shown quietly

Command bar example:

```text
Action · Tab to change · Enter for new line · ✨ Continue
```

### Studio Mode

Full creative control:

```text
Script Map | Screenplay Page | Director’s Chair
```

The screenplay page still remains visually dominant.

### Rehearsal Mode

Table-read focused:

- Scene script
- Cast cards
- Voice controls
- Playback controls
- Line-by-line highlighting
- Director notes
- Performance variations: flat, more tension, more comedic, more noir, faster pace, more subtext

---

## 11. Screenplay Page

The page must look excellent and industry-respectful.

Requirements:

- Warm paper surface
- Correct screenplay margins
- Proper line height
- Soft page shadow
- Centered writing surface
- Strong readability
- Minimal distractions

Suggested CSS:

```css
.screenplay-page {
  background: var(--paper);
  color: var(--ink);
  font-family: var(--font-script);
  width: min(816px, calc(100vw - 2rem));
  min-height: 1056px;
  padding: 72px 96px;
  box-shadow: 0 24px 80px var(--paper-shadow);
  border-radius: 2px;
}
```

Do not make the screenplay page look like a generic text box.

---

## 12. Script Map

Rename the left editor sidebar to **Script Map**.

Contents:

- Project title
- Format / genre / draft
- Act dividers
- Scene cards
- Character appearances
- Page count
- Scene warnings
- Production progress
- Import / export controls

Scene item example:

```text
01  African Desert
Idea · Stephan, Hans
Warning: conflict unclear
```

Use act dividers and small scene cards, not dense admin tables.

---

## 13. Director’s Chair

Rename the right AI panel to **Director’s Chair**.

Present AI as role-based studio tools, not a generic chatbot.

Roles:

1. **Script Doctor** — structure, stakes, dead scenes, reversals.
2. **Dialogue Punch-Up** — humor, rhythm, subtext, character voice.
3. **Visual Director** — staging, shots, cinematic moments.
4. **Character Analyst** — want, need, wound, lie, contradiction, arc.
5. **Continuity Clerk** — contradictions, timeline, names, logic.
6. **Producer Notes** — concept clarity, marketability, pitch.
7. **Table Read Director** — performance, pacing, delivery.

Replace “Coach Recommendations” with **Director’s Notes**.

Example note:

```text
This scene has atmosphere, but the conflict is still too polite. Give Stephan a false objective and Hans a practical reason to interrupt him.
```

Input placeholder:

```text
Ask the Director’s Chair about this scene...
```

---

## 14. Scene Board

The Scene Board should feel like a corkboard / index-card wall.

Scene cards should show:

- Scene heading
- Scene purpose
- Characters
- Conflict
- Reversal
- Emotional charge
- Setup/payoff tags
- Status
- Page estimate

Example:

```text
EXT. LIBYAN PLATEAU — DAY

Purpose: Trap Stephan and Hans in visible danger
Conflict: Stephan wants dignity; Hans wants survival
Reversal: The “silence” is actually the British approaching
Charge: Comic tension
Tags: setup: broken Panzer / payoff: false confidence
```

Use index card surfaces, subtle corkboard texture, sticky-note tags, and drag-friendly interactions.

---

## 15. Casting Wall

Rename Characters to **Casting Wall**.

Character cards should feel like casting dossiers.

Fields:

- Name
- Archetype
- Role in story
- Want
- Need
- Wound
- Lie
- Secret
- Contradiction
- Voice
- Comic/dramatic engine
- First appearance
- Key relationships

Example:

```text
STEPHAN
The Lost Intellectual

Want: To appear superior
Need: To admit fear
Wound: Humiliation
Lie: “If I sound intelligent, I am safe.”
Contradiction: Coward pretending to be a philosopher
Voice: Overeducated, defensive, absurdly formal
Comic Engine: Takes himself seriously in unserious situations
```

Relationship example:

```text
STEPHAN ↔ HANS
Dynamic: Pretension vs. practical survival
Conflict: Stephan philosophizes; Hans repairs the tank
Comedy Source: Hans is usually right, but Stephan uses bigger words
```

---

## 16. Story Spine and Dramatic Pulse

### Story Spine

Story Spine should be visual and structural:

- Act timeline
- Scene cards on timeline
- Emotional intensity curve
- Character arc threads
- Setup/payoff links
- Reversal markers
- Conflict warnings
- Dead scene warnings
- Theme markers

Useful warnings:

- No clear conflict
- No reversal detected
- Character want unclear
- Scene does not change story state
- Payoff missing
- Setup not used
- Dialogue repeats known information

It should feel like a story murder-board, not a spreadsheet.

### Dramatic Pulse

Show rhythm and pressure:

- Tension
- Conflict
- Humor
- Emotional charge
- Pacing
- Reversals
- Character pressure
- Visual energy

Use cinematic graphs and heatmaps, but avoid corporate analytics styling.

---

## 17. Shot Wall, Rehearsal Room, Producer Room

### Shot Wall

Purpose: help the writer see the movie.

Features:

- Shot frames
- Generated image prompts
- Camera angle notes
- Visual motif tracking
- Location mood
- Color/mood palette
- Scene thumbnails

Visual style: storyboard panels, film strip elements, shot cards, director annotations.

### Rehearsal Room

Purpose: hear and perform the scene.

Features:

- Cast list
- Voice assignment
- Scene playback
- Line-by-line highlighting
- Performance notes
- Delivery variations
- Pacing controls
- Export audio

Visual style: dark theater in dark mode; clean rehearsal table in light mode.

### Producer Room

Purpose: package the screenplay.

Features:

- Logline
- One-page synopsis
- Treatment
- Character deck
- Comparable films
- Tone statement
- Pitch deck builder
- Query letter
- Export PDF

Visual style: pitch deck cards and clean presentation previews.

---

## 18. Screenplay School

Rename Academy to **Screenplay School**.

Use a practical masterclass feeling, not gamified hierarchy visuals.

Suggested path:

- First Screenplay Path
- Format basics
- Logline
- Character wants/needs
- Scene construction
- Dialogue
- Structure
- Rewrite
- Table read
- Pitch

---

## 19. Components and Microcopy

### Buttons

Primary CTAs should use warm amber/brass with a soft glow on hover. Examples:

- Start Writing Free
- Open Writer’s Desk
- Run Script Doctor
- Generate Scene Cards
- Hear Table Read

### Cards

Cards should feel like creative objects:

- Script folder
- Scene index card
- Character dossier
- Director note
- Production slate
- Storyboard frame

### Tags

Tags should feel like pencil marks, sticky notes, production labels, or scene status chips.

Examples:

- Drafting
- Needs conflict
- Reversal missing
- Payoff
- Strong visual
- Table-read ready

### Warnings

Warnings should be helpful, not alarming:

- Conflict unclear
- Reversal missing
- Character voice blending
- This scene may not change the story state

Avoid scary error styling unless it is a real app error.

---

## 20. Motion, Responsive Behavior, and Accessibility

Use subtle motion:

- Page gently fades in
- Scene cards lift on hover
- Director’s Chair slides in smoothly
- Rehearsal playhead moves line by line
- Scene card reorder has tactile movement
- Theme toggle softly crossfades

Avoid cartoon animations, excessive bouncing, flashy SaaS movement, or heavy transitions that slow writing.

### Responsive Layout

Desktop:

```text
Script Map | Screenplay Page | Director’s Chair
```

Tablet:

- Screenplay page remains primary
- Sidebars become drawers
- Bottom command bar remains available

Mobile:

- Writing-first layout
- Bottom sheet for block type / AI tools
- Scene Map accessible from drawer
- Director’s Chair accessible from drawer or bottom tab

### Accessibility

- WCAG AA contrast
- Visible focus states
- Labels/tooltips for icon-only buttons
- Strong keyboard navigation
- Theme preference persists
- Reduced motion respected
- Do not rely on color alone for status

---

## 21. Implementation Phases for Lovable

### Phase 1 — Design Tokens and Theme System

- Add cinematic light/dark tokens
- Replace TMH-like dark/gold dominance
- Add paper, panel, accent, warning, and typography variables
- Ensure theme toggle works globally

### Phase 2 — Navigation Rename

- Update user-facing labels
- Keep routes if easier
- Rename visually without breaking URLs

### Phase 3 — Landing Page

- Create cinematic hero
- Add layered product mockup
- Add feature sections
- Add production pipeline
- Improve CTAs

### Phase 4 — Editor Layout

- Implement Writer Mode, Studio Mode, Rehearsal Mode
- Rename sidebars to Script Map and Director’s Chair
- Make screenplay page dominant
- Collapse sidebars cleanly

### Phase 5 — Creative Panels

- Redesign Scene Board
- Redesign Casting Wall
- Redesign Story Spine
- Redesign Rehearsal Room

### Phase 6 — Microcopy and Polish

- Replace generic SaaS labels
- Add Director’s Notes language
- Improve empty states
- Improve onboarding copy
- Add subtle motion and hover states

---

## 22. Preserve Existing Functionality

Do not break:

- Auth
- Supabase integration
- RLS/security settings
- Existing routes
- Editor data model
- Project saving
- Screenplay block logic
- AI calls
- Import/export
- Pricing
- Published app flow

This is primarily a visual system, layout, UX language, component-presentation, theme, and hierarchy overhaul.

---

## 23. Do Not Do

Do not:

- Recreate TMH visual language
- Use pyramid/hierarchy motifs
- Overuse gold
- Make the app feel like analytics software
- Make the editor feel like an admin dashboard
- Hide the screenplay page behind panels
- Add childish film clichés everywhere
- Use excessive film grain or fake textures
- Make light mode feel like plain white SaaS
- Make dark mode feel like black-and-gold TMH
- Break existing functionality while redesigning presentation

---

## 24. Visual QA Checklist

- [ ] Landing page feels cinematic and inspiring
- [ ] App feels clearly different from TMH
- [ ] Screenplay page is visually dominant
- [ ] Writer can focus without panel noise
- [ ] Light mode feels like a writer’s desk
- [ ] Dark mode feels like a midnight screening room
- [ ] Sections use screenplay-native language
- [ ] AI feels like a creative studio collaborator
- [ ] Scene Board cards feel like index cards
- [ ] Casting Wall feels like character dossiers
- [ ] Story Spine feels visual and structural
- [ ] Rehearsal Room feels like a table read
- [ ] Product still feels professional, not gimmicky
- [ ] Mobile/tablet layouts are writing-first
- [ ] Accessibility and keyboard focus are preserved
- [ ] Auth, saving, Supabase, and AI calls still work

---

## 25. Final Creative Direction

SceneSmith should make the user feel:

> “Oh. This is where my movie lives.”

The product is not a dashboard.  
It is not TMH 2.0.  
It is not just an editor.

It is a cinematic writing studio where the script can be written, structured, visualized, heard, rehearsed, and pitched.
