import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { StateBadges } from "./StudioMenu";
import {
  FEATURE_MIN_TIER,
  TIER_LABEL,
  TIER_RANK,
  type Feature,
  type Tier,
} from "@/lib/entitlements";

/**
 * Canonical badge order rendered by <StateBadges />:
 *   1. Tier lock  →  2. Beta  →  3. Setup  →  4. Pick a project  →  5. Needs data
 * These tests assert that order across every Free/Creator/Pro/Studio tier
 * and every menu-item shape (locked, experimental, setup-required,
 * missing-project, needs-data) rendered in the Studio Menu.
 */

type Item = {
  label: string;
  needsProject?: boolean;
  feature?: Feature;
  experimental?: boolean;
  setupRequires?: "billing";
  needsData?: "scenes" | "characters" | "script";
};

// Mirror of the real Studio Menu items (see src/components/StudioMenu.tsx).
const MENU_ITEMS: Item[] = [
  { label: "SceneSmith Academy" },
  { label: "Guided Path", needsProject: true },
  { label: "Writer's Desk", needsProject: true },
  { label: "Scene Board", needsProject: true, needsData: "scenes" },
  { label: "Scene Vault", needsProject: true },
  { label: "Story Spine", needsProject: true },
  { label: "Casting Wall", needsProject: true, needsData: "characters" },
  { label: "Dramatic Pulse", needsProject: true, needsData: "scenes" },
  { label: "Pitch Deck", needsProject: true, feature: "pitch", needsData: "script" },
  { label: "Table Read", needsProject: true, feature: "table_read", needsData: "characters", experimental: true },
  { label: "Shot Wall", needsProject: true, feature: "storyboard", needsData: "scenes", experimental: true },
  { label: "Writers' Room", needsProject: true, feature: "writers_room", experimental: true },
  { label: "Studio Lobby" },
  { label: "Script Vault" },
  { label: "Studio Settings" },
  { label: "Pricing", setupRequires: "billing" },
];

const TIERS: Tier[] = ["free", "creator", "pro", "studio"];

function hasFeatureTier(tier: Tier, feature: Feature | undefined): boolean {
  if (!feature) return true;
  return TIER_RANK[tier] >= TIER_RANK[FEATURE_MIN_TIER[feature]];
}

function expectedBadges(opts: {
  item: Item;
  tier: Tier;
  projectId: string | null;
  stripeReady: boolean;
}): string[] {
  const { item, tier, projectId, stripeReady } = opts;
  const locked = !hasFeatureTier(tier, item.feature);
  const requiredTier = item.feature ? FEATURE_MIN_TIER[item.feature] : null;
  const missingProject = Boolean(item.needsProject && !projectId);
  const setupRequired = item.setupRequires === "billing" && !stripeReady;

  const badges: string[] = [];
  if (locked && requiredTier) badges.push(`lock:${TIER_LABEL[requiredTier]}`);
  if (item.experimental) badges.push("beta");
  if (setupRequired) badges.push("setup");
  if (missingProject) badges.push("pick");
  if (!missingProject && item.needsData) badges.push(`needs:${item.needsData}`);
  return badges;
}

function renderBadges(item: Item, tier: Tier, projectId: string | null, stripeReady: boolean) {
  const locked = !hasFeatureTier(tier, item.feature);
  const requiredTier = item.feature ? FEATURE_MIN_TIER[item.feature] : null;
  const missingProject = Boolean(item.needsProject && !projectId);
  const setupRequired = item.setupRequires === "billing" && !stripeReady;
  return renderToStaticMarkup(
    <StateBadges
      locked={locked}
      requiredTier={requiredTier}
      experimental={item.experimental}
      setupRequired={setupRequired}
      missingProject={missingProject}
      needsData={item.needsData}
    />,
  );
}

function orderInMarkup(html: string, badges: string[]): number[] {
  return badges.map((b) => {
    if (b === "beta") return html.indexOf("Beta");
    if (b === "setup") return html.indexOf("Setup");
    if (b === "pick") return html.indexOf("Pick a project");
    if (b.startsWith("lock:")) return html.indexOf(b.slice(5));
    if (b.startsWith("needs:")) return html.indexOf(`Needs ${b.slice(6)}`);
    return -1;
  });
}

