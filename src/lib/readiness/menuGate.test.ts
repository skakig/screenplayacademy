import { describe, expect, it } from "vitest";
import { resolveMenuGate, scenarioFromCounts } from "./menuGate";
import { MENU_MANIFEST } from "@/components/studioMenuManifest";

function findItem(to: string) {
  for (const g of MENU_MANIFEST) for (const it of g.items) if (it.to === to) return it;
  throw new Error(`no manifest item ${to}`);
}

describe("scenarioFromCounts", () => {
  it("maps counts to canonical project scenarios", () => {
    expect(scenarioFromCounts(null)).toBe("empty_project");
    expect(scenarioFromCounts({ scenes: 0, characters: 0, scriptBlocks: 0 })).toBe("empty_project");
    expect(scenarioFromCounts({ scenes: 3, characters: 0, scriptBlocks: 0 })).toBe("has_scenes");
    expect(scenarioFromCounts({ scenes: 3, characters: 2, scriptBlocks: 0 })).toBe(
      "has_scenes_and_characters",
    );
    expect(scenarioFromCounts({ scenes: 3, characters: 2, scriptBlocks: 12 })).toBe("populated");
  });
});

describe("resolveMenuGate", () => {
  const base = { stripeReady: true, isGuided: true, counts: null };

  it("blocks Scene Board when no project is selected", () => {
    const g = resolveMenuGate(findItem("/scenes/$projectId"), {
      ...base,
      tier: "studio",
      projectId: null,
    });
    expect(g.blockedBy).toBe("pick_project");
    expect(g.targetTo).toBe("/projects");
    expect(g.fixLabel).toBe("Pick a project");
  });

  it("flags needs-data when project has no scenes yet", () => {
    const g = resolveMenuGate(findItem("/scenes/$projectId"), {
      ...base,
      tier: "studio",
      projectId: "p1",
      counts: { scenes: 0, characters: 0, scriptBlocks: 0 },
    });
    expect(g.blockedBy).toBe("needs_data");
    expect(g.needsData).toBe("scenes");
    expect(g.fixTo).toBe("/editor/$projectId");
  });

  it("clears needs-data once the project has scenes", () => {
    const g = resolveMenuGate(findItem("/scenes/$projectId"), {
      ...base,
      tier: "studio",
      projectId: "p1",
      counts: { scenes: 5, characters: 0, scriptBlocks: 0 },
    });
    expect(g.blockedBy).toBe("none");
    expect(g.targetTo).toBe("/scenes/$projectId");
    expect(g.targetParams).toEqual({ projectId: "p1" });
  });

  it("locks tier-gated rooms and redirects to /pricing", () => {
    const g = resolveMenuGate(findItem("/pitch/$projectId"), {
      ...base,
      tier: "free",
      projectId: "p1",
      counts: { scenes: 3, characters: 3, scriptBlocks: 10 },
    });
    expect(g.blockedBy).toBe("tier");
    expect(g.targetTo).toBe("/pricing");
    expect(g.requiredTierLabel).toBeTruthy();
  });

  it("prefers tier over needs-data (tier is highest-precedence friction)", () => {
    const g = resolveMenuGate(findItem("/tableread/$projectId"), {
      ...base,
      tier: "free",
      projectId: "p1",
      counts: { scenes: 0, characters: 0, scriptBlocks: 0 },
    });
    expect(g.blockedBy).toBe("tier");
  });

  it("routes billing setup to /pricing when stripe is missing", () => {
    const g = resolveMenuGate(findItem("/pricing"), {
      ...base,
      stripeReady: false,
      tier: "free",
      projectId: null,
    });
    expect(g.setupRequired).toBe(true);
    expect(g.blockedBy).toBe("setup");
    expect(g.fixLabel).toBe("Finish setup");
  });

  it("passes through routes with no gating", () => {
    const g = resolveMenuGate(findItem("/dashboard"), {
      ...base,
      tier: "free",
      projectId: null,
    });
    expect(g.blockedBy).toBe("none");
    expect(g.targetTo).toBe("/dashboard");
  });
});
