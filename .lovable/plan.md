## Public-pages-first rebrand plan

### Goal
Update the app’s public-facing brand so it consistently presents as **SceneSmith Studio** using the supplied brand system:
- **Name:** SceneSmith Studio
- **Palette:** Deep Navy `#0F1B2D`, Warm Gold `#D4A23A`, Soft Gray `#A9ADB3`, Off-White `#F7F5F0`
- **Type:** Playfair Display for headings, Inter for body
- **Visual language:** premium, editorial, story-first, with the supplied logo/icon system

### Scope for this pass
Focus on **public pages first**:
- Home page
- Pricing page
- Auth page
- Shared root metadata / SEO identity
- Shared public brand assets (logo/app icon/social image touchpoints)
- Public text files tied to search/share identity

Exclude for now:
- Full logged-in app UI redesign
- Internal tool surfaces and editor chrome beyond obvious brand-name mismatches
- Social media kits / marketing collateral as separate deliverables

## What needs to change

### 1) Brand naming cleanup
Replace legacy and mixed naming so public-facing copy is consistent:
- Remove **Screenplay Academy** as the primary product/site name where it still appears
- Remove **SceneSmith AI** where it is used as product branding
- Standardize to **SceneSmith Studio** in:
  - app shell/header branding
  - route titles/descriptions
  - public CTAs and hero copy where the product name is mentioned
  - structured data and search-facing text
  - `llms.txt`, sitemap/robots references where applicable

### 2) Global brand tokens and typography
Bring shared visual foundations in line with the kit:
- Update global theme tokens to the official brand colors
- Replace current display font choice with **Playfair Display** while keeping **Inter** for body copy
- Preserve the premium editorial feel, but remove remaining mismatches with older cinematic styling where they affect public pages
- Define reusable brand tokens so later logged-in rebrand work can extend the same system

### 3) Public page visual refresh
Apply the new brand system to the public experience first:
- **Home page:** align hero, navigation, CTA styling, and section accents to the kit
- **Pricing page:** update header, plan presentation, and metadata to match SceneSmith Studio
- **Auth page:** update title, supporting copy, and shared visual treatment so sign-in feels on-brand
- Use the official mark consistently in headers and public brand moments

### 4) Brand assets and icons
Replace or align public brand assets:
- Add official logo/app icon assets from the branding kit into the app asset flow
- Update public logo usage in navigation/header/footer areas
- Replace stale or mismatched social preview imagery if it still reflects the old brand
- Align favicon/app icon touchpoints to the new mark where those hooks exist

### 5) SEO and share identity
Make search/share identity match the rebrand:
- Update root and leaf-route metadata to SceneSmith Studio
- Ensure public route titles/descriptions match the new brand voice
- Update `og:title`, `og:description`, `twitter:title`, `twitter:description`
- Ensure canonical and `og:url` point to `https://scenesmithstudio.com`
- Update Organization/WebSite JSON-LD to SceneSmith Studio
- Update `llms.txt` and verify sitemap/robots still advertise the correct site identity

## Implementation order

### Phase 1 — Shared brand foundation
- Add the official logo/icon assets
- Update shared fonts and global color tokens
- Create a small reusable public-brand pattern for logo + wordmark usage

### Phase 2 — Public route identity
- Fix root metadata
- Fix homepage metadata and visuals
- Fix pricing metadata and visuals
- Fix auth metadata and visuals
- Update public search/share assets and structured data

### Phase 3 — Cleanup and consistency
- Sweep remaining public-facing legacy brand strings
- Verify domain, copy, and asset consistency across public surfaces
- Leave logged-in UI deeper polish for a separate follow-up pass

## Deliverables
- Public-facing app consistently branded as **SceneSmith Studio**
- Official palette and typography applied to public pages
- Official logo/app icon used in public brand placements
- Public SEO/share identity aligned with the new brand and domain
- A smaller follow-up surface for the logged-in product rebrand

## Technical details
- Update shared head metadata in `src/routes/__root.tsx`
- Update route-level branding and metadata in public route files such as `src/routes/index.tsx`, `src/routes/pricing.tsx`, and `src/routes/auth.tsx`
- Update shared header branding in `src/components/AppShell.tsx` only for obvious naming mismatch cleanup; defer full internal-app redesign
- Update global tokens and font imports in `src/styles.css` and root font links so the design system matches the kit
- Replace stale public text/SEO files like `public/llms.txt` and verify sitemap/robots remain consistent with `scenesmithstudio.com`
- Move official uploaded brand assets into the app asset pipeline so logos/icons are used as real app assets rather than as reference files

## Follow-up after this pass
A second pass can cover the **logged-in product UI**:
- dashboard/editor shell branding
- internal iconography and empty states
- deeper component-level visual alignment
- remaining legacy naming across authenticated routes