describe("StudioMenu StateBadges — order across tiers and scenarios", () => {
  const scenarios = [
    { name: "no project + billing unconfigured", projectId: null, stripeReady: false },
    { name: "no project + billing ready", projectId: null, stripeReady: true },
    { name: "with project + billing unconfigured", projectId: "proj-1", stripeReady: false },
    { name: "with project + billing ready", projectId: "proj-1", stripeReady: true },
  ];

  for (const tier of TIERS) {
    for (const scenario of scenarios) {
      for (const item of MENU_ITEMS) {
        it(`${tier} / ${scenario.name} / ${item.label} renders badges in canonical order`, () => {
          const expected = expectedBadges({ item, tier, projectId: scenario.projectId, stripeReady: scenario.stripeReady });
          const html = renderBadges(item, tier, scenario.projectId, scenario.stripeReady);
          const positions = orderInMarkup(html, expected);

          // Every expected badge appears in the markup.
          expect(positions.every((p) => p >= 0)).toBe(true);
          // And they appear strictly in the canonical order.
          for (let i = 1; i < positions.length; i++) {
            expect(positions[i]).toBeGreaterThan(positions[i - 1]);
          }
        });
      }
    }
  }
});

describe("StudioMenu StateBadges — tier lock coverage", () => {
  it("free tier locks pitch, table_read, storyboard, writers_room", () => {
    const html = MENU_ITEMS.filter((i) => i.feature).map(
      (i) => `${i.label}:${renderBadges(i, "free", "p", true).includes("Lock") || renderBadges(i, "free", "p", true).includes(TIER_LABEL[FEATURE_MIN_TIER[i.feature!]])}`,
    );
    expect(html).toEqual([
      "Pitch Deck:true",
      "Table Read:true",
      "Shot Wall:true",
      "Writers' Room:true",
    ]);
  });

  it("creator tier unlocks pitch but still locks pro/studio features", () => {
    const results = MENU_ITEMS.filter((i) => i.feature).map((i) => {
      const html = renderBadges(i, "creator", "p", true);
      return { label: i.label, locked: html.includes("Lock") };
    });
    expect(results).toEqual([
      { label: "Pitch Deck", locked: false },
      { label: "Table Read", locked: true },
      { label: "Shot Wall", locked: true },
      { label: "Writers' Room", locked: true },
    ]);
  });

  it("pro tier unlocks pitch + table_read + storyboard, still locks writers_room", () => {
    const results = MENU_ITEMS.filter((i) => i.feature).map((i) => ({
      label: i.label,
      locked: renderBadges(i, "pro", "p", true).includes("Lock"),
    }));
    expect(results).toEqual([
      { label: "Pitch Deck", locked: false },
      { label: "Table Read", locked: false },
      { label: "Shot Wall", locked: false },
      { label: "Writers' Room", locked: true },
    ]);
  });

  it("studio tier unlocks every feature", () => {
    const anyLocked = MENU_ITEMS.filter((i) => i.feature).some((i) =>
      renderBadges(i, "studio", "p", true).includes("Lock"),
    );
    expect(anyLocked).toBe(false);
  });
});

describe("StudioMenu StateBadges — needs-data suppression", () => {
  it("hides 'Needs …' when project is missing (Pick a project takes priority)", () => {
    const item = MENU_ITEMS.find((i) => i.label === "Scene Board")!;
    const html = renderBadges(item, "free", null, true);
    expect(html).toContain("Pick a project");
    expect(html).not.toContain("Needs scenes");
  });

  it("shows 'Needs …' when project exists", () => {
    const item = MENU_ITEMS.find((i) => i.label === "Casting Wall")!;
    const html = renderBadges(item, "free", "p", true);
    expect(html).toContain("Needs characters");
    expect(html).not.toContain("Pick a project");
  });
});
