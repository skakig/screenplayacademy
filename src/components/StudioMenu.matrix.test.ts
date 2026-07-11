import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { MENU_MANIFEST } from "./studioMenuManifest";
import {
  ALL_PROJECT_SCENARIOS,
  ALL_TIERS,
  buildRouteMatrix,
  computeEntry,
  renderMatrixMarkdown,
  summarize,
} from "./studioMenuMatrix";

/**
 * Freshness contract for the route matrix.
 *
 * These tests double as the automated regeneration step. If someone touches
 * the Studio Menu (adds/removes an item, flips `experimental`, changes a
 * tier gate, etc.) without running `bun run route-matrix`, this file
 * fails CI with a message pointing to the command that will fix it.
 */

const MD_PATH = resolve(process.cwd(), "docs/ROUTE_MATRIX.generated.md");
const JSON_PATH = resolve(process.cwd(), "docs/route-matrix.generated.json");

describe("Studio Menu route matrix", () => {
  it("audits every menu item across every tier and project scenario", () => {
    const entries = buildRouteMatrix(MENU_MANIFEST);
    const totalItems = MENU_MANIFEST.reduce((sum, g) => sum + g.items.length, 0);
    const expected =
      totalItems *
      ALL_TIERS.length *
      ALL_PROJECT_SCENARIOS.length *
      2 /* stripeReady */ *
      2 /* isGuided */;
    expect(entries.length).toBe(expected);
  });

  it("derives the same badge order the StateBadges component renders", () => {
    // Table Read on Free with no project = locked (tier) + Beta + Pick a project
    const tableRead = MENU_MANIFEST.find((g) => g.key === "producer")!
      .items.find((i) => i.label === "Table Read")!;
    const entry = computeEntry({
      group: "producer",
      item: tableRead,
      tier: "free",
      scenario: "no_project",
      stripeReady: true,
      isGuided: false,
    });
    expect(entry.badgeOrder[0]).toMatch(/^Locked → /);
    expect(entry.badgeOrder).toContain("Beta");
    expect(entry.badgeOrder).toContain("Pick a project");
    // "Needs …" chip must be suppressed when the item is already asking for a project.
    expect(entry.badgeOrder.some((b) => b.startsWith("Needs"))).toBe(false);
    expect(entry.blockedBy).toBe("tier");
  });

  it("clears friction when the highest tier meets every prerequisite", () => {
    const entries = buildRouteMatrix(MENU_MANIFEST, {
      tiers: ["studio"],
      scenarios: ["populated"],
      stripeStates: [true],
      guidedStates: [true],
    });
    for (const e of entries) {
      expect(e.blockedBy).toBe("none");
    }
  });

  it("summarizes every item with its locked tiers and blocking scenarios", () => {
    const summary = summarize(MENU_MANIFEST);
    const pitch = summary.find((s) => s.label === "Pitch Deck")!;
    expect(pitch.requiredTier).toBe("creator");
    expect(pitch.lockedTiers).toContain("free");
    expect(pitch.blockingScenarios).toContain("no_project");
    expect(pitch.blockingScenarios).toContain("empty_project");
  });

  it("stays in sync with the committed docs/route-matrix.generated.* files", () => {
    const hint =
      "\n\nThe Studio Menu manifest changed. Run:\n\n  bun run route-matrix\n\n" +
      "to regenerate docs/ROUTE_MATRIX.generated.md and docs/route-matrix.generated.json.";

    expect(existsSync(MD_PATH), `Missing ${MD_PATH}${hint}`).toBe(true);
    expect(existsSync(JSON_PATH), `Missing ${JSON_PATH}${hint}`).toBe(true);

    const expectedMd = renderMatrixMarkdown(MENU_MANIFEST) + "\n";
    const expectedJson =
      JSON.stringify(
        {
          generatedFrom: "src/components/studioMenuManifest.ts",
          summary: summarize(MENU_MANIFEST),
          entries: buildRouteMatrix(MENU_MANIFEST),
        },
        null,
        2,
      ) + "\n";

    const actualMd = readFileSync(MD_PATH, "utf8");
    const actualJson = readFileSync(JSON_PATH, "utf8");
    expect(actualMd, `docs/ROUTE_MATRIX.generated.md is stale.${hint}`).toBe(expectedMd);
    expect(actualJson, `docs/route-matrix.generated.json is stale.${hint}`).toBe(expectedJson);
  });
});
