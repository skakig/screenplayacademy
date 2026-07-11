import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { StateBadges } from "./StudioMenu";
import { MENU_MANIFEST } from "./studioMenuManifest";
import {
  ALL_TIERS,
  computeEntry,
  type ProjectScenario,
} from "./studioMenuMatrix";
import { TIER_LABEL } from "@/lib/entitlements";

/**
 * Destination-level verification: every Studio Menu destination renders the
 * correct Lock / Beta / Setup / Pick-a-project / Needs-data chips across the
 * three canonical project states (empty, partial, populated) and every tier.
 *
 * Chips render in this exact order:
 *   1. Tier lock   →  2. Beta   →  3. Setup   →  4. Pick a project   →  5. Needs data
 *
 * The matrix engine (`computeEntry`) is the single source of truth for which
 * chips should appear; these tests assert that the rendered DOM matches that
 * derivation for every real destination in `MENU_MANIFEST`.
 */

// Map the three user-facing project states onto matrix scenarios. "partial"
// = has scenes but not characters or script blocks; "populated" = everything.
const PROJECT_STATES: { name: "empty" | "partial" | "populated"; scenario: ProjectScenario }[] = [
  { name: "empty", scenario: "empty_project" },
  { name: "partial", scenario: "has_scenes" },
  { name: "populated", scenario: "populated" },
];

function renderChips(entry: ReturnType<typeof computeEntry>) {
  return renderToStaticMarkup(
    <StateBadges
      locked={entry.locked}
      requiredTier={entry.requiredTier}
      experimental={entry.experimental}
      setupRequired={entry.setupRequired}
      missingProject={entry.missingProject}
      needsData={entry.needsData ?? undefined}
    />,
  );
}

/** Extract the ordered chip labels from rendered markup. */
function extractChipLabels(html: string, entry: ReturnType<typeof computeEntry>): string[] {
  const labels: string[] = [];
  if (entry.locked && entry.requiredTier) labels.push(`Lock:${TIER_LABEL[entry.requiredTier]}`);
  if (entry.experimental) labels.push("Beta");
  if (entry.setupRequired) labels.push("Setup");
  if (entry.missingProject) labels.push("Pick a project");
  if (!entry.missingProject && entry.needsData) labels.push(`Needs ${entry.needsData}`);
  // Cross-check: every expected label must appear in the html; nothing else should.
  for (const label of labels) {
    const needle = label.startsWith("Lock:") ? label.slice(5) : label;
    if (!html.includes(needle)) {
      throw new Error(`Expected chip "${needle}" missing from render: ${html}`);
    }
  }
  return labels;
}

describe("StudioMenu destinations — chip rendering per project state", () => {
  for (const group of MENU_MANIFEST) {
    for (const item of group.items) {
      for (const state of PROJECT_STATES) {
        for (const tier of ALL_TIERS) {
          for (const stripeReady of [true, false]) {
            const entry = computeEntry({
              group: group.key,
              item,
              tier,
              scenario: state.scenario,
              stripeReady,
              isGuided: true, // guided so guidedOnly items are not hidden
            });
            const testName = `${item.to} [${state.name} · ${tier} · stripe=${stripeReady}]`;

            it(`${testName} renders the correct chip set`, () => {
              const html = renderChips(entry);
              const labels = extractChipLabels(html, entry);

              // Order assertion: chip labels appear in canonical order in the markup.
              let cursor = 0;
              for (const label of labels) {
                const needle = label.startsWith("Lock:") ? label.slice(5) : label;
                const idx = html.indexOf(needle, cursor);
                expect(idx, `chip "${needle}" should appear after previous chip`).toBeGreaterThanOrEqual(cursor);
                cursor = idx + needle.length;
              }

              // Absence assertions.
              if (!entry.locked) expect(html).not.toContain("border-amber-500/40");
              if (!entry.experimental) expect(html).not.toContain("Beta");
              if (!entry.setupRequired) expect(html).not.toContain("Setup");
              if (!entry.missingProject) expect(html).not.toContain("Pick a project");
              if (entry.missingProject || !entry.needsData) {
                expect(html).not.toMatch(/Needs (scenes|characters|script)/);
              }
            });
          }
        }
      }
    }
  }
});

