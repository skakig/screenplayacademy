# Payments & Entitlement Fixes

Based on the audit and your answers, here's what I'll build. Grouped by layer so you can spot-check.

## 1. Webhook fixes — `src/routes/api/public/payments/webhook.ts`

- **Missing `userId` in `customData`**: return **500** (not 200) so Paddle retries and the subscription isn't permanently lost.
- **`subscription.updated`**: also update `product_id`, `price_id`, `paddle_customer_id` (resolved from `importMeta.externalId`) so upgrades/downgrades reflect in DB.
- **`subscription.canceled`**: keep existing `current_period_end` intact (don't null it) and set `cancel_at_period_end=false` — access continues until period end via `has_active_subscription`.
- **`transaction.payment_failed`** / `past_due`: log + let `status='past_due'` land on the row (no revocation — surfaced as banner, not gate).
- **`transaction.completed`**: log only (no one-time products in catalog).

## 2. SQL migration — grace period for `past_due`

Update `has_active_subscription` so `past_due` retains access while Paddle retries (dunning window). Currently `past_due` = no access, which contradicts the "don't revoke on payment retry" pattern.

## 3. Entitlement layer (new)

- **`src/hooks/useSubscription.ts`** — client hook. Reads `subscriptions` filtered by `environment`, orders by `created_at desc`, `.maybeSingle()`. Returns `{ subscription, tier, isActive, isPastDue, isCanceledInGrace }`. Tier derived from `price_id` (`creator_monthly`→`creator`, `pro_monthly`→`pro`, `studio_monthly`→`studio`, else `free`). Subscribes to realtime updates on that user's row.
- **`src/lib/entitlements.ts`** — pure functions:
  - `TIER_RANK = { free:0, creator:1, pro:2, studio:3 }`
  - `FEATURE_MIN_TIER = { script_brain:'creator', pitch:'creator', table_read:'pro', storyboard:'pro', mcp_writes:'pro', writers_room:'studio' }`
  - `hasFeature(tier, feature)`, `tierFromPriceId(priceId)`.
- **`src/utils/entitlements.functions.ts`** — server-side `requireFeature(feature)` helper. Uses `requireSupabaseAuth` context, calls `has_active_subscription` + reads the current row's `price_id`, throws `Response('Payment required', { status: 402 })` if the tier is insufficient.

## 4. Server-side gates

- **Free = 1 project**: `createProject` server fn checks: if no active sub AND user already has ≥1 project → 402.
- **MCP writes**: `src/lib/mcp/tools/_shared.ts` — all 5 write tools call `requireFeature('mcp_writes')` (Pro+) before executing.
- **Script Brain / Pitch / Table Read / Storyboard**: their existing server fns call `requireFeature(...)`.
- **Writers' Room**: seat-count enforcement on `project_invites` creation (Studio only).

## 5. Client-side gates (UX only)

- `<FeatureGate feature="table_read">` wrapper component — shows children if entitled, otherwise renders upgrade CTA linking to `/pricing`.
- Wrap the entry points for each feature (Table Read, Storyboard, Pitch, Script Brain buttons; Writers' Room invite dialog).
- Route guards on `/table-read`, `/storyboard`, etc. — redirect to pricing when un-entitled.

## 6. Settings — replace `profile.plan` with live subscription

- `src/routes/_authenticated/settings.tsx`: read from `useSubscription()`. Show tier badge, renewal date, `cancel_at_period_end` state.
- **"Manage subscription"** button → calls new server fn `createPortalSession` (uses `paddle.customerPortalSessions.create`, resolved from user's `paddle_customer_id`), opens returned URL in new tab.
- Remove `profile.plan` reads across the codebase (grep for `\.plan\b` in components).

## 7. Dunning banner

- New component `<DunningBanner />` in `_authenticated` layout. Shown if `isPastDue`. One-line orange banner with "Update payment method" → opens portal.

## 8. Checkout race fix

- `usePaddleCheckout`: move `setLoading(false)` out of `finally`. Use Paddle's `eventCallback` (`checkout.closed` / `checkout.completed`) to clear loading. Prevents double-click race.

## 9. Testing guide (will print at end)

- Sandbox test cards: `4000 0566 5566 5556` (visa success), `4000 0000 0000 0002` (declined), `4000 0000 0000 3220` (3DS required). Any future expiry, any 3-digit CVC, any name/postal.
- Test scenarios walked through:
  1. Sign up → free tier → try to create 2nd project → 402 upgrade prompt.
  2. Buy Creator → refresh Settings → tier="Creator", Script Brain works, Table Read shows upgrade.
  3. Upgrade to Pro via portal → webhook updates `price_id` → Table Read unlocks live.
  4. Cancel via portal → `cancel_at_period_end=true`, banner shows "ends on X", features stay live.
  5. Trigger `past_due` (Paddle sandbox: use decline card mid-subscription) → dunning banner, features stay live.
- How to inspect webhook events + subscription rows via the backend.

## Files touched

Modified: `webhook.ts`, `settings.tsx`, `usePaddleCheckout.ts`, MCP tools `_shared.ts`, Table Read/Storyboard/Pitch/Script Brain server fns, project-create server fn, `__root.tsx` (banner), route configs for gated pages, migration.

Created: `useSubscription.ts`, `entitlements.ts`, `entitlements.functions.ts`, `FeatureGate.tsx`, `DunningBanner.tsx`, `customerPortal.functions.ts`.

Approve to implement, or tell me what to change.
