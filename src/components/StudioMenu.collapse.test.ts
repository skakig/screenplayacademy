import { describe, it, expect } from "vitest";
import { MENU_MANIFEST } from "./studioMenuManifest";
import { shouldCollapseAsPickProject } from "./StudioMenu";
import type { MenuGateContext } from "@/lib/readiness/menuGate";

/**
 * Snapshot the collapsed-vs-expanded shape of every Studio Menu group across
 * the two project contexts. Keeps the "three different links" bug from
 * regressing (all-pick_project groups must collapse when no project is
 * selected) while ensuring project-independent groups (Studio) and
 * tier-locked-but-reachable groups never collapse.
 */

const baseCtx = (projectId: string | null): MenuGateContext => ({
  tier: "studio",
  stripeReady: true,
  isGuided: true,
  projectId,
  counts: projectId ? { scenes: 3, characters: 3, scriptBlocks: 20 } : null,
});

describe("Studio Menu — group collapse behavior", () => {
  it("collapses Editor + Producer when no project is picked (Studio group stays flat)", () => {
    const ctx = baseCtx(null);
    const shape = MENU_MANIFEST.map((g) => ({
      key: g.key,
      collapsed: shouldCollapseAsPickProject(
        g.items.filter((it) => !(it.guidedOnly && !ctx.isGuided)),
        ctx,
      ),
    }));
    expect(shape).toEqual([
      { key: "school", collapsed: false }, // Academy is always available
      { key: "editor", collapsed: true },
      { key: "world", collapsed: false }, // single-item group → CTA row, not collapse
      { key: "producer", collapsed: true },
      { key: "studio", collapsed: false }, // project-independent
    ]);
  });

  it("expands every group once a project is picked", () => {
    const ctx = baseCtx("proj-123");
    for (const group of MENU_MANIFEST) {
      const items = group.items.filter((it) => !(it.guidedOnly && !ctx.isGuided));
      expect(shouldCollapseAsPickProject(items, ctx)).toBe(false);
    }
  });

  it("does NOT collapse a group merely because every item is tier-locked to /pricing", () => {
    // Simulate a producer group on a Free tier with a project — items resolve
    // to /pricing (tier), not /projects (pick_project). Must stay expanded so
    // the user sees which specific features require upgrade.
    const ctx: MenuGateContext = {
      tier: "free",
      stripeReady: true,
      isGuided: false,
      projectId: "proj-abc",
      counts: { scenes: 0, characters: 0, scriptBlocks: 0 },
    };
    const producer = MENU_MANIFEST.find((g) => g.key === "producer")!;
    expect(shouldCollapseAsPickProject(producer.items, ctx)).toBe(false);
  });
});
