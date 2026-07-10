# Payments Test Script — SceneSmith Studio

All checkout in the preview and non-live builds runs against Stripe **sandbox**.
The orange top banner (`PaymentTestModeBanner`) is visible whenever the
publishable token starts with `pk_test_`.

Customer Portal must open in a **real browser tab** — it cannot render inside
the Lovable preview iframe.

## Test cards

| Card | Behavior |
| --- | --- |
| `4242 4242 4242 4242` | Success |
| `4000 0025 0000 3155` | 3-D Secure challenge, then success |
| `4000 0000 0000 0341` | Attaches, but the first invoice fails → `past_due` |
| `4000 0000 0000 0002` | Generic decline |

Any future expiry (e.g. `12 / 34`), any 3-digit CVC, any 5-digit ZIP.

## 1. Happy path — new subscription

1. Sign in as a fresh user.
2. Visit `/pricing`, click **Choose Pro**.
3. Pay with `4242 4242 4242 4242`.
4. You land on `/checkout/success`. The "Confirming your subscription…"
   spinner flips to **Welcome to the Pro plan** within ~5 s (webhook race).
5. `/settings` → the Plan card shows **Pro** + a *Renews on {date}* line.

## 2. Duplicate-subscription guard

1. While still Pro-active, revisit `/pricing`.
2. Click **Choose Studio**.
3. Instead of a checkout dialog, the app opens the Stripe **Customer Portal**
   in a new tab with a toast: *"You're already on pro. Opening your billing
   portal to change plans."*
4. Change plan inside the portal → close the tab → Settings PlanCard refetches
   twice and reflects the new tier.

## 3. Cancel + grace period

1. `/settings` → **Manage subscription** → cancel in the portal (at period end).
2. Back in Settings, the Plan card shows an **Ends {date}** orange badge.
3. All premium features remain usable until `current_period_end`.

## 4. Dunning (past_due)

1. Sign up a fresh user, subscribe to **Creator** with `4000 0000 0000 0341`.
2. Wait for Stripe to attempt the first invoice. It fails.
3. The webhook flips the row to `past_due`.
4. Every authenticated page shows the orange `DunningBanner`
   (*"Your last payment failed. Update your card…"*).
5. Clicking **Update payment method** opens the portal in a new tab.

## 5. 3-D Secure

1. Subscribe to any plan with `4000 0025 0000 3155`.
2. Complete the SCA challenge in the embedded checkout.
3. Land on `/checkout/success`; tier flips like the happy path.

## 6. Refund

1. In the Stripe dashboard (test mode), refund a charge for a subscribed user.
2. The `charge.refunded` webhook flips their row to `past_due`.
3. Access is preserved until `current_period_end` — the DunningBanner surfaces
   so the user can update their card or cancel cleanly.

## 7. Webhook idempotency

Re-deliver any event from the Stripe dashboard. The handler inserts into
`processed_webhook_events` first and returns `{ received: true, duplicate: true }`
on the retry without re-running the mutation.
