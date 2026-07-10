# Buy More Credits — Plan

Let users buy one-time top-ups when they hit (or want to pre-empt) a monthly cap. Same Stripe rails as subscriptions — no new payment processor, no seat/quota complexity.

## Scope

Only the two metered resources that actually map to real API spend:

- **AI credits** — top up `ai_tokens` (drives `ai_assists`, pitch, script brain, coaching, etc.)
- **Table Read credits** — top up `tts_characters` (drives ElevenLabs minutes)

Storyboard panels are already gated by AI tokens under the hood, so no separate pack.

## Packs (one-time, USD)


| Pack                | Price | Grants                 |
| ------------------- | ----- | ---------------------- |
| `ai_credits_small`  | $9    | 100,000 ai_tokens      |
| `ai_credits_medium` | $29   | 500,000 ai_tokens      |
| `ai_credits_large`  | $79   | 1,750,000 ai_tokens    |
| `tts_credits_small` | $9    | 15,000 tts_characters  |
| `tts_credits_large` | $29   | 100,000 tts_characters |



|                    |        |                       |
| ------------------ | ------ | --------------------- |
| tts_credits_medium | $19    | 40,000 tts_characters |
| &nbsp;             | &nbsp; | &nbsp;                |


Prices match the per-token/char spend of the tiers so packs never subsidize free users past cost.

Do not ship the credit pack plan as-is.

The ledger/data model is good, but we need to revise pricing, consumption behavior, and product semantics before implementation.

## Required changes

### 1. Fix the AI assist cap issue

Current AI calls consume `ai_assists` before `ai_tokens`.

If a user hits the `ai_assists` cap, buying `ai_tokens` will not help them.

Choose one:

Option A:

Purchased AI credits cover both `ai_assists` and `ai_tokens`.

Option B:

Once a user has purchased AI credits, `ai_assists` becomes a rate-limit/abuse guard, while `ai_tokens` becomes the true paid overflow meter.

Do not show “Buy AI Credits” for a limit that credits cannot resolve.

### 2. Reduce pack grants

Use safer v1 packs:

