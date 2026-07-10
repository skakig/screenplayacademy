import { useSyncExternalStore } from "react";
import type { CreditFeature } from "@/lib/creditPacks";
import { upsellFeatureFor } from "@/lib/creditPacks";

interface State {
  open: boolean;
  focus: CreditFeature | null;
}

let state: State = { open: false, focus: null };
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function getSnapshot() {
  return state;
}
function set(next: State) {
  state = next;
  listeners.forEach((l) => l());
}

export function openCreditsDialog(focus: CreditFeature | null = null) {
  set({ open: true, focus });
}
export function closeCreditsDialog() {
  set({ open: false, focus: state.focus });
}

/**
 * Parse a `USAGE_LIMIT: <feature> …` server error. If the feature is one
 * that credits can resolve, open the buy dialog focused on the right tab.
 * Returns true when the upsell was surfaced (so callers can suppress the
 * generic error toast in that case).
 */
export function offerCreditsFromError(message: string): boolean {
  const match = /USAGE_LIMIT:\s*(\w+)/i.exec(message ?? "");
  if (!match) return false;
  const feature = upsellFeatureFor(match[1]);
  if (!feature) return false;
  set({ open: true, focus: feature });
  return true;
}

export function useCreditsUpsell() {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return {
    open: snap.open,
    focus: snap.focus,
    openDialog: openCreditsDialog,
    closeDialog: closeCreditsDialog,
    offerFromError: offerCreditsFromError,
  };
}
