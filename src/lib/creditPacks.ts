/**
 * Server-authoritative credit pack catalog. The webhook trusts this map
 * over anything in the Stripe payload — never derive `amount` from client
 * metadata.
 *
 * Prices are configured in the Lovable payments dashboard (Stripe) with
 * matching lookup_keys. Never expose "tokens" or "characters" in UI copy
 * (users don't know what those are) — see `label` and `subtitle`.
 */

export type CreditFeature = "ai_tokens" | "tts_characters";

export interface CreditPack {
  priceId: string;
  feature: CreditFeature;
  amount: number;
  usd: number;
  label: string;
  subtitle: string;
}

export const CREDIT_PACKS: readonly CreditPack[] = [
  {
    priceId: "ai_credits_small",
    feature: "ai_tokens",
    amount: 100_000,
    usd: 9,
    label: "AI Credits — Starter",
    subtitle: "Roughly 40–80 AI assists.",
  },
  {
    priceId: "ai_credits_medium",
    feature: "ai_tokens",
    amount: 500_000,
    usd: 29,
    label: "AI Credits — Plus",
    subtitle: "Roughly 200–400 AI assists.",
  },
  {
    priceId: "ai_credits_large",
    feature: "ai_tokens",
    amount: 1_750_000,
    usd: 79,
    label: "AI Credits — Pro Pack",
    subtitle: "Roughly 700–1400 AI assists.",
  },
  {
    priceId: "tts_credits_small",
    feature: "tts_characters",
    amount: 15_000,
    usd: 9,
    label: "Table Read — Starter",
    subtitle: "About 2 minutes of audio.",
  },
  {
    priceId: "tts_credits_medium",
    feature: "tts_characters",
    amount: 40_000,
    usd: 19,
    label: "Table Read — Plus",
    subtitle: "About 5 minutes of audio.",
  },
  {
    priceId: "tts_credits_large",
    feature: "tts_characters",
    amount: 100_000,
    usd: 39,
    label: "Table Read — Pro Pack",
    subtitle: "About 12 minutes of audio.",
  },
] as const;

export function packByPriceId(priceId: string | null | undefined): CreditPack | null {
  if (!priceId) return null;
  return CREDIT_PACKS.find((p) => p.priceId === priceId) ?? null;
}

export function packsByFeature(feature: CreditFeature): CreditPack[] {
  return CREDIT_PACKS.filter((p) => p.feature === feature);
}

/**
 * Given a failing `USAGE_LIMIT` feature name, return the credit feature
 * that a top-up would help with. `ai_assists` → `ai_tokens` because
 * `ai_tokens` credit also unlocks assist overflow (see consume_usage).
 */
export function upsellFeatureFor(feature: string): CreditFeature | null {
  if (feature === "ai_tokens" || feature === "ai_assists") return "ai_tokens";
  if (feature === "tts_characters" || feature === "tableread_minutes") return "tts_characters";
  return null;
}
