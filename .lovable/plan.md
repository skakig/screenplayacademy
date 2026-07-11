
# SceneSmith Studio — "Make It Actually Work" Game Plan

The app has ~20 routes stitched into one long Studio Menu, but the four things a user actually needs are buried, half-broken, or duplicated. Per AGENTS.md the editor is the product; everything else must clearly serve it. This plan re-groups the app into 4 pillars, fixes the three broken rooms you called out, and cuts the menu in half.

## The 4 pillars (new mental model)

```text
1. SCHOOL         → Screenplay Academy (learn to write)
2. EDITOR         → Writer's Desk + Scene Board + Vault + Casting + Spine (write)
3. COACH          → ITS / PfHU / TMH engine living inside the editor (guide)
4. PRODUCER       → Pitch Deck, Rehearsal Room, Shot Wall, Writers' Room (ship)
```

Every menu item and route must fit into exactly one pillar. If it doesn't, it gets deleted or merged.

---

## Phase 1 — Menu & IA cleanup (visible in one pass)

Rewrite `src/components/StudioMenu.tsx` groupings from 6 groups → **4 pillars + Studio/Settings footer**:

```text
SCHOOL     Screenplay School (formerly "Academy")
           Guided Path (only if onboarding.preferred_mode = guided)

EDITOR     Writer's Desk            (/editor/$projectId)
           Scene Board              (/scenes/$projectId)
           Scene Vault              (/vault/$projectId)
           Story Spine              (/story-arc/$projectId)
           Casting Wall             (/characters/$projectId)
           Dramatic Pulse           (/arc-timeline/$projectId)  ← moved out of "Polish"

PRODUCER   Producer Room (Pitch)    (/pitch/$projectId)
           Rehearsal Room (Table)   (/tableread/$projectId)
           Shot Wall (Storyboard)   (/storyboard/$projectId)
           Writers' Room            (/writers-room/$projectId)

STUDIO     Studio Lobby (dashboard)
           Script Vault (projects)
           Settings · Pricing
```

Drop the standalone "Polish" group. Rename ambiguous labels ("Producer Room" → "Pitch Deck", "Rehearsal Room" → "Table Read") in the menu subtitle so users can find them.

Also: on the editor page, the menu opens over the script and the trigger row shows "Focus / Basi..." cut off. Add `max-w` and `truncate` to the ProjectNav title row so the top bar never clips on iPad widths.

## Phase 2 — Fix the three broken rooms

You called these out specifically. Real fixes, not paint:

**A. Writers' Room (`writers-room.$projectId.tsx`)**
- Symptom: user says "I still can't collaborate with anyone." The Invite dialog exists (`InviteCollaboratorDialog.tsx`) but the flow isn't reachable/obvious and the tab shell is heavy.
- Fix: promote a single primary "Invite collaborator" CTA at the top of the page (not buried in a tab). Verify the end-to-end invite path: `create_project_invite` RPC → email link → `/accept-invite?token=` → `accept_project_invite`. Add a visible "Copy invite link" fallback for users whose email doesn't arrive.
- Collapse the current 6-ish tabs (Members, Invites, Comments, Board, Suggestions, Live, Arena, Presence) into **3**: **People** (Members + Invites + Access), **Notes** (Comments + Suggestions), **Sessions** (Board + Live + Arena + Presence). Arena/Live stay behind their feature flags.
- Add a "You're the only member" empty state that shows the invite CTA front and center.

**B. Pitch Deck (`pitch.$projectId.tsx`)**
- Symptom: "doesn't work." Route loads but generation and export are unclear.
- Fix: guarantee `generatePitchPackage` handles the case where `pitch_packages` row is missing, and always upserts. Show a single "Generate pitch package" primary button when empty; individual section refresh buttons when populated. Wire "Export PDF" via existing `downloadPitchKitPdf` and verify it doesn't require a `draft_take` to render a minimal deck.
- Add a "This page didn't load" error boundary so a failing server function doesn't blank the tab (your screenshot #2 and #4 showed exactly this).