```ts id="kl3ml7"

ai_credits_small:  $9  → 100_000 ai_tokens

ai_credits_medium: $29 → 500_000 ai_tokens

ai_credits_large:  $79 → 1_750_000 ai_tokens

tts_credits_small:  $9  → 15_000 tts_characters

tts_credits_medium: $19 → 40_000 tts_characters

tts_credits_large:  $39 → 100_000 tts_characters

## Data model

New table `usage_credit_grants` — an append-only ledger of purchased credits per feature:

```
id, user_id, environment, feature ('ai_tokens'|'tts_characters'),
amount_granted int, amount_consumed int default 0,
stripe_session_id text unique, price_id text, expires_at timestamptz null,
created_at, updated_at
```

Grants never expire (null `expires_at`) for v1. RLS: user reads own; only `service_role` inserts (webhook).

## Consumption logic

Update `consume_usage(_feature, _amount, _environment)`:

1. Increment `usage_counters` as today.
2. If `count_used > monthly_limit`, compute overflow = `count_used - monthly_limit`.
3. Debit overflow from `usage_credit_grants` for `(user_id, environment, feature)` where `amount_consumed < amount_granted`, oldest first. Update `amount_consumed`.
4. If credits can't cover overflow, roll back the counter (same behavior as today) and raise `USAGE_LIMIT`.
5. Otherwise return `count_used`.

`get_usage_snapshot` also returns `credits_remaining` per feature so the UI shows "500k / 500k monthly · +250k credits" style.

`ai_assists` cap stays call-count based (no per-call token pre-flight is meaningful for it); the pre-flight `ai_tokens` reservation already funnels overflow through credits.

## Stripe

- Create 5 one-time prices via `payments--batch_create_product` with tax code `txcd_10000000` (general digital goods).
- Reuse `createCheckoutSession` — it already handles `mode: "payment"` (non-recurring) and `automatic_tax`. No changes.
- Webhook handler adds a `checkout.session.completed` branch:
  - Look up price by `lookup_key`, map to `(feature, amount)` via a server-side constant.
  - Insert row into `usage_credit_grants` keyed by `session.id` for idempotency (existing `processed_webhook_events` still guards outer replay).

## UI

1. **Settings → Usage** — under each of the AI and Table Read usage bars, show `Credits: {remaining}` and a "Buy more" button that opens the pack picker.
2. **Pack picker dialog** (`BuyCreditsDialog.tsx`) — 3 AI packs + 2 TTS packs as cards; clicking one opens embedded Stripe checkout via the existing `useStripeCheckout` hook.
3. **Inline upsell** — when a server fn throws `USAGE_LIMIT: ai_tokens ...` or `USAGE_LIMIT: tts_characters ...`, surface a toast with a "Buy credits" action that opens the dialog (wire through a small `useCreditsUpsell` hook so any component can trigger it).
4. **Success page** — `/checkout/success` already refetches; add a one-time toast when the completed session's mode is `payment` ("250,000 AI credits added").

&nbsp;

Added notes:

I would **not approve this plan as-is**. The architecture is close, but the economics and usage logic need tightening.

The big issue is not only “are the credits profitable?” It is also: **what exactly does an AI credit buy, and does buying it actually unlock the thing the user hit the limit on?**

**Main problem: AI token credits may not bypass the real AI cap**

Current aiAssist consumes **two** resources before running the model:

ai_assists → call-count cap

ai_tokens → token budget cap

The code consumes ai_assists first, then reserves ai_tokens.

So if the user hits the ai_assists monthly cap, buying ai_tokens may **not help them**. Lovable’s plan says “AI assists cap stays call-count based,” but that means the upsell could be broken for the user’s most common limit.

My recommendation: either top-ups must cover both ai_assists and ai_tokens, or paid AI credits should become the overflow mechanism while ai_assists becomes an abuse/rate-limit guard, not a hard blocker.

**The proposed AI credits are too generous from a product/value standpoint**

Current model routing is tier-based:

Free / Creator → google/gemini-3.1-flash-lite

Pro → google/gemini-3.5-flash

Studio → google/gemini-2.5-pro

That matters because the same “1,000,000 ai_tokens” can be much more expensive if consumed by a Studio user on a stronger model. Google lists Gemini 3.1 Flash-Lite at $0.25 input / $1.50 output per 1M tokens, Gemini 3.5 Flash at $1.50 input / $9 output, and Gemini 2.5 Pro at $1.25 input / $10 output for standard prompts under 200k tokens.      

The plan’s $79 → 3.5M ai_tokens is probably still profitable on raw API cost, but it is way too much product utility for one payment. At the current 1,024-token AI assist reservation, 3.5M tokens can represent thousands of lightweight assists if the call-count cap is not also enforced. That can cannibalize subscriptions.

**TTS margins are thinner**

The Table Read side is more dangerous. Your code uses ElevenLabs eleven_multilingual_v2.  It meters both tableread_minutes and tts_characters, consuming characters before making TTS calls.

ElevenLabs says V2 Multilingual is generally 1 text character = 1 credit, with some discounted models ranging 0.5–1 credit per character.   Their Pro plan is $99 for 600k credits and Creator is $22 for 121k credits, so your rough COGS is about **$0.165–$0.18 per 1,000 characters** before any platform overhead.

At $29 → 100,000 tts_characters, after Stripe fees you net about $27.86, and the ElevenLabs cost could be around $16.50–$18.00. That is profitable, but not a huge margin once failed generations, storage, support, refunds, taxes, and disputes are considered. Stripe’s standard domestic card fee is 2.9% + 30¢ per successful transaction.

**My revised pack suggestion**

I’d make credits profitable **and** protect subscriptions by reducing grants:


|                    |           |                        |
| ------------------ | --------- | ---------------------- |
| **Pack**           | **Price** | **Grants**             |
| ai_credits_small   | $9        | 100,000 ai_tokens      |
| ai_credits_medium  | $29       | 500,000 ai_tokens      |
| ai_credits_large   | $79       | 1,750,000 ai_tokens    |
| tts_credits_small  | $9        | 15,000 tts_characters  |
| tts_credits_medium | $19       | 40,000 tts_characters  |
| tts_credits_large  | $39       | 100,000 tts_characters |


That feels much safer.

The original AI packs:

$9 → 250k

$29 → 1M

$79 → 3.5M

are too generous. I’d cut them roughly in half or more.

The original TTS packs:

$9 → 25k

$29 → 100k

are borderline okay, but I’d make TTS more conservative because audio is more directly tied to vendor cost.

**Architecture amendments I’d send Lovable**

Do not ship the credit pack plan as-is.

&nbsp;

The ledger/data model is good, but we need to revise pricing, consumption behavior, and product semantics before implementation.

&nbsp;

## Required changes

&nbsp;

### 1. Fix the AI assist cap issue

&nbsp;

Current AI calls consume `ai_assists` before `ai_tokens`.

&nbsp;

If a user hits the `ai_assists` cap, buying `ai_tokens` will not help them.

&nbsp;

Choose one:

&nbsp;

Option A:

Purchased AI credits cover both `ai_assists` and `ai_tokens`.

&nbsp;

Option B:

Once a user has purchased AI credits, `ai_assists` becomes a rate-limit/abuse guard, while `ai_tokens` becomes the true paid overflow meter.

&nbsp;

Do not show “Buy AI Credits” for a limit that credits cannot resolve.

&nbsp;

### 2. Reduce pack grants

&nbsp;

Use safer v1 packs:

&nbsp;

```ts id="kl3ml7"

