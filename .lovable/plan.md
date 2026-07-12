## Goal

Give `skakig@gmail.com` (user `2d882627-9ef7-4c64-b23b-86f648ec213c`) full access so you can end-to-end test the app, and add an admin-only surface to create/manage Stripe coupons and promotion codes without leaving the app.

Today there is no row for you in `subscriptions` or `user_roles`, so `useSubscription` resolves to `free` and no admin gate exists. Coupons are currently only consumable at checkout (`allow_promotion_codes` + `?promo=` param) — there is no UI to create them.

## Changes

### 1. Seed comped Studio access (migration)

- Insert one row into `public.subscriptions` for both `environment = 'sandbox'` and `environment = 'live'`:
  - `price_id = 'studio_yearly'`, `status = 'active'`, `current_period_end = now() + 10 years`, `cancel_at_period_end = false`, synthetic `stripe_subscription_id`/`stripe_customer_id` prefixed `comp_` so the webhook never overwrites them.
- This makes `useSubscription` + `requireFeature` return `studio` in both preview and production — every `FeatureGate`, `PageFeatureGate`, and server-side `requireFeature` unlocks.

### 2. Grant admin role (migration)

- Insert `(user_id, role='admin')` into `public.user_roles` (already backed by the `has_role` security-definer function).
- Add a tiny `useIsAdmin()` hook that calls `has_role(auth.uid(), 'admin')` for client gating (server checks still use `has_role` in RLS/server fns).

### 3. In-app Coupon & Promo Code manager

New route: `/_authenticated/admin/coupons.tsx`, hidden behind `useIsAdmin()` (renders 404 otherwise).

Server functions in `src/lib/admin/coupons.functions.ts`, all `.middleware([requireSupabaseAuth])` + `has_role(userId,'admin')` check, using the existing `createStripeClient(env)` for both sandbox and live:

- `listCoupons({ environment })` → `stripe.coupons.list`
- `createCoupon({ environment, id?, percentOff?, amountOff?, currency?, duration, durationInMonths?, maxRedemptions?, redeemBy? })`
- `deleteCoupon({ environment, id })`
- `listPromotionCodes({ environment, couponId? })`
- `createPromotionCode({ environment, couponId, code, maxRedemptions?, expiresAt?, firstTimeTransaction?, minimumAmount? })`
- `updatePromotionCode({ environment, id, active })` (Stripe only allows toggling `active`)

UI: two tabs (Sandbox / Live), each showing a coupons table + a promo-codes table with "New coupon" / "New promo code" dialogs and an Active toggle. Existing checkout flow (`allow_promotion_codes` + `?promo=CODE`) already consumes anything you create here — no checkout changes needed.

### 4. Menu entry

Add an "Admin · Coupons" link to `StudioMenu` rendered only when `useIsAdmin()` is true.

## Notes

- Comped subscriptions use `stripe_subscription_id = 'comp_studio_<env>_<uid>'` so the Stripe webhook's `subscription.updated` handler (keyed on real Stripe IDs) can never touch them.
- Nothing in this plan changes billing logic, RLS on other tables, or the webhook — only additive rows + an admin-gated surface.
- Coupons/promo codes live in Stripe, so sandbox and live are separate namespaces; the UI makes that explicit.

## Acceptance

- Refresh `/pricing` → header shows Studio tier; every gated page (Pitch Bible, Character Bible PDF, Writers' Room, Table Read, Storyboard, MCP writes) renders without upgrade card.
- `/admin/coupons` visible only to you; creating a coupon + promo code in Sandbox and pasting the code on the sandbox checkout applies the discount.
