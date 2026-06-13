## Goal

Turn the flat "Your blank page awaits" CTA into a cinematic, framed scene — the kind of polished hero treatment a senior brand designer would ship. Borrow the silhouetted-writer-at-the-window motif from the promo kit's flyer ("Build better stories, scene by scene") and integrate it tastefully into the CTA section on the landing page.

## Approach

The CTA stops feeling like a card because it has no edges, no contrast, no art. The promo kit solves this by pairing the silhouette of a writer at a lamp-lit desk against a deep navy cityscape with a small brass star — a self-contained scene. We bring that scene in as a real piece of art, then build the CTA around it.

### 1. Generate the CTA artwork (single new asset)

Use `imagegen` (premium) to produce one wide hero illustration that matches the promo kit's exact style:
- Deep navy → near-black gradient sky, soft moon glow.
- Silhouette of a writer at a desk with a small warm-amber desk lamp, facing right (toward the headline + CTA).
- Distant silhouetted city/castle skyline along the bottom.
- One small brass spark/star top-right (echoes the logo's spark).
- Painterly, editorial, not cartoonish. No text in the image.
- Aspect ratio 21:9 so it can sit as a full-bleed band.

Upload via `lovable-assets` to `src/assets/cta-writer-scene.jpg.asset.json`.

### 2. Redesign the final CTA section in `src/routes/index.tsx`

Replace the current flat block with a contained, framed "scene card":

- Wrapper: max-w-6xl, rounded-2xl, `border border-primary/15`, `--shadow-cinematic`, overflow hidden, mx-auto. This gives the section actual edges so it stops dissolving into the page.
- Background layer: the new illustration as a full-cover image, positioned so the writer silhouette sits on the **left third** and the right two-thirds are darker sky (room for text).
- Atmosphere layers on top of the image:
  - A left→right navy gradient (`from-[--bg-base]/95 via-[--bg-base]/70 to-[--bg-base]/40`) so the writer reads but the right side stays legible.
  - A subtle bottom navy fade so the CTA button area is calm.
  - A 1px inner brass hairline (`shadow-[inset_0_0_0_1px_oklch(...)]`) for the editorial frame feel.
- Foreground content (right-aligned on desktop, centered on mobile):
  - Tiny uppercase brass eyebrow: "Your story · Your world · Our craft" (lifted from the promo flyer).
  - `font-display` headline "Your blank page awaits." — kept.
  - Subhead reworked slightly: "Free to start. No credit card. Just the page, and everything you need to fill it."
  - Primary `Enter the Studio` button (unchanged styling).
  - The 3 check-rows (Industry formatting / Director's Chair AI / Producer Room pitch deck) become a thin brass-divided inline row at the bottom of the card, not floating under it.
- Add a small brass star SVG/icon (Lucide `Sparkle`) absolutely positioned top-right inside the card to echo the logo and the promo kit.

Section padding outside the card stays so the card breathes on the page.

### 3. Reuse the same scene as a subtle backdrop accent in the hero (optional, low-risk)

Not doing this in v1 — keeping scope to the CTA card so the change is focused and obviously better. Mention only if user wants a second pass.

## Files

- new: `src/assets/cta-writer-scene.jpg.asset.json` (via `lovable-assets`, premium image)
- edit: `src/routes/index.tsx` — replace the final CTA `<section>` only. Hero, pillars, features, three-acts, footer untouched.

## Out of scope

- No palette change, no font change, no logo change.
- No new routes, no copy rewrite elsewhere.
- No AppShell / pricing / auth changes.
- No animation beyond a gentle hover/scale on the CTA button (already there).

## Acceptance

- CTA section reads as a single, framed cinematic card — clear edges, clear contrast against the page.
- Writer silhouette + city + spark visible on the left; headline, subhead, button, and check-row sit cleanly on the right with no contrast issues.
- Mobile: image stays as background with stronger overlay so text remains readable; layout stacks centered.
- No regressions to hero, pillars, features, three-acts, footer.
