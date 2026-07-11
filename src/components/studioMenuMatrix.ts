/**
 * Route-matrix regeneration engine.
 *
 * Given the pure `MENU_MANIFEST`, computes every (item × tier × project ×
 * billing) permutation and derives the effective states rendered by the
 * Studio Menu at runtime:
 *
 *   - `hidden`   — filtered out (e.g. guidedOnly for non-guided writers)
 *   - `locked`   — tier lock (`feature` requires a higher plan)
 *   - `beta`     — experimental / feature-flagged surface
 *   - `setup`    — external integration missing (billing, etc.)
 *   - `pickProject` — needs a project but none is selected
 *   - `needsData`   — project selected but likely missing prerequisite data
 *   - `blockedBy`   — first friction reason a real user would hit
 *
 * The generator (`scripts/generate-route-matrix.ts`) and the freshness test
 * (`StudioMenu.matrix.test.ts`) both call `buildRouteMatrix()` so a single
 * source of truth drives docs and CI.
 */

import {
  FEATURE_MIN_TIER,
  TIER_LABEL,
  TIER_RANK,
  type Feature,
  type Tier,
} from "@/lib/entitlements";
import type { MenuGroupManifest, MenuItemManifest } from "./studioMenuManifest";

export const ALL_TIERS: Tier[] = ["free", "creator", "pro", "studio"];

export type ProjectScenario =
  | "no_project"
  | "empty_project"
  | "has_scenes"
  | "has_scenes_and_characters"
  | "populated";

export const ALL_PROJECT_SCENARIOS: ProjectScenario[] = [
  "no_project",
  "empty_project",
  "has_scenes",
  "has_scenes_and_characters",
  "populated",
];

export type BlockedBy =
  | "none"
  | "tier"
  | "setup"
  | "pick_project"
  | "needs_data";

export type MatrixEntry = {
  group: string;
  label: string;
  to: string;
  tier: Tier;
  scenario: ProjectScenario;
  stripeReady: boolean;
  isGuided: boolean;
  hidden: boolean;
  locked: boolean;
  requiredTier: Tier | null;
  experimental: boolean;
  setupRequired: boolean;
  missingProject: boolean;
  needsData: MenuItemManifest["needsData"] | null;
  blockedBy: BlockedBy;
  badgeOrder: string[];
};

function hasFeatureTier(tier: Tier, feature: Feature | undefined): boolean {
  if (!feature) return true;
  return TIER_RANK[tier] >= TIER_RANK[FEATURE_MIN_TIER[feature]];
}

function scenarioHasData(
  scenario: ProjectScenario,
  need: MenuItemManifest["needsData"] | undefined,
): boolean {
  if (!need) return true;
  if (scenario === "no_project" || scenario === "empty_project") return false;
  if (scenario === "populated") return true;
  if (need === "scenes") return scenario === "has_scenes" || scenario === "has_scenes_and_characters";
  if (need === "characters") return scenario === "has_scenes_and_characters";
  if (need === "script") return false; // only "populated" is treated as having script blocks
  return false;
}

export function computeEntry(opts: {
  group: string;
  item: MenuItemManifest;
  tier: Tier;
  scenario: ProjectScenario;
  stripeReady: boolean;
  isGuided: boolean;
}): MatrixEntry {
  const { group, item, tier, scenario, stripeReady, isGuided } = opts;

  const hidden = Boolean(item.guidedOnly && !isGuided);
  const missingProject = Boolean(item.needsProject && scenario === "no_project");
  const locked = !hasFeatureTier(tier, item.feature);
  const requiredTier = item.feature ? FEATURE_MIN_TIER[item.feature] : null;
  const experimental = Boolean(item.experimental);
  const setupRequired = item.setupRequires === "billing" && !stripeReady;
  const needsDataNow =
    !missingProject && item.needsData && !scenarioHasData(scenario, item.needsData)
      ? item.needsData
      : null;

  // Same rendering order the StateBadges component uses.
  const badgeOrder: string[] = [];
  if (locked && requiredTier) badgeOrder.push(`Locked → ${TIER_LABEL[requiredTier]}`);
  if (experimental) badgeOrder.push("Beta");
  if (setupRequired) badgeOrder.push("Setup");
  if (missingProject) badgeOrder.push("Pick a project");
  if (needsDataNow) badgeOrder.push(`Needs ${needsDataNow}`);

  // Same precedence a user's click would encounter.
  const blockedBy: BlockedBy = locked
    ? "tier"
    : setupRequired
      ? "setup"
      : missingProject
        ? "pick_project"
        : needsDataNow
          ? "needs_data"
          : "none";

  return {
    group,
    label: item.label,
    to: item.to,
    tier,
    scenario,
    stripeReady,
    isGuided,
    hidden,
    locked,
    requiredTier,
    experimental,
    setupRequired,
    missingProject,
    needsData: needsDataNow,
    blockedBy,
    badgeOrder,
  };
}

export type BuildOptions = {
  tiers?: Tier[];
  scenarios?: ProjectScenario[];
  stripeStates?: boolean[];
  guidedStates?: boolean[];
};

