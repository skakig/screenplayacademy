# SceneSmith Studio — Premium Launch Readiness Plan

Skipping (per your call): team seats, real go-live (post-test), for now.
Shipping in this plan: **yearly billing**, **promo/coupon codes**, **hardened AI/voice cost metering**, and a short list of launch-critical polish items.

---

## 1. Yearly billing (annual plans at a discount)

**Pricing model** (roughly 2 months free = ~17% off):

- `creator_yearly` — $190/yr (vs $228)
- `pro_yearly` — $490/yr (vs $588)
- `studio_yearly` — $1,490/yr (vs $1,788)

**Work:**

- Add three yearly prices via `payments--create_price` on the existing products.
- Extend `tierFromPriceId` in `src/lib/entitlements.ts` to map `*_yearly` → same tier as monthly.
- Update `TIERS` in `src/routes/pricing.tsx` with a **Monthly / Yearly toggle** (segmented control at top). Highlight "Save ~17%" badge on yearly.
- `useSubscription` already carries `price_id`; add a derived `cadence: "monthly" | "yearly"` for UI ("Renews yearly on …").
- Webhook already stores `price_id` via lookup key — no schema change needed.

---

## 2. Promo / coupon codes

**Model:** use native Stripe Coupons + Promotion Codes (Stripe stores + enforces; we surface + manage).

**Checkout wiring:**

- `createCheckoutSession` in `src/utils/payments.functions.ts`: add `allow_promotion_codes: true` so any active promo code entered on the Stripe embedded checkout applies automatically. (Compatible with both `automatic_tax` and future `managed_payments`.)
- Optional `promotionCode` param for pre-applied links (e.g. `/pricing?promo=LAUNCH50`) — resolves the promo code ID server-side and passes `discounts: [{ promotion_code }]`.

**Admin management UI** at `/_authenticated/admin/promos` (gated by `has_role(auth.uid(),'admin')`):

- New `admin` role via the standard `user_roles` + `has_role` pattern (migration: `app_role` enum, `user_roles` table, RLS, GRANTs).
- Server functions (`src/lib/promos.functions.ts`, `requireSupabaseAuth` + admin check):
  - `listPromoCodes` — Stripe `promotionCodes.list` with coupon expansion.
  - `createPromoCode` — creates a Coupon (percent or amount off, duration: once/repeating/forever, redemption cap, expiry) + a human-readable Promotion Code (e.g. `LAUNCH50`).
  - `archivePromoCode` — sets `active: false`.
- UI: table of codes with redemptions/limits/expiry + "New code" dialog.

**Landing surface:** small "Have a code?" link on `/pricing` that opens a dialog; the code is validated and passed to checkout.

---

## 3. Hardened AI + voice cost metering (the critical one)

Today `usage_counters` caps three coarse buckets: `ai_assists`, `storyboard_panels`, `tableread_minutes`. Gaps that can burn credits:

**a. Token-weighted AI cost, not just call count.**

- Add `usage_counters` feature `ai_tokens` (input+output tokens summed).
- After each `generateText` / `generatePitchPackage` call, add:
  ```ts
  await consumeUsage(supabase, "ai_tokens", Math.ceil(usage.totalTokens));
  ```
  using the Vercel AI SDK's returned `usage` object.
- Set caps in `usage_limit_for()`:
  - free 20k · creator 500k · pro 2.5M · studio 8M tokens/month.
- Weight expensive calls: pitch package already charges 10 assists — keep as a *call* cap AND a token cap (defense in depth).

**b. Per-request hard ceiling.**

- Enforce `maxOutputTokens` on every `generateText` (pitch: 4k, assist: 1k) so a single call can't run away.
- Reject inputs above a size threshold in `inputValidator` (already partly there — extend).

**c. Model tiering by plan.**

- Add `modelForTier(tier)` helper: free/creator → `google/gemini-3.1-flash-lite`, pro → `google/gemini-3.5-flash`, studio → `google/gemini-2.5-pro` for premium calls. Cuts cost dramatically on the free/creator tail.

**d. ElevenLabs / table-read spend.**