describe("StudioMenu destinations — project-state expectations", () => {
  // Item-specific spot checks, one per data requirement, to protect the
  // mapping from empty/partial/populated to needsData in case scenarios drift.
  const cases: {
    label: string;
    to: string;
    state: "empty" | "partial" | "populated";
    expectNeedsData: "scenes" | "characters" | "script" | null;
  }[] = [
    { label: "Scene Board empty → needs scenes", to: "/scenes/$projectId", state: "empty", expectNeedsData: "scenes" },
    { label: "Scene Board partial → satisfied", to: "/scenes/$projectId", state: "partial", expectNeedsData: null },
    { label: "Scene Board populated → satisfied", to: "/scenes/$projectId", state: "populated", expectNeedsData: null },
    { label: "Casting Wall partial (scenes only) → needs characters", to: "/characters/$projectId", state: "partial", expectNeedsData: "characters" },
    { label: "Casting Wall populated → satisfied", to: "/characters/$projectId", state: "populated", expectNeedsData: null },
    { label: "Pitch empty → needs script", to: "/pitch/$projectId", state: "empty", expectNeedsData: "script" },
    { label: "Pitch partial → needs script", to: "/pitch/$projectId", state: "partial", expectNeedsData: "script" },
    { label: "Pitch populated → satisfied", to: "/pitch/$projectId", state: "populated", expectNeedsData: null },
    { label: "Table Read partial (no characters) → needs characters", to: "/tableread/$projectId", state: "partial", expectNeedsData: "characters" },
    { label: "Shot Wall empty → needs scenes", to: "/storyboard/$projectId", state: "empty", expectNeedsData: "scenes" },
  ];

  for (const c of cases) {
    it(c.label, () => {
      const scenario =
        c.state === "empty" ? "empty_project" : c.state === "partial" ? "has_scenes" : "populated";
      const group = MENU_MANIFEST.find((g) => g.items.some((i) => i.to === c.to))!;
      const item = group.items.find((i) => i.to === c.to)!;
      const entry = computeEntry({
        group: group.key,
        item,
        tier: "studio", // highest tier so no lock interference
        scenario,
        stripeReady: true,
        isGuided: true,
      });
      expect(entry.needsData).toBe(c.expectNeedsData);
      const html = renderChips(entry);
      if (c.expectNeedsData) {
        expect(html).toContain(`Needs ${c.expectNeedsData}`);
      } else {
        expect(html).not.toMatch(/Needs (scenes|characters|script)/);
      }
    });
  }
});

describe("StudioMenu destinations — tier lock chip", () => {
  // For every gated destination, free tier must show the Lock chip and the
  // highest tier that satisfies the gate must NOT show it.
  for (const group of MENU_MANIFEST) {
    for (const item of group.items) {
      if (!item.feature) continue;
      it(`${item.to} is tier-locked on lower tiers and unlocked on studio`, () => {
        const lockedEntry = computeEntry({
          group: group.key,
          item,
          tier: "free",
          scenario: "populated",
          stripeReady: true,
          isGuided: true,
        });
        const unlockedEntry = computeEntry({
          group: group.key,
          item,
          tier: "studio",
          scenario: "populated",
          stripeReady: true,
          isGuided: true,
        });
        const lockedHtml = renderChips(lockedEntry);
        const unlockedHtml = renderChips(unlockedEntry);
        expect(lockedEntry.locked).toBe(true);
        expect(lockedHtml).toContain(TIER_LABEL[lockedEntry.requiredTier!]);
        expect(unlockedEntry.locked).toBe(false);
        expect(unlockedHtml).not.toContain("border-amber-500/40");
      });
    }
  }
});

describe("StudioMenu destinations — setup chip", () => {
  it("Pricing shows Setup when Stripe is not ready and hides it when ready", () => {
    const group = MENU_MANIFEST.find((g) => g.items.some((i) => i.to === "/pricing"))!;
    const item = group.items.find((i) => i.to === "/pricing")!;
    const notReady = computeEntry({
      group: group.key,
      item,
      tier: "free",
      scenario: "no_project",
      stripeReady: false,
      isGuided: true,
    });
    const ready = computeEntry({
      group: group.key,
      item,
      tier: "free",
      scenario: "no_project",
      stripeReady: true,
      isGuided: true,
    });
    expect(renderChips(notReady)).toContain("Setup");
    expect(renderChips(ready)).not.toContain("Setup");
  });
});

describe("StudioMenu destinations — Beta chip", () => {
  for (const group of MENU_MANIFEST) {
    for (const item of group.items) {
      if (!item.experimental) continue;
      it(`${item.to} shows the Beta chip on studio + populated`, () => {
        const entry = computeEntry({
          group: group.key,
          item,
          tier: "studio",
          scenario: "populated",
          stripeReady: true,
          isGuided: true,
        });
        expect(entry.experimental).toBe(true);
        expect(renderChips(entry)).toContain("Beta");
      });
    }
  }
});