export function buildRouteMatrix(
  manifest: MenuGroupManifest[],
  opts: BuildOptions = {},
): MatrixEntry[] {
  const tiers = opts.tiers ?? ALL_TIERS;
  const scenarios = opts.scenarios ?? ALL_PROJECT_SCENARIOS;
  const stripeStates = opts.stripeStates ?? [true, false];
  const guidedStates = opts.guidedStates ?? [true, false];

  const out: MatrixEntry[] = [];
  for (const group of manifest) {
    for (const item of group.items) {
      for (const tier of tiers) {
        for (const scenario of scenarios) {
          for (const stripeReady of stripeStates) {
            for (const isGuided of guidedStates) {
              out.push(
                computeEntry({
                  group: group.key,
                  item,
                  tier,
                  scenario,
                  stripeReady,
                  isGuided,
                }),
              );
            }
          }
        }
      }
    }
  }
  return out;
}

/** Per-item roll-up: which scenarios/tiers actually surface friction. */
export type ItemSummary = {
  group: string;
  label: string;
  to: string;
  feature: Feature | null;
  requiredTier: Tier | null;
  experimental: boolean;
  setupRequires: "billing" | null;
  needsData: MenuItemManifest["needsData"] | null;
  guidedOnly: boolean;
  needsProject: boolean;
  lockedTiers: Tier[];
  blockingScenarios: ProjectScenario[];
};

export function summarize(manifest: MenuGroupManifest[]): ItemSummary[] {
  const out: ItemSummary[] = [];
  for (const group of manifest) {
    for (const item of group.items) {
      const lockedTiers = ALL_TIERS.filter((t) => !hasFeatureTier(t, item.feature));
      const blockingScenarios: ProjectScenario[] = [];
      for (const scenario of ALL_PROJECT_SCENARIOS) {
        const entry = computeEntry({
          group: group.key,
          item,
          tier: "studio",
          scenario,
          stripeReady: true,
          isGuided: true,
        });
        if (entry.blockedBy === "pick_project" || entry.blockedBy === "needs_data") {
          blockingScenarios.push(scenario);
        }
      }
      out.push({
        group: group.key,
        label: item.label,
        to: item.to,
        feature: item.feature ?? null,
        requiredTier: item.feature ? FEATURE_MIN_TIER[item.feature] : null,
        experimental: Boolean(item.experimental),
        setupRequires: item.setupRequires ?? null,
        needsData: item.needsData ?? null,
        guidedOnly: Boolean(item.guidedOnly),
        needsProject: Boolean(item.needsProject),
        lockedTiers,
        blockingScenarios,
      });
    }
  }
  return out;
}

export function renderMatrixMarkdown(manifest: MenuGroupManifest[]): string {
  const summary = summarize(manifest);
  const lines: string[] = [];
  lines.push("# Route Matrix (generated)");
  lines.push("");
  lines.push("> Auto-generated by `bun run route-matrix`. Do not edit by hand.");
  lines.push("> Source of truth: `src/components/studioMenuManifest.ts`.");
  lines.push("> The freshness test `StudioMenu.matrix.test.ts` will fail if this file drifts.");
  lines.push("");
  lines.push("Legend: **Locked tiers** = plans where the item is tier-gated. **Blocking scenarios** = project states where the item still shows friction (pick-a-project or needs-data) even on the highest plan.");
  lines.push("");

  const byGroup = new Map<string, ItemSummary[]>();
  for (const s of summary) {
    const arr = byGroup.get(s.group) ?? [];
    arr.push(s);
    byGroup.set(s.group, arr);
  }

  for (const group of manifest) {
    const items = byGroup.get(group.key) ?? [];
    if (items.length === 0) continue;
    lines.push(`## ${group.label}`);
    lines.push("");
    lines.push("| Route | Feature | Tier gate | Beta | Setup | Needs data | Guided-only | Locked tiers | Blocking scenarios |");
    lines.push("| --- | --- | --- | --- | --- | --- | --- | --- | --- |");
    for (const s of items) {
      lines.push(
        `| \`${s.to}\` (${s.label}) | ${s.feature ?? "—"} | ${s.requiredTier ? TIER_LABEL[s.requiredTier] : "—"} | ${s.experimental ? "Yes" : "—"} | ${s.setupRequires ?? "—"} | ${s.needsData ?? "—"} | ${s.guidedOnly ? "Yes" : "—"} | ${s.lockedTiers.length ? s.lockedTiers.join(", ") : "—"} | ${s.blockingScenarios.length ? s.blockingScenarios.join(", ") : "—"} |`,
      );
    }
    lines.push("");
  }

  const matrix = buildRouteMatrix(manifest);
  const total = matrix.length;
  const blocked = matrix.filter((e) => e.blockedBy !== "none" && !e.hidden).length;
  const hidden = matrix.filter((e) => e.hidden).length;
  lines.push("## Coverage");
  lines.push("");
  lines.push(`- Permutations audited: **${total}**`);
  lines.push(`- Friction-bearing permutations: **${blocked}**`);
  lines.push(`- Hidden permutations (guided-only filter): **${hidden}**`);
  lines.push("");
  return lines.join("\n");
}
