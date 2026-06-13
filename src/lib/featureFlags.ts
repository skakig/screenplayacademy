/**
 * Double-gated feature flag layer.
 *
 * Pass 7 introduced `collaboration_live_scene_editing_enabled` as a
 * build-time env gate (`VITE_COLLAB_LIVE_SCENE_EDITING`). Pass 8 adds a
 * per-browser user gate stored in localStorage so we can toggle the Live
 * Collaboration Lab on/off from inside the app for testing without ever
 * enabling it in production by accident.
 *
 *   liveLabAvailable = env gate true
 *   liveLabEnabled   = liveLabAvailable && local user switch true
 *
 * Both gates default OFF.
 */
import { useEffect, useState } from "react";

const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);

const RAW: Record<string, string | undefined> = {
  collaboration_live_scene_editing_enabled:
    (import.meta.env.VITE_COLLAB_LIVE_SCENE_EDITING as string | undefined) ??
    undefined,
};

export type FeatureFlagName = keyof typeof RAW;

export const LIVE_COLLAB_LS_KEY =
  "scenesmith.experimental.liveCollab.enabled";

const FLAGS_CHANGED_EVENT = "scenesmith:experimental-flags-changed";

export function isFeatureEnabled(name: FeatureFlagName): boolean {
  const v = RAW[name];
  if (!v) return false;
  return TRUE_VALUES.has(v.trim().toLowerCase());
}

/** Build-time env gate. Stable across the session. */
export function isLiveSceneCollabAvailable(): boolean {
  return isFeatureEnabled("collaboration_live_scene_editing_enabled");
}

/** Per-browser user gate. False during SSR. */
export function isLiveSceneCollabUserEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(LIVE_COLLAB_LS_KEY) === "1";
  } catch {
    return false;
  }
}

export function setLiveSceneCollabUserEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (enabled) window.localStorage.setItem(LIVE_COLLAB_LS_KEY, "1");
    else window.localStorage.removeItem(LIVE_COLLAB_LS_KEY);
  } catch {
    /* localStorage unavailable — silently no-op. */
  }
  try {
    window.dispatchEvent(new CustomEvent(FLAGS_CHANGED_EVENT));
  } catch {
    /* CustomEvent unsupported — listeners just won't refresh. */
  }
}

/** Effective gate. Both must be true. */
export function isLiveSceneCollabEnabled(): boolean {
  return isLiveSceneCollabAvailable() && isLiveSceneCollabUserEnabled();
}

/**
 * React hook returning the live, reactive value of the effective gate.
 * Re-renders when the local switch flips in this tab or any other tab.
 */
export function useLiveSceneCollabEnabled(): boolean {
  const [enabled, setEnabled] = useState<boolean>(() =>
    isLiveSceneCollabEnabled(),
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const refresh = () => setEnabled(isLiveSceneCollabEnabled());
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === LIVE_COLLAB_LS_KEY) refresh();
    };
    window.addEventListener(FLAGS_CHANGED_EVENT, refresh);
    window.addEventListener("storage", onStorage);
    // Re-read once on mount in case the value changed between SSR & hydration.
    refresh();
    return () => {
      window.removeEventListener(FLAGS_CHANGED_EVENT, refresh);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return enabled;
}