ai_credits_small:  $9  → 100_000 ai_tokens

ai_credits_medium: $29 → 500_000 ai_tokens

ai_credits_large:  $79 → 1_750_000 ai_tokens

&nbsp;

tts_credits_small:  $9  → 15_000 tts_characters

tts_credits_medium: $19 → 40_000 tts_characters

tts_credits_large:  $39 → 100_000 tts_characters

Do not use the original 3.5M AI-token large pack for v1.

**3. Do not call the user-facing unit “tokens”**

Users do not understand tokens.

Display:

AI Credits

Table Read Credits

Internally we can still store:

ai_tokens

tts_characters

But the UI should say things like:

Good for roughly 40–80 AI assists depending on request size.

Good for roughly 10–15 minutes of table read audio depending on dialogue density.

**4. Server-side pack authority**

Client catalog may display packs, but the webhook must use a server-only pack map.

Do not trust client metadata for:

- feature
- amount_granted
- price_id
- lookup_key

Webhook should map Stripe lookup_key or [price.id](http://price.id) to a server-side constant.

**5. Model-tier cost protection**

Because different tiers use different models, the same token grant has different COGS.

At minimum, add comments/tests acknowledging:

free/creator → cheaper model

pro → flash model

studio → expensive model

Future-safe option:

Use ai_credit_units instead of raw ai_tokens, where stronger models debit more units per token.

Do not implement that if it makes v1 too big, but design the ledger so this migration is possible.

**6. TTS should be more conservative**

ElevenLabs costs are much closer to revenue than Gemini text generation.

Use smaller TTS grants and add a server-side hard maximum per generation so one table read cannot consume a huge paid balance accidentally.

**7. Credits should not be literally “never expire” without a migration path**

For v1, non-expiring is user-friendly, but it creates an accounting/product liability if vendor prices rise.

At minimum, make expires_at nullable as planned, but put copy in the code comments:

v1 credits do not expire; future packs may include expiration.

Do not promise “lifetime credits forever” in marketing copy.

**Revised acceptance**

- Buying credits actually resolves the limit that triggered the upsell.
- AI credits do not accidentally leave ai_assists blocking the user.
- Pack grants are smaller and profitable.
- Webhook grants are server-authoritative.
- UI does not expose raw token language.
- TTS packs preserve margin after Stripe + ElevenLabs + failures.
- No subscription cannibalization by massive one-time packs.

## Bottom line

&nbsp;

The ledger idea is good. The Stripe flow is fine. The migration shape is reasonable.

&nbsp;

But the original pack sizes are too generous, and the `ai_assists` vs `ai_tokens` issue is a real product bug waiting to happen.

&nbsp;

I’d approve the feature **only after** Lovable adjusts the pack amounts and fixes the “buy credits but still blocked by call-count cap” problem.

## Files

New:

- `src/components/credits/BuyCreditsDialog.tsx`
- `src/components/credits/UsageWithCredits.tsx` (replaces plain progress rows)
- `src/hooks/useCreditsUpsell.ts`
- `src/lib/credits.ts` — pack catalog constant (client-safe, single source of truth for pack → feature/amount mapping; server re-imports)

Edited:

- `supabase/migrations/…` — `usage_credit_grants` table + updated `consume_usage` + updated `get_usage_snapshot`
- `src/routes/api/public/payments/webhook.ts` — `checkout.session.completed` handler
- `src/routes/_authenticated/settings.tsx` — swap usage rows for `UsageWithCredits`
- `src/lib/ai.functions.ts`, `src/lib/tableread.functions.ts` — surface `USAGE_LIMIT` errors with a machine-parseable prefix so the UI can offer the upsell (already done for `USAGE_LIMIT:`; just make the client handler branch on it)

## Out of scope (later)

- Subscription-tier auto-refill
- Credits expiry / rollover rules
- Team-shared credits (waits for Studio seats)
- Refunding unused credits on cancel

Approve and I'll ship it in one pass, starting with the migration.