**C. Rehearsal Room / Table Read (`tableread.$projectId.tsx`)**
- Symptom: "doesn't work."
- Fix: block generation until a scene is selected AND at least one character has a voice assigned; today it silently no-ops. Surface a clear inline error when ElevenLabs voice list fails. Add signed-URL refresh on 403 (`refreshTableReadUrl` exists; wire it into the audio `<audio onError>`).

**D. Root cause behind "This page didn't load"**
- Both blank-screen screenshots point to an unhandled loader/serverFn error. Every `_authenticated` leaf route must set `errorComponent` and `notFoundComponent` per the TanStack rules; today most of these leaf routes don't. Add a shared `RouteErrorBoundary` and wire it into pitch, tableread, writers-room, storyboard, and character routes in one pass.

## Phase 3 — Wire ITS / PfHU / TMH into the editor (Pillar 3: Coach)

Today Truth Engine, `truthCoach`, `writerProfileSignals`, and `characterTruthEngine` all exist as libraries but only surface inside a hidden "Would They Do This" tab. Per the pillar, the coach must live inside the editor.

- Add a persistent "Coach" side rail on `/editor/$projectId` (behind the existing `chromeMode` gate so Focus Mode still hides it). The rail renders:
  - Truth Check for the active scene/character (uses existing `sceneStateAdapter`).
  - PfHU-adjusted guidance depth from `writerProfileSignals` based on `onboarding.experience_level`.
  - TMH-level flag when a beat contradicts a character's moral hierarchy.
- No new backend. This is pure wiring of libraries already tested (11 + 17 + 23 cases green).

## Phase 4 — School (Pillar 1) alignment

Academy modules exist but the studio menu buries them and the lesson counts issue was fixed last cycle. Add a first-run banner on `/academy` that maps the 4 pillars onto learning tracks:

```text
Track 1  Learn to Write     → uses School
Track 2  Use the Editor      → uses Editor + Coach
Track 3  Ship Your Script    → uses Producer
```

Each track is just a curated ordering of existing lessons; no new content authoring in this phase.

## Phase 5 — Delete / merge dead weight

- `first-screenplay.$projectId.tsx` is only shown in guided mode — keep, but move under SCHOOL, not WRITE.
- `arc-timeline.$projectId.tsx` (Dramatic Pulse) had its own group — merge into EDITOR.
- Confirm `editor-lab.tsx` is dev-only and hidden from the menu (it currently is; keep it that way).

---

## Technical details (for the record)

- Files touched in Phase 1: `src/components/StudioMenu.tsx`, `src/components/ProjectNav.tsx`.
- Phase 2A: `src/routes/_authenticated/writers-room.$projectId.tsx` + reuse `InviteCollaboratorDialog`, `MembersList`, `InvitesList`, `AccessRulesPanel`.
- Phase 2B/C: `src/routes/_authenticated/pitch.$projectId.tsx`, `src/routes/_authenticated/tableread.$projectId.tsx` — add `errorComponent`, tighten server-fn calls, no schema changes.
- Phase 2D: new `src/components/RouteErrorBoundary.tsx` used as `errorComponent` on all `_authenticated` leaf routes.
- Phase 3: new `src/components/editor/CoachRail.tsx`, gated by existing `chromeMode !== "focus"`. Consumes existing engines only.
- Phase 4: edit `src/routes/_authenticated/academy.index.tsx` to add a "Learning tracks" section above the modules list.
- No migrations. No new dependencies. No AGENTS.md violations (editor stays local-first; coach reads, never writes to blocks without user consent).

## What I need from you

1. Approve the 4-pillar IA (or tell me if a term is wrong — e.g., "School" vs "Academy").
2. Confirm the Writers' Room tab collapse (**People / Notes / Sessions**) is OK, or name the tabs you want.
3. Green-light the phased order above — I'll ship Phase 1 + Phase 2 in the first build turn (menu + broken rooms), then Phase 3 (Coach rail), then Phase 4/5.
