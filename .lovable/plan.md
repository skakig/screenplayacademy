# SceneSmith Studio — Full Audit & Remediation Roadmap

## Verdict (one paragraph)

The **editor engine itself is architecturally excellent** and largely compliant with AGENTS.md's local-first invariants — stable local IDs as React keys, serverId stored separately, no Supabase in the typing path, correct Enter/Tab transitions across all 8 block types, server-echo merge that protects dirty/active blocks. The **design system is genuinely distinctive** (brass-on-slate "Midnight Screening Room" with Cormorant Garamond + Courier Prime on cream paper — not a generic purple-gradient SaaS dashboard). But three big things are broken relative to the doctrine: (1) the app never answers "where do I write?" on first contact, (2) all 10 downstream build stages ship live while Stage 1 is still being debugged, and (3) the intellectually serious Screenplay-University pieces (Character Truth Engine, PfHU signals, coaching adapter) are effectively disconnected from any actual pedagogical loop — no lesson content, no practice→assess cycle, no skill scores ever get updated.

## AGENTS.md Compliance Scorecard

| Area | Verdict |
|---|---|
| Local-first typing invariants | ✅ Pass |
| Enter/Tab block transitions (all 8 types) | ✅ Pass |
| Stable React keys, serverId separation | ✅ Pass |
| Server-echo merge guards dirty/active blocks | ✅ Pass |
| `/editor-lab` isolated route | ✅ Pass |
| TanStack Start conventions (no `src/pages/`, `<Outlet/>` present) | ✅ Pass |
| App opens to a writable editor | ❌ Fail — `/` → auth → dashboard → pick project → editor |
| Build sequence (editor first, then downstream) | ❌ Fail — Stages 3–10 all ship live |
| i18n rule (no hardcoded UI strings) | ❌ Fail — ~30 keys exist; toasts/labels/academy copy are all hardcoded English |
| `insertTemplate` avoids `invalidateQueries` during typing | ⚠️ Partial fail — `editor.$projectId.tsx:282` invalidates `['blocks', projectId]` after AI template inserts |
| No ghost `div role="button"` in editor UI | ⚠️ Partial fail — `StoryNavigatorPane.tsx:215` uses it (navigator, not a line) |
| `notFoundComponent` on loader routes | ❌ Missing |
| AI cannot overwrite user work | ⚠️ Partial — `draftOpeningWithAi` inserts blocks directly without confirmation |

## 16-Step Acceptance Test — Predicted Result

Steps 1–15 pass on paper. Step 16 (30-second sustained typing + refresh + network failure) is **very likely to pass** given the local-first architecture, but has one latent failure mode: if the guided rail auto-fires an `insertTemplate` during the session, the `invalidateQueries(['blocks', projectId])` at `editor.$projectId.tsx:282` races the server-echo merge. Recommendation is to actually run the test manually and record which steps fail before any further work.

## Design Critique (professional)

1. **Distinctive brand identity.** Brass `oklch(0.74 0.14 70)` on deep slate is a real point of view. Editorial-serif display + Courier Prime screenplay paper reads as a cinematic tool, not a template.
2. **Landing page never shows the product.** Copy is evocative ("The page is yours. / The studio is waiting.") but there is no editor screenshot, demo, or embedded viewport. Final Draft, WriterDuet, Highland, Arc Studio Pro all lead with the writing surface. A new visitor cannot answer AGENTS.md's own question.
3. **Editor chrome is overloaded.** `editor.$projectId.tsx` imports 20+ chrome components (`StoryNavigatorPane`, `CoachPane`, `StoryBuilder`, `FeatureDock`, `CanvasToolbar`, `GuidedRail`, `StepCoach`, `EditorTour`, `EditorCommandBar`, `WriterDeskNewMenu`, `PresenceAvatarStack`, `AutosaveIndicator`, etc.) competing with the paper. Arc Studio Pro's default view shows essentially nothing but the page.
4. **Paper/ink contrast is correct** (~11:1). `--muted-foreground` on background is ~4.2:1 — borderline for small text like the `text-[11px]` nav labels on the landing page.
5. **Mobile responsiveness untested for chrome.** The paper collapses reasonably (`px-10 lg:px-16`, max-w 760px) but the side panes and feature dock have no evidence of mobile layouts.

## Screenplay-University Gap Analysis

**Strong bones, no body.** The `characterTruthEngine` (753 lines, deterministic, evidence-based), `sceneStateAdapter`, `truthCoach`, and `writerProfileSignals` form a genuinely serious intelligent tutoring foundation. But:

- **No lesson content.** `academy_lessons` table exists; the three academy route files total ~246 lines of shell.
- **No practice→assess loop.** Truth Engine can diagnose, TruthCoach can teach, nothing evaluates what the writer actually produces or updates `writer_profiles` skill scores.
- **Coaching runs only on demand.** The `truthCoach` fires when a user manually opens "Would They Do This?" — it does not observe live writing.
- **No curriculum sequencing, prerequisites, or spaced repetition.** Module/lesson slugs exist without adaptive path logic.
- **Skill scores are read-only.** `writer_profiles.formatting_skill_score`, `dialogue_score`, etc. are bootstrapped and read, never written from actual writing events.

## Prioritized Remediation Roadmap (top 10)

Ordered by impact on the prime directive — "the screenplay editor is the product."

1. **Manually run the 16-step acceptance test.** Document exact repro for anything that fails. Zero code changes; unblocks everything else.
2. **Remove `invalidateQueries` after `insertTemplate`.** Replace with `setQueryData` cache patching to match `SupabasePersistenceAdapter`. `editor.$projectId.tsx:282`.
3. **Land authed users directly in the editor.** `/` → (if authed) → last edited project's editor, else project-creation flow. Removes 3 clicks between arrival and writing.
4. **Freeze downstream feature work** (Academy, Table Read, Pitch, Writers' Room, Storyboard) until the acceptance test is signed off. Process/PR gate.
5. **i18n sweep for all toasts, buttons, empty states, errors.** Infrastructure exists; usage is missing outside auto-format/import. Codebase-wide search-and-replace to `t(...)`.
6. **Focus-mode editor: collapse chrome to ≤3 visible regions by default.** Paper + minimal status + collapsed toolbar. All panes accessible via shortcut/toggle.
7. **Add `notFoundComponent` to every loader route** (start with `editor.$projectId.tsx`). Prevents blank-state failures on bad URLs.
8. **Wire `writer_profiles` skill-score updates to real writing events.** In `writerEvents.functions.ts`, after each session compute formatting/dialogue/scene signals from block data and increment scores. This is the minimum for the ITS to be adaptive.
9. **Author real Academy curriculum** and connect each lesson to a "practice in your script" action that opens the editor with a guided prompt tied to the Truth Engine.
10. **Replace `div role="button"` in `StoryNavigatorPane.tsx:215`** with a real `<button>`. Two-minute a11y fix explicitly called out in AGENTS.md.

## What I'd Like to Build First

I recommend we tackle **#2 (remove invalidateQueries), #3 (auth → editor redirect), #7 (notFoundComponent), and #10 (button a11y)** in a single first pass — they're all small, high-signal, and directly serve the prime directive without touching the intelligence layer. Then we run the acceptance test (#1) against the tightened editor, and from that baseline decide whether the next pass is chrome reduction (#6), i18n sweep (#5), or ITS wiring (#8).

Approve this plan to move into build mode, or tell me which item(s) you want to reorder, drop, or expand first.
