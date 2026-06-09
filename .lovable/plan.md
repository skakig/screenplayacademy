## Goal

Apply `docs/EDITOR_FOCUS_AND_VIEWPORT.md`. The active screenplay line should stay in a comfortable focus zone (≈48% from the top on desktop, above the keyboard on mobile) without the writer having to scroll. The page should move around the writer when Enter creates new blocks.

## Scope

In scope: dedicated editor scroll container, focus-zone auto-scroll, manual-scroll respect, reduced-motion fallback, scroll on Enter / new line / jump-to-block.

Out of scope: review-mode UI, suggestion cards (Section "Suggestions and ITS/PfHU"), beginner guidance toast, multi-mode toggle UI. (Hooks for `mode` will be in place but the UI stays "normal".)

## Changes

### 1. New helper `src/components/editor/useActiveLineViewport.ts`

Exports `useActiveLineViewport({ containerRef, activeLineEl, mode, isMobile, keyboardInset })`.

- Tracks `manualScrollUntil` timestamp; updates on user `wheel` / `touchmove` / non-programmatic `scroll` events.
- `scrollActiveLineIntoFocusZone({ smooth })`:
  1. Read `containerRef.current.getBoundingClientRect()` and `activeLineEl.getBoundingClientRect()`.
  2. Compute target Y = container.top + (container.height - keyboardInset) * 0.48 (desktop) / 0.30 (mobile).
  3. Delta = activeRect.top - targetY.
  4. If `Math.abs(delta) < 8`, skip.
  5. If `manualScrollUntil > Date.now()`, skip (unless `force`).
  6. `containerRef.current.scrollBy({ top: delta, behavior: prefersReducedMotion ? "auto" : (smooth ? "smooth" : "auto") })`.
- Exposes `scheduleScroll(reason: "enter" | "jump" | "wrap" | "focus")` that requestAnimationFrame-coalesces calls.
- Listens to `visualViewport.resize` for mobile keyboard inset.

### 2. `ScreenplayDocumentEditor.tsx`

- Add an outer scroll container (the paper div becomes its child):
  ```tsx
  <div ref={scrollRef} className="screenplay-scroll relative overflow-y-auto overscroll-contain h-full">
    <div className="screenplay screenplay-paper ...">{/* existing content */}</div>
  </div>
  ```
- Track active line DOM element by resolving from `activeBlockId` → `scrollRef.current.querySelector('[data-block-id="..."]')` (add `data-block-id={b.id}` on the wrapper around each `ScreenplayLine`).
- Wire `useActiveLineViewport`. Call `scheduleScroll("enter")` from a `useEffect` keyed on `doc.activeBlockId` and on `doc.localBlocks.length` (so Enter triggers it). Call `scheduleScroll("jump")` from inside `jumpToServer` via the imperative handle.
- Pass `mode="normal"` for now (room for the modes later).

### 3. `src/routes/_authenticated/editor.$projectId.tsx`

- The middle `<section>` becomes a flex column with a bounded height so its child can own scroll:
  ```tsx
  <section className="h-[calc(100vh-104px)] flex flex-col p-6 lg:p-10 screenplay-canvas overflow-hidden">
    {/* header strip, CanvasToolbar, hints, SaveStatusBanner stay above */}
    <div className="flex-1 min-h-0">
      <ScreenplayDocumentEditor ... />
    </div>
    {/* command bar + export buttons stay below */}
  </section>
  ```
- Remove the existing `el.scrollIntoView` call at line 386 in favor of the new imperative `jumpToServer` path (which already triggers focus-zone scroll).
- No layout changes to left/right `<aside>` panels — they already scroll independently.

### 4. `ScreenplayLine.tsx`

- No behavior change. Add `data-block-id` and `data-active` attributes on the root wrapper so the viewport hook can find the active node without prop drilling.

### 5. Reduced motion + safety

- Use `window.matchMedia("(prefers-reduced-motion: reduce)")`.
- Scroll never focuses, blurs, or touches selection — pure visual scroll on the container only.

## Acceptance

Manual run of doc Tests 1–3 in `/editor/$projectId`:

- Test 1: 30+ Enters keep the caret in view.
- Test 2: Active line settles near the 48% band; no snap.
- Test 3: Manual scroll up + click earlier line + edit + Enter does not yank the page back; insertion happens at the right place.
- Reduced-motion OS setting → no smooth animation.
- Mobile (≤414px viewport): active line above keyboard area (visualViewport-aware).
