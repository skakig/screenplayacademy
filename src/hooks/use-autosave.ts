import { useCallback, useEffect, useRef, useState } from "react";

export type AutosaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

function diff(local: any, remote: any, ignore: Set<string>): Record<string, any> {
  const patch: Record<string, any> = {};
  if (!local) return patch;
  for (const k of Object.keys(local)) {
    if (ignore.has(k)) continue;
    const lv = local[k];
    const rv = remote ? remote[k] : undefined;
    if (lv === rv) continue;
    // treat null/undefined/'' as equal
    if ((lv ?? "") === (rv ?? "")) continue;
    if (typeof lv === "object" && typeof rv === "object" && JSON.stringify(lv) === JSON.stringify(rv)) continue;
    patch[k] = lv;
  }
  return patch;
}

export function useAutosave<T extends Record<string, any>>({
  local,
  remote,
  onSave,
  delay = 800,
  ignoreKeys = [],
  enabled = true,
}: {
  local: T | null | undefined;
  remote: T | null | undefined;
  onSave: (patch: Partial<T>) => Promise<any>;
  delay?: number;
  ignoreKeys?: string[];
  enabled?: boolean;
}) {
  const ignore = useRef(new Set(["id", "created_at", "updated_at", "project_id", "character_id", ...ignoreKeys]));
  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPatch = useRef<Record<string, any>>({});
  const inFlight = useRef(false);
  const onSaveRef = useRef(onSave);
  useEffect(() => { onSaveRef.current = onSave; }, [onSave]);

  const performSave = useCallback(async () => {
    const patch = pendingPatch.current;
    if (!Object.keys(patch).length || inFlight.current) return;
    inFlight.current = true;
    setStatus("saving");
    try {
      await onSaveRef.current(patch as any);
      pendingPatch.current = {};
      setStatus("saved");
      setLastSavedAt(Date.now());
    } catch {
      setStatus("error");
    } finally {
      inFlight.current = false;
    }
  }, []);

  const flush = useCallback(async () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    await performSave();
  }, [performSave]);

  useEffect(() => {
    if (!enabled || !local) return;
    const patch = diff(local, remote, ignore.current);
    if (!Object.keys(patch).length) return;
    pendingPatch.current = { ...pendingPatch.current, ...patch };
    setStatus("dirty");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void performSave(); }, delay);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [local, remote, enabled, delay, performSave]);

  // Flush on unmount
  useEffect(() => () => { void performSave(); }, [performSave]);

  return { status, lastSavedAt, flush, saveNow: performSave };
}
