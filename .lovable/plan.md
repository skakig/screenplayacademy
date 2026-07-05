# Payments, Auth, Entitlements & Metering — Cleanup Pass

## What was broken

1. **Env leak in server-side entitlement checks.** `requireFeature` and `createProjectGated` queried the newest subscription row across sandbox + live — a test-mode subscription in preview would have unlocked features after publish, and vice versa. `useSubscription` was already env-scoped, so client and server disagreed.
2. **No password reset flow.** No "Forgot password?" affordance, no `/reset-password` route.
3. **`/checkout/success` didn't wait for the webhook.** Users saw "Free" for a beat after paying because the row is written asynchronously.
4. **`PageFeatureGate` optimistically rendered paid children while loading**, flashing premium UI to un-entitled users on hard refresh.
5. **Live-mode Paddle approval is still pending**, but pricing CTAs still tried to open the overlay — Paddle would error.
6. **Metered usage advertised but not enforced.** Pricing promises monthly caps on AI assists, storyboard panels, and table-read minutes. No tracking existed.

## What was added

### Database (migration `202607052011…`)

- `usage_counters(user_id, environment, period_start, feature, count_used)` with a unique key per user/env/month/feature. RLS: users see own rows, service_role manages.
- `usage_limit_for(tier, feature)` — SQL source-of-truth for monthly caps:
  - **ai_assists**: free 5 / creator 100 / pro 500 / studio 1000
  - **storyboard_panels**: free 0 / creator 25 / pro 100 / studio 500
  - **tableread_minutes**: free 0 / creator 30 / pro 180 / studio 600
- `consume_usage(feature, amount, environment)` — atomic check-and-increment. Raises `USAGE_LIMIT: …` when the cap is hit; rolls the increment back so counters never exceed the cap. `SECURITY DEFINER`, scoped to `auth.uid()`.
- `get_usage_snapshot(environment)` — returns current-month used / monthly_limit / tier per feature for the caller. Ready to wire into Settings later.
- Regranted `current_subscription_tier` EXECUTE to `authenticated` (needed by the new RPCs).

### Server-side entitlements now env-scoped

- New `src/lib/paddleEnv.server.ts` mirrors the client's `getPaddleEnvironment()` by reading `VITE_PAYMENTS_CLIENT_TOKEN` server-side.
- `src/lib/entitlements.functions.ts::requireFeature` and `src/lib/projects.functions.ts::createProjectGated` filter subscriptions by `environment = serverPaddleEnv()`.

### Metering wired into the three paid entry points

- `src/lib/usage.functions.ts` — `consumeUsage(supabase, feature, amount)` helper + `getUsageSnapshot` server fn.
- `aiAssist` → 1 assist; `generatePitchPackage` → 10 assists (heavier call).
- `generateStoryboardPanel` → 1 panel.
- `generateTableRead` → estimated minutes at 150 wpm, consumed **before** hitting ElevenLabs so over-quota users never burn TTS credits.

Errors surface as `Error("USAGE_LIMIT: …")` — the existing toast handling in the UI shows the message verbatim.

### Password reset

- `/auth` now has a "Forgot password?" link on the sign-in form. Sends `resetPasswordForEmail` with `redirectTo=/reset-password`.
- New public `/reset-password` route (SSR off) waits for the Supabase recovery session, then calls `updateUser({ password })` and drops the user into `/dashboard`.

### Checkout success polling

- `/checkout/success` uses `useSubscription` and re-invalidates every 1.5s (up to 30s) until the webhook lands. Shows "Confirming your subscription…" while waiting; switches to "Welcome to the {Tier} plan." as soon as the row appears.

### Live-mode CTA gate

- New env var: `VITE_PAYMENTS_LIVE_APPROVED` (`false` in `.env.production`, `true` in `.env.development`).
- On the live site, until this flips to `true`, all pricing CTAs turn into "Join the waitlist" (mailto) and a banner explains paid plans are launching soon. Flip it to `true` after Paddle's automated review completes.

### `PageFeatureGate` fix

- Loading state now shows a small "Checking your plan…" spinner instead of flashing the paid page.

## How to test in preview (test mode)

Preview always runs against Paddle sandbox with the `test_…` client token.

### Test cards

- `4242 4242 4242 4242` / any future expiry / any CVC — success
- `4000 0000 0000 3220` — triggers 3-D Secure
- `4000 0000 0000 0002` — always declined
- `4000 0027 6000 3184` — succeeds initially, declines on the next renewal (great for testing dunning / past-due UX)

### Flows to walk through

1. **New sign-up + email flow**: register a new account on `/auth`, confirm the "Welcome" toast, land on `/dashboard`.
2. **Password reset**: on `/auth`, enter the email, click **Forgot password?**, open the email, land on `/reset-password`, set a new password → auto-redirect to `/dashboard`.
3. **Free-tier gate**: create one project → try to create a second → server returns `FREE_TIER_LIMIT:` and the UI shows an upgrade CTA.
4. **Feature gate**: while on Free, open `/pitch/:id`, `/tableread/:id`, `/storyboard/:id`, `/writers-room/:id` — each should show the "Upgrade to unlock …" card (no flash of the paid UI).
5. **Checkout — Creator**: from `/pricing`, click **Choose Creator** → Paddle overlay opens with `$19` → pay with `4242…` → overlay closes → `/checkout/success` shows the spinner briefly then "Welcome to the Creator plan." Settings shows Creator badge.
6. **Metering**: open a project, run `Generate logline` from the AI assist menu six times as a free user (before upgrading, if you want to see the cap). You should hit `USAGE_LIMIT: ai_assists monthly cap reached…` on the 6th call. As Creator you have 100/mo; as Pro 500/mo. Same story on the storyboard page (25 panels for Creator) and table read (30 minutes for Creator).
7. **Dunning**: subscribe with `4000 0027 6000 3184`, then in the Paddle dashboard fast-forward `next_billed_at` (or use the Simulator) → the orange banner appears at the top of the app; **Update payment method** opens the Paddle customer portal in a new tab.
8. **Cancel**: Settings → **Manage subscription** → cancel from the Paddle portal. Settings pill should switch to "Ends {date}"; access stays until the paid period ends.
9. **Re-subscribe**: after canceling, hit `/pricing` again → new subscription row is created (keyed on `paddle_subscription_id`) without overwriting the canceled one.
10. **Realtime**: keep Settings open while the webhook writes — the plan pill updates without a page refresh.

### Going live

When Paddle finishes automated review:

1. Flip `VITE_PAYMENTS_LIVE_APPROVED="true"` in `.env.production`.
2. Republish.
3. Live pricing CTAs open real Paddle checkout with the live token.

## Known follow-ups (not in this pass)

- The pricing copy still lists **"3 characters"** for the Free tier; character count isn't enforced yet. Add a `characters` cap if you want to honor it.
- `get_usage_snapshot` is exposed but not surfaced in Settings. Easy add-on: a "This month" widget on the Settings page next to the plan card.
- Consider subscribing to `subscription.paused` / `subscription.resumed` webhooks if you ever expose pause in the portal.
