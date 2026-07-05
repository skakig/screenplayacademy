import { useEffect, useState, useCallback } from "react";

const KEY = "lovable.editor.writeMode.v1";

// Module-level shared store so every consumer of useWriteMode observes the
// same Focus state and can flip it (Focus pill, Esc handler, first-run modal,
// mode toggle). Backed by localStorage — no schema needed.
let focusOn = false;
const listeners = new Set<(v: boolean) => void>();

function readInitial(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

let hydrated = false;
function ensureHydrated() {
  if (hydrated) return;
  hydrated = true;
  focusOn = readInitial();
}

function setFocus(next: boolean) {
  ensureHydrated();
  if (focusOn === next) return;
  focusOn = next;
  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(KEY, next ? "1" : "0");
    }
  } catch {
    /* ignore */
  }
  for (const l of listeners) l(next);
}

/**
 * Shared local Focus Mode toggle. Persists in localStorage. All components
 * that call this hook read/write the same state — enabling the Focus pill,
 * Esc handler and mode toggle to agree.
 */
export function useWriteMode() {
  ensureHydrated();
  const [on, setOn] = useState(focusOn);

  useEffect(() => {
    listeners.add(setOn);
    // Sync in case hydration happened after render.
    setOn(focusOn);
    return () => {
      listeners.delete(setOn);
    };
  }, []);

  const toggle = useCallback(() => setFocus(!focusOn), []);
  const set = useCallback((v: boolean) => setFocus(v), []);

  return { on, toggle, set };
}
