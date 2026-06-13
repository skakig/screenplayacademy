/**
 * Tiny env-driven feature flag layer.
 *
 * Reads VITE_* env vars so flags are baked at build time and never reach the
 * server bundle. Off by default. No UI exposure.
 *
 * Pass 7 introduces `collaboration_live_scene_editing_enabled` — strictly
 * experimental, must remain false in production.
 */

const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);

const RAW: Record<string, string | undefined> = {
  collaboration_live_scene_editing_enabled:
    (import.meta.env.VITE_COLLAB_LIVE_SCENE_EDITING as string | undefined) ??
    undefined,
};

export type FeatureFlagName = keyof typeof RAW;

export function isFeatureEnabled(name: FeatureFlagName): boolean {
  const v = RAW[name];
  if (!v) return false;
  return TRUE_VALUES.has(v.trim().toLowerCase());
}

export function isLiveSceneCollabEnabled(): boolean {
  return isFeatureEnabled("collaboration_live_scene_editing_enabled");
}
