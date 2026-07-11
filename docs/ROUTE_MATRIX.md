# Route Matrix — Menu Truth & Route Completion Pass

_Last updated: 2026-07-11._

Status legend:

- **Complete** — Ships value on iPad and desktop; empty, partial, and populated projects all render an actionable state; entitlements enforced client- and server-side.
- **Partial** — Works but has a UX or data gap that should be resolved (see notes).
- **Gated** — Behind a paid tier; upgrade path visible in the menu chip and `PageFeatureGate`.
- **Experimental** — Feature-flagged / beta surface; menu marks it explicitly.
- **Blocked** — Depends on data (scenes, characters, script blocks) that isn't in the project yet. Room renders an empty state that names the missing prerequisite.

A route is **not** marked Complete just because it renders. It must also:

1. Handle `project == null`, `scenes == []`, `characters == []`, `script_blocks == []` without a blank page.
2. Show a tier / setup / needs-data chip in the Studio Menu when appropriate.
3. Render legibly at iPad width (1024 CSS px) with the ProjectNav intact.

## School

| Route | Menu chip | Free | Creator | Pro | Studio | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `/academy` | — | Complete | Complete | Complete | Complete | Renamed from "Screenplay School". Lesson counts hydrate from `user_lesson_progress`; pillar filters wired. |
| `/first-screenplay/$projectId` | Pick a project · Guided-only | Complete | Complete | Complete | Complete | Only shown to users with `preferred_mode = "guided"`. Falls back to guided dashboard if project is missing. |

## Editor

| Route | Menu chip | Free | Creator | Pro | Studio | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `/editor/$projectId` | Pick a project | Complete | Complete | Complete | Complete | Local-first typing; presence + coach rail sync per plan. |
| `/scenes/$projectId` | Needs scenes | Complete (empty prompt) | Complete | Complete | Complete | Empty state prompts outlining. |
| `/vault/$projectId` | — | Complete | Complete | Complete | Complete | Empty state prompts "New Vault Item" or opens the editor. |
| `/story-arc/$projectId` | — | Complete | Complete | Complete | Complete | Empty-arc callout offers "Seed defaults" when scenes exist, or routes to Scene Board when they don't. |
| `/characters/$projectId` | Needs characters | Complete | Complete | Complete | Complete | Casting Wall covers empty groups, detected speakers, and cleanup. |
| `/arc-timeline/$projectId` | Needs scenes | Complete | Complete | Complete | Complete | Distinguishes zero scenes, <3 scenes, and filter mismatch; each has its own actionable card. |

## Producer

| Route | Menu chip | Free | Creator | Pro | Studio | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `/pitch/$projectId` | 🔒 Creator · Needs script | Gated | Complete | Complete | Complete | `PageFeatureGate` on `pitch`; PDF export requires generated package. |
| `/tableread/$projectId` | 🔒 Pro · Needs characters | Gated | Gated | Complete | Complete | Requires characters; empty-state copy directs to Casting Wall. |
| `/storyboard/$projectId` | 🔒 Pro · Needs scenes | Gated | Gated | Complete | Complete | Generation uses AI Gateway; falls back to demo panel on quota exhaustion. |
| `/writers-room/$projectId` | 🔒 Studio | Gated | Gated | Gated | Complete | Invite / arena / production board live inside; Arena Mode is **Experimental** and labeled inside the room. |

## Studio

| Route | Menu chip | Free | Creator | Pro | Studio | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `/dashboard` | — | Complete | Complete | Complete | Complete | Guided dashboard for `guided`, studio dashboard for `studio`. |
| `/projects` | — | Complete | Complete | Complete | Complete | Includes invite CTA per project card. |
| `/settings` | — | Complete | Complete | Complete | Complete | Mode + coach preferences persist to `profiles.ui_preferences`. |
| `/pricing` | Setup required if Stripe token missing | Complete | Complete | Complete | Complete | Monthly + yearly + coupon path via Stripe embedded checkout. |

## Public & auxiliary

| Route | Status | Notes |
| --- | --- | --- |
| `/` | Complete | Landing hero + pillars. |
| `/auth` | Complete | Sign-in / Google OAuth. |
| `/accept-invite` | Complete | Public wrapper; preserves token across sign-in and mismatch resolution. |
| `/checkout/success` | Complete | Post-checkout redirect. |
| `/privacy`, `/terms`, `/refund`, `/screenplay-formatting-standards` | Complete | Static legal / reference pages with proper meta. |
| `/reset-password` | Complete | Supabase recovery flow. |
| `/editor-lab` | Experimental | Local-first editor sandbox; not linked from Studio Menu. |
| `/sitemap.xml`, `/api/public/payments/webhook`, `/.well-known/*`, `/[.mcp]/*`, `/mcp` | Complete | Infra / integrations; not user-navigable. |

## Status

All Studio Menu destinations are now Complete for their supported tier, with actionable empty states on empty projects.

