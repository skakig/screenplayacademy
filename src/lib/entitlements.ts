// Pure entitlement helpers — safe to import from client and server.
// Do NOT put server-only imports (supabase admin, node SDKs) in this file.

export type Tier = "free" | "creator" | "pro" | "studio";

export const TIER_RANK: Record<Tier, number> = {
  free: 0,
  creator: 1,
  pro: 2,
  studio: 3,
};

export const TIER_LABEL: Record<Tier, string> = {
  free: "Free",
  creator: "Creator",
  pro: "Pro",
  studio: "Studio",
};

// The single source of truth for what each feature requires.
// Keep this in sync with the pricing page copy.
export type Feature =
  | "extra_projects" // Free = 1 project only; any paid tier unlocks more
  | "script_brain"
  | "pitch"
  | "pitch_character_bible"
  | "character_bible_pdf"
  | "table_read"
  | "storyboard"
  | "mcp_writes"
  | "writers_room";

export const FEATURE_MIN_TIER: Record<Feature, Tier> = {
  extra_projects: "creator",
  script_brain: "creator",
  pitch: "creator",
  pitch_character_bible: "pro",
  character_bible_pdf: "pro",
  table_read: "pro",
  storyboard: "pro",
  mcp_writes: "pro",
  writers_room: "studio",
};

export const FEATURE_LABEL: Record<Feature, string> = {
  extra_projects: "additional projects",
  script_brain: "Script Brain",
  pitch: "Pitch Deck",
  pitch_character_bible: "Character Bible in pitch export",
  character_bible_pdf: "Character Bible PDF export",
  table_read: "Table Read",
  storyboard: "Storyboard",
  mcp_writes: "MCP write tools",
  writers_room: "Writers' Room collaboration",
};

export function tierFromPriceId(priceId: string | null | undefined): Tier {
  switch (priceId) {
    case "studio_monthly":
    case "studio_yearly":
      return "studio";
    case "pro_monthly":
    case "pro_yearly":
      return "pro";
    case "creator_monthly":
    case "creator_yearly":
      return "creator";
    default:
      return "free";
  }
}

export type Cadence = "monthly" | "yearly";

export function cadenceFromPriceId(priceId: string | null | undefined): Cadence {
  return typeof priceId === "string" && priceId.endsWith("_yearly") ? "yearly" : "monthly";
}

/**
 * Pick a Lovable AI Gateway model appropriate to the subscriber's tier.
 * Free/creator get the cheapest fast model; pro gets a balanced flash;
 * studio unlocks the strongest generalist. Keeps API spend proportional
 * to plan revenue.
 */
export function modelForTier(tier: Tier): string {
  switch (tier) {
    case "studio":
      return "google/gemini-2.5-pro";
    case "pro":
      return "google/gemini-3.5-flash";
    case "creator":
    case "free":
    default:
      return "google/gemini-3.1-flash-lite";
  }
}

export function hasFeature(tier: Tier, feature: Feature): boolean {
  return TIER_RANK[tier] >= TIER_RANK[FEATURE_MIN_TIER[feature]];
}

export function minTierFor(feature: Feature): Tier {
  return FEATURE_MIN_TIER[feature];
}