- New `usage_counters` feature `tts_characters` (ElevenLabs bills per character).
- In `generateTableRead`, sum `dialogue.length` across lines and `consumeUsage(supabase, "tts_characters", total)` **before** hitting ElevenLabs.
- Caps: free 0 · creator 25k · pro 150k · studio 750k chars/month.
- Keep the existing `tableread_minutes` cap as a secondary guard.

**e. Storyboard image spend.**

- Already gated by `storyboard_panels`. Add a per-project soft cap (e.g. 200 panels/project) surfaced in the UI to prevent runaway generation loops.

**f. Global circuit breaker.**

- New `ai_spend_daily` counter (server-only): if the workspace exceeds a daily $ threshold (configurable secret `AI_DAILY_HARD_CAP_USD`), all AI functions throw a friendly "AI temporarily paused for maintenance" error. Prevents a single bad actor from nuking the month.

**g. Usage visibility.**

- Extend `/_authenticated/settings` with a "Usage this month" card showing all counters as progress bars with % used and reset date (uses existing `getUsageSnapshot`, just add the new features).
- Toast on 80% / hard-block on 100% with an "Upgrade" CTA linking to `/pricing`.

H. Buy more AI Credits. Let's implement a feature that users can buy more AI credits for their projects. These should be added to their accounts and there should be a profile dashboard for their remaining credits. Make this a clean implementation. 

---

## 4. Other launch-critical polish

**Billing / lifecycle:**

- **Cancel flow copy** in Settings: show "Access until &nbsp;" for `cancel_at_period_end=true` (data is there, needs UI).
- **Failed-payment email**: rely on Stripe's built-in dunning emails (enable in Stripe dashboard settings) — no code, but call it out in the launch checklist.
- **Reactivation**: if user has a `canceled` sub still in grace, `/pricing` should show "Reactivate" instead of "Choose" for their prior tier.

**Trust & compliance:**

- Add **Terms/Privacy consent checkbox** on `/auth` signup.
- Add a **"Delete my account"** action in Settings (server fn: cancels Stripe sub, calls `supabaseAdmin.auth.admin.deleteUser`, cascades project data). Required for GDPR/App Store-style expectations.
- Add a **cookie/analytics banner** if we add PostHog/GA later — placeholder now.

**Observability:**

- Structured logging in the webhook handler for every event type (event id, type, subscription id, outcome). Makes support tickets solvable.
- A tiny `/admin/subscriptions` page (admin-only) listing recent subs + statuses.

**Referral hook (optional, cheap):**

- Add a `referral_code` column to `profiles` (auto-generated), and pass as `client_reference_id` on checkout. Enables a future referral program without a schema migration later.

---

## Technical section (implementation order)

1. **Migration**: `app_role` enum + `user_roles` table + `has_role` fn + admin RLS + new `usage_counters` features (`ai_tokens`, `tts_characters`) with grants.
2. **Entitlements**: extend `tierFromPriceId`, add `modelForTier`, extend `usage_limit_for` SQL.
3. **Stripe prices**: `payments--create_price` for 3 yearly SKUs.
4. **Checkout**: `allow_promotion_codes: true`, optional `promotionCode` param, `maxOutputTokens` on all AI calls.
5. **Metering**: token + character consumption in `ai.functions.ts`, `tableread.functions.ts`; daily circuit breaker.
6. **UI**: monthly/yearly toggle on `/pricing`, "Have a code?" dialog, Settings usage card, cancel/reactivate copy, delete-account action.
7. **Admin**: `/admin/promos` page + server functions; `/admin/subscriptions` list.
8. **Tests**: unit tests for `modelForTier`, `tierFromPriceId(*_yearly)`, promo-code server fn validation; integration test for token consumption path.
9. **Docs**: update `docs/PAYMENTS_TEST_SCRIPT.md` with a yearly-checkout flow, promo-code flow, and usage-cap flow (test card 4242, promo `TEST100`).

**Rollout order I'd recommend shipping in:** 3 (metering — protects credits *now*) → 2 (promos — needed for launch marketing) → 1 (yearly — revenue) → 4 (polish).

Approve and I'll start with #3.