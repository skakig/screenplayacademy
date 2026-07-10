/**
 * Double-gated feature flag layer.
 *
 * Each experimental feature has two gates:
 *   available = build-time env gate (VITE_*)
 *   enabled   = available && per-browser localStorage switch
 *
 * Both gates default OFF.
 */
import { useEffect, useState } from "react";

const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);

const RAW: Record<string, string | undefined> = {
  collaboration_live_scene_editing_enabled:
    (import.meta.env.VITE_COLLAB_LIVE_SCENE_EDITING as string | undefined) ??
    undefined,
  collaboration_arena_mode_enabled:
    (import.meta.env.VITE_COLLAB_ARENA_MODE as string | undefined) ?? undefined,
};

export type FeatureFlagName = keyof typeof RAW;

export const LIVE_COLLAB_LS_KEY = "scenesmith.experimental.liveCollab.enabled";
export const ARENA_LS_KEY = "scenesmith.experimental.arena.enabled";

const FLAGS_CHANGED_EVENT = "scenesmith:experimental-flags-changed";

export function isFeatureEnabled(name: FeatureFlagName): boolean {
  const v = RAW[name];
  if (!v) return false;
  return TRUE_VALUES.has(v.trim().toLowerCase());
}

// ----- Live Collab Lab -----------------------------------------------------
export function isLiveSceneCollabAvailable(): boolean {
  return isFeatureEnabled("collaboration_live_scene_editing_enabled");
}
export function isLiveSceneCollabUserEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(LIVE_COLLAB_LS_KEY) === "1";
  } catch {
    return false;
  }
}
export function setLiveSceneCollabUserEnabled(enabled: boolean): void {
  writeSwitch(LIVE_COLLAB_LS_KEY, enabled);
}
export function isLiveSceneCollabEnabled(): boolean {
  return isLiveSceneCollabAvailable() && isLiveSceneCollabUserEnabled();
}
export function useLiveSceneCollabEnabled(): boolean {
  return useReactiveGate(LIVE_COLLAB_LS_KEY, isLiveSceneCollabEnabled);
}

// ----- Arena Mode ----------------------------------------------------------
export function isArenaAvailable(): boolean {
  return isFeatureEnabled("collaboration_arena_mode_enabled");
}
export function isArenaUserEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(ARENA_LS_KEY) === "1";
  } catch {
    return false;
  }
}
export function setArenaUserEnabled(enabled: boolean): void {
  writeSwitch(ARENA_LS_KEY, enabled);
}
export function isArenaEnabled(): boolean {
  return isArenaAvailable() && isArenaUserEnabled();
}
export function useArenaEnabled(): boolean {
  return useReactiveGate(ARENA_LS_KEY, isArenaEnabled);
}

// ----- Internals -----------------------------------------------------------
function writeSwitch(key: string, enabled: boolean) {
  if (typeof window === "undefined") return;
  try {
    if (enabled) window.localStorage.setItem(key, "1");
    else window.localStorage.removeItem(key);
  } catch {
    /* no-op */
  }
  try {
    window.dispatchEvent(new CustomEvent(FLAGS_CHANGED_EVENT));
  } catch {
    /* no-op */
  }
}

function useReactiveGate(key: string, read: () => boolean): boolean {
  const [enabled, setEnabled] = useState<boolean>(() => read());
  useEffect(() => {
    if (typeof window === "undefined") return;
    const refresh = () => setEnabled(read());
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === key) refresh();
    };
    window.addEventListener(FLAGS_CHANGED_EVENT, refresh);
    window.addEventListener("storage", onStorage);
    refresh();
    return () => {
      window.removeEventListener(FLAGS_CHANGED_EVENT, refresh);
      window.removeEventListener("storage", onStorage);
    };
  }, [key, read]);
  return enabled;
}
