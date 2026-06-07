
# SceneSmith AI — Finish the MVP

Phase 1+2 are live (auth, dashboard, projects, editor with script blocks, scenes, characters, AI assist for a few tools). This plan covers everything still missing from your spec.

## 1. Public landing page (`/`)
Replace the current redirect-only `src/routes/index.tsx` with a real cinematic landing page (SSR on, signed-in users see a "Go to Dashboard" CTA instead of being redirected):
- Hero: "Write the script. See the scene. Hear the table read." + your subheadline + **Start Writing Free** CTA → `/auth`.
- Feature grid: Editor, Characters, Scenes, Storyboard, Table Read, Pitch Package.
- "How it works" 3-step section, pricing teaser, footer.
- `head()` with title/description/OG tags.

## 2. Database additions
One migration to add the missing tables and an export-ready field on projects:

- `storyboard_assets` — project_id, scene_id, prompt, style, image_url (storage), status, order_index.
- `audio_assets` — project_id, scene_id, kind ('table_read'|'sfx'), audio_url, voice_map jsonb, duration_seconds, status.
- `pitch_packages` — project_id (unique), logline, short_synopsis, one_page_synopsis, treatment, character_bible, tone_statement, comparables, target_audience, budget_tier, poster_prompt, trailer_vo, pitch_email, generated_at.

All with `owns_project(project_id)` RLS, GRANTs to authenticated + service_role, updated_at triggers. Plus storage buckets `storyboards` (private) and `table-reads` (private) with owner-scoped policies on `storage.objects`.

## 3. Screenplay editor polish
Currently functional but minimal. Add to `editor.$projectId.tsx`:
- Left **scene list sidebar** — clickable to filter blocks by scene + "New scene" button.
- Center: keep block list; add slash-command menu (`/` opens block-type picker) and Tab/Enter shortcuts to cycle types (Scene Heading → Action → Character → Dialogue → Parenthetical).
- Right **AI assistant sidebar** with the full tool list (see §5).
- Visual formatting via CSS classes in `styles.css`: uppercase scene headings, centered uppercase character cues, narrower dialogue (~3.5"), narrower parentheticals (~2.5"), right-aligned uppercase transitions, full-width action, muted/italic notes excluded from export.
- **Export**: "Copy as Fountain" and "Download .txt" buttons (client-side, plain text industry-style format, notes stripped).

## 4. Pages to build
New route files under `_authenticated/`:
- `projects.tsx` — full list with search, status badges, last-edited, "+ New Project".
- `projects.new.tsx` — guided form: title, type, genre, tone, target length, logline, AI help level.
- `storyboard.$projectId.tsx` — scene selector, prompt preview, style selector, **Generate Panel** button. If `IMAGE_GEN_ENABLED` secret missing → Coming Soon / Pro upsell card; otherwise call edge function. Image grid from `storyboard_assets`.
- `tableread.$projectId.tsx` — scene selector, per-character voice assignments, narrator/SFX toggles, **Generate Table Read** button → ElevenLabs edge function (or Coming Soon state). Audio `<audio>` player from `audio_assets`.
- `pitch.$projectId.tsx` — single **Generate Pitch Package** button. Renders all 12 fields from `pitch_packages` in sectioned cards; per-section "Copy" buttons.
- `pricing.tsx` — 4 tier cards (Free / Creator $19 / Pro $49 / Studio $149) with the exact feature lists from your spec. CTAs are stubbed (no Stripe yet) — buttons show "Coming soon" toast. Schema is Stripe-ready (we'll add `stripe_customer_id`, `subscription_tier`, `current_period_end` to `profiles`).
- `settings.tsx` — profile (name, avatar, email read-only), current plan + "Manage subscription" stub, sign out, danger zone.

Update `AppShell`/nav to surface Projects, Pricing, Settings; `ProjectNav` to surface Editor / Scenes / Characters / Storyboard / Table Read / Pitch.

## 5. AI assistant — full tool set
Extend existing `src/lib/ai.functions.ts` `aiAssist` server fn to support all 13 tools with proper prompts and project/scene/selection context:
logline, outline, character, rewrite_scene, sharpen_dialogue, add_subtext, more_visual, reduce_exposition, increase_tension, find_plot_holes, summarize_scene, storyboard_prompt, pitch_package.

`pitch_package` writes to `pitch_packages`; `storyboard_prompt` returns text used by storyboard page. All persist a row in `ai_requests`.

## 6. Edge-function-style placeholders
Per your spec, expose these as **TanStack server functions** (not Supabase Edge Functions — see stack guidance):
- `ai-generate-logline`, `ai-build-outline`, `ai-create-character`, `ai-rewrite-scene`, `ai-script-doctor`, `ai-generate-storyboard-prompt`, `ai-generate-pitch-package` → thin wrappers calling `aiAssist` with the right tool key.
- `elevenlabs-table-read` → if `ELEVENLABS_API_KEY` secret missing, returns `{status: 'coming_soon', demo_url}`. Otherwise stitches per-line TTS, uploads to `table-reads` bucket, inserts `audio_assets`.
- `image-generate-storyboard` → uses Lovable AI image model (`google/gemini-2.5-flash-image`) by default; uploads PNG to `storyboards` bucket, inserts `storyboard_assets`. Graceful demo (placeholder image URL) on failure.

All keys stay server-side. No frontend exposure.

## 7. Polish (Phase 5)
- Empty states with primary CTA on every page ("No projects yet → Create your first project").
- Loading skeletons, toast errors, mobile breakpoints on editor (collapse sidebars to drawers).
- 429/402 gateway errors surfaced as friendly toasts pointing to Pricing.

## Technical notes
- TanStack Start serverFns under `src/lib/*.functions.ts`; auth via existing `requireSupabaseAuth`.
- Storage buckets created via `supabase--storage_create_bucket`; RLS on `storage.objects` scoped by path prefix `{user_id}/...`.
- ElevenLabs + image gen: I'll request `ELEVENLABS_API_KEY` only when you're ready to wire it; the UI ships in Coming Soon state by default so the MVP works without it.
- Stripe: schema-ready columns added now; checkout flow deferred (built-in Lovable payments tool is the recommended path when you're ready).

## Out of scope for this pass
- Real Stripe checkout (schema only).
- Team workspaces / Studio tier collaboration.
- Realtime multi-user editing.

Approve to build, or tell me which pieces to drop/reorder.
