## Goal

Walk the Stripe payment layer end-to-end, close every remaining gap from the last audit, and leave you with a short, deterministic test script for the preview.

## The seven remaining setup steps

### 1. Confirm Stripe products + prices exist with correct lookup_keys

Verify that `creator_monthly` ($19), `pro_monthly` ($49), and `studio_monthly` ($149) exist in the sandbox catalog with `lookup_key` set (the webhook + checkout both key off this). If any are missing or misconfigured, recreate via `payments--batch_create_product` with SaaS tax code `txcd_10103001`.

### 2. Wire full compliance handling (`managed_payments`) into checkout

Sandbox seller is US-based and eligible. Add `managed_payments: { enabled: true }` to `createCheckoutSession` for subscriptions so Stripe handles tax calc, collection, filing, and remittance. Strip incompatible params (`automatic_tax`, `tax_id_collection`).

### 3. Add "prevent duplicate active subscription" guard

Before opening checkout on `/pricing`, if `useSubscription().isActive`, route the user to Customer Portal instead of a new checkout session. Prevents users from stacking two subscriptions on the same account.

### 4. Surface & handle `cancel_at_period_end` upgrades/downgrades

Currently the settings PlanCard only shows "Scheduled to cancel". Add:
- If active and on a different tier, allow "Change plan" that opens the Customer Portal's subscription-update flow (portal `flow_data`).
- After a portal action returns, refetch `subscription` immediately (not just via webhook race).

### 5. Add a global `DunningBanner` + `PaymentTestModeBanner` mount

`DunningBanner` exists but isn't mounted anywhere. Mount both banners in `_authenticated/route.tsx` above `<Outlet />` so past_due users see the retry CTA on every authed page, and testers always see they're in sandbox.

### 6. Harden webhook: handle missing/renamed events + refund/chargeback

The current webhook logs "Unhandled" for `invoice.paid` and `checkout.session.completed`, and doesn't touch on `charge.refunded`, `charge.dispute.created`, or `customer.subscription.trial_will_end`. Add:
- `charge.refunded` → set `status = 'refunded'` on the matching subscription (or leave read-side to interpret; add column if needed) and drop entitlement.
- `charge.dispute.created` → log + optionally mark `past_due`-equivalent hold flag.
- Ensure `invoice.paid` renewals refresh `current_period_end` even if `subscription.updated` is delayed.

### 7. End-to-end test script + smoke run in preview

Deliver a single markdown script (checked into `docs/`) covering the four flows below, plus run the "happy path" myself in Playwright to confirm it green-lights before handing back.

## Test script (delivered as `docs/PAYMENTS_TEST_SCRIPT.md`)

1. **Happy path**: sign in → `/pricing` → Choose Pro → card `4242 4242 4242 4242` → land on `/checkout/success` → tier flips to "Pro" within ~5s → Settings shows renewal date.
2. **Duplicate guard**: while Pro-active, click Choose Pro again → routed to Customer Portal, not a new session.
3. **Cancel + grace**: Settings → Manage subscription → cancel in portal → PlanCard shows "Ends {date}" badge, access preserved until period end.
4. **Dunning**: use card `4000 0000 0000 0341` (attaches, later invoice fails) → wait for `invoice.payment_failed` webhook → orange DunningBanner appears app-wide → "Update payment method" opens portal in new tab.
5. **3DS**: `4000 0025 0000 3155` → SCA challenge → completes and lands on success.

Note on Customer Portal: it must be opened in a real browser tab (not the Lovable preview iframe), and the Stripe test-mode banner will be visible throughout — both are expected.

## Files touched

- `src/utils/payments.functions.ts` — `managed_payments` on subscription sessions
- `src/routes/pricing.tsx` — duplicate-subscription guard
- `src/routes/_authenticated/settings.tsx` — change-plan CTA + immediate refetch
- `src/routes/_authenticated/route.tsx` — mount `DunningBanner` + `PaymentTestModeBanner`
- `src/routes/api/public/payments/webhook.ts` — new event handlers (refund, dispute, invoice.paid renewal)
- `docs/PAYMENTS_TEST_SCRIPT.md` — new file
- Possibly a small migration if `charge.refunded` needs a distinct status column; otherwise reuse existing statuses.

## Out of scope

- Yearly billing prices (not requested; add later if you want).
- Team seats / quantity-based pricing.
- Coupon/promo codes.
- Real go-live (still on sandbox until you finish Stripe onboarding in the Payments dashboard).
- Additional AI-usage-based metering beyond what `usage_counters` already tracks.

## Risks

- `managed_payments` adds +3.5% per transaction. Confirm before I enable it — otherwise I fall back to `automatic_tax: { enabled: true }` at +0.5%.
- Customer Portal `flow_data` requires portal configuration in Stripe; if it's not enabled I'll fall back to plain portal + a note in the UI.
- Refund/dispute status handling requires a product decision on whether refunded users lose access immediately or at period end.

## Approval needed on two choices before I ship

1. **Tax handling**: full `managed_payments` (+3.5%) or `automatic_tax` only (+0.5%)?
2. **On refund**: revoke access immediately, or preserve until `current_period_end`?

Reply with your picks (or "your call") and I'll execute all seven steps in one build pass and then run the happy-path Playwright smoke test.