/**
 * Shared project-readiness / menu-gate logic.
 *
 * Single source of truth for "is this Studio Menu destination ready for the
 * current user right now?" — consumed by:
 *   - `StudioMenu.tsx` to render badges + choose the click target
 *   - `RouteReadinessGate.tsx` to enforce the same gates at the destination
 *   - `studioMenuMatrix.ts` (which supplies the pure `computeEntry` engine)
 *
 * Keeping these three surfaces on one function guarantees a chip in the menu
 * matches what the route itself does when the user actually clicks through.
 */

import { FEATURE_MIN_TIER, TIER_LABEL, type Tier } from "@/lib/entitlements";
import {
  computeEntry,
  type MatrixEntry,
  type ProjectScenario,
} from "@/components/studioMenuMatrix";
import type { MenuItemManifest } from "@/components/studioMenuManifest";

export type ReadinessCounts = {
  scenes: number;
  characters: number;
  scriptBlocks: number;
};

export function scenarioFromCounts(counts: ReadinessCounts | null | undefined): ProjectScenario {
  if (!counts) return "empty_project";
  const { scenes, characters, scriptBlocks } = counts;
  if (scriptBlocks > 0 && scenes > 0 && characters > 0) return "populated";
  if (scenes > 0 && characters > 0) return "has_scenes_and_characters";
  if (scenes > 0) return "has_scenes";
  return "empty_project";
}

export type MenuGateContext = {
  tier: Tier;
  stripeReady: boolean;
  isGuided: boolean;
  projectId: string | null;
  counts: ReadinessCounts | null;
};

export type MenuGate = MatrixEntry & {
  /** Fully-resolved click target (respects blocked-by redirects). */
  targetTo: string;
  /** Params to pass to <Link>. */
  targetParams: Record<string, string> | undefined;
  /** Human-readable reason if the destination itself should refuse to render. */
  reasonLabel: string | null;
  /** Where the user should go to unblock themselves. */
  fixTo: string;
  fixLabel: string;
  /** Required plan label when blocked by tier. */
  requiredTierLabel: string | null;
};

export type MenuGateItem = Omit<MenuItemManifest, "iconName" | "label" | "desc"> & {
  label?: string;
  desc?: string;
};

export function resolveMenuGate(
  item: MenuGateItem,
  ctx: MenuGateContext,
): MenuGate {
  const scenario: ProjectScenario = ctx.projectId
    ? scenarioFromCounts(ctx.counts)
    : "no_project";

  const entry = computeEntry({
    group: "", // group is irrelevant for gate resolution
    item,
    tier: ctx.tier,
    scenario,
    stripeReady: ctx.stripeReady,
    isGuided: ctx.isGuided,
  });

  const params =
    item.needsProject && ctx.projectId ? { projectId: ctx.projectId } : undefined;

  let targetTo = item.to;
  let targetParams = params;
  let fixTo = item.to;
  let fixLabel = "Open";

  switch (entry.blockedBy) {
    case "tier":
      targetTo = "/pricing";
      targetParams = undefined;
      fixTo = "/pricing";
      fixLabel = entry.requiredTier
        ? `Upgrade to ${TIER_LABEL[entry.requiredTier]}`
        : "Upgrade";
      break;
    case "setup":
      targetTo = "/pricing";
      targetParams = undefined;
      fixTo = "/pricing";
      fixLabel = "Finish setup";
      break;
    case "pick_project":
      targetTo = "/projects";
      targetParams = undefined;
      fixTo = "/projects";
      fixLabel = "Pick a project";
      break;
    case "needs_data": {
      const need = entry.needsData;
      if (need === "scenes") {
        fixTo = "/editor/$projectId";
        fixLabel = "Add a scene";
      } else if (need === "characters") {
        fixTo = "/characters/$projectId";
        fixLabel = "Add a character";
      } else if (need === "script") {
        fixTo = "/editor/$projectId";
        fixLabel = "Write in the editor";
      }
      break;
    }
    default:
      break;
  }

  const reasonLabel = (() => {
    switch (entry.blockedBy) {
      case "tier":
        return entry.requiredTier
          ? `Available on ${TIER_LABEL[entry.requiredTier]} and up`
          : "Locked on your current plan";
      case "setup":
        return "Billing setup required";
      case "pick_project":
        return "Pick a project first";
      case "needs_data":
        return entry.needsData === "characters"
          ? "This room needs at least one character"
          : entry.needsData === "scenes"
            ? "This room needs at least one scene"
            : "This room needs some written pages";
      default:
        return null;
    }
  })();

  return {
    ...entry,
    targetTo,
    targetParams,
    reasonLabel,
    fixTo,
    fixLabel,
    requiredTierLabel: entry.requiredTier ? TIER_LABEL[entry.requiredTier] : null,
  };
}

/** Look up a manifest item by its `to` path (dollar-param form). */
export function findManifestItem(
  manifest: { items: MenuItemManifest[] }[],
  to: string,
): MenuItemManifest | null {
  for (const g of manifest) {
    for (const it of g.items) if (it.to === to) return it;
  }
  return null;
}
