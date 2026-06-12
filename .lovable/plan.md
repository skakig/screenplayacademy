# SceneSmith Studio Rebrand — Pass v2

Keep the existing navy/brass palette and Cormorant/Inter typography. Fix the brand mark, normalize all copy to "SceneSmith Studio", and reposition the product as a full writer's toolbox (5 pillars), not screenplay-only.

## 1. Brand mark asset

- Upload the attached logo (`71997A4C-...png`) via `lovable-assets` → `src/assets/scenesmith-mark.png.asset.json`.
- Create a small `<BrandLogo />` component (`src/components/brand/BrandLogo.tsx`) rendering the mark + "SceneSmith" (Cormorant) over a small "STUDIO" tracked-out label in brass. Sizes: `sm` (header), `md` (auth/pricing), `lg` (landing hero).

## 2. Replace `Film` icon and "SceneSmith AI" wordmark

- `src/components/AppShell.tsx` header → use `<BrandLogo size="sm" />` instead of the `Film` icon + "SceneSmith AI" text. (Matches the red-circled fix in the screenshot.)
- Landing `src/routes/index.tsx` hero, pricing header, auth header → use `<BrandLogo>`.

## 3. Reframe to writer's toolbox (5 pillars)

Update positioning copy on landing, pricing, auth, and root meta to reflect: **Screenplays · Novels · Worldbuilding · Comedy · Audio Storytelling** (drop "screenwriter"-only language).

- Landing hero subhead: "Write, develop, and perform your stories inside an AI-powered writer's studio — screenplays, novels, worlds, comedy, audio."
- "Everything a screenwriter needs" → "Everything a storyteller needs."
- Root meta description already mentions multi-format — keep, tighten.
- Pricing tagline + auth tagline updated to the toolbox framing.

## 4. Pillar strip (new section on landing)

Below the hero, add a horizontal pillar strip mirroring the promo kit (icon + label), 5 items:

| Pillar | Lucide icon |
|---|---|
| Screenplays | `FileText` |
| Novels | `BookOpen` |
| Worldbuilding | `Globe2` |
| Comedy | `Drama` (or `Theater`) |
| Audio Storytelling | `Mic` |

Style: navy panel card, brass icon in a soft `accent-glow` ring, Cormorant label, thin brass divider, subtle hover lift. No emoji, no gradient blobs.

## 5. Pro-level feature cards (replace current 3 cards)

Keep the three deep-workspace cards (Writer's Desk, Casting Wall, Scene Board) but redesign to match promo-kit polish:

- Navy `--bg-panel` background, brass icon block top-left in a rounded square with `--accent-glow` halo.
- Cormorant title, Inter body, thin brass underline accent.
- Hairline `--border-subtle` border, `--shadow-cinematic` on hover, scale 1.01.
- Add a 4th "Producer Room" card row OR keep grid as 3 — keep 3 to preserve scope; pillars cover the breadth.

## 6. SEO / meta consistency

- Normalize titles to "SceneSmith Studio" across `__root.tsx`, `index.tsx`, `pricing.tsx`, `auth.tsx` (remove lingering "Screenplay Academy" strings on public marketing surfaces — leave authenticated `/academy` route alone since that's the in-app Screenplay School module).
- Footer copyright → "© {year} SceneSmith Studio".
- JSON-LD Organization name → "SceneSmith Studio", url stays current published domain.

## 7. Files changed

- new: `src/assets/scenesmith-mark.png.asset.json`
- new: `src/components/brand/BrandLogo.tsx`
- new: `src/components/landing/PillarStrip.tsx`
- edit: `src/components/AppShell.tsx` (logo swap)
- edit: `src/routes/index.tsx` (hero logo, copy, pillar strip, redesigned feature cards, footer)
- edit: `src/routes/__root.tsx` (meta copy normalization, JSON-LD name)
- edit: `src/routes/pricing.tsx` (header logo + copy)
- edit: `src/routes/auth.tsx` (header logo + copy)

## Out of scope

- AppShell nav labels, dashboard, editor, in-app surfaces — untouched (per "Landing + all marketing surfaces").
- No palette change, no font change — only the mark, layout polish, and toolbox copy.
- No new routes.
