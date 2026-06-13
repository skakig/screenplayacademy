import { useCallback, useState } from "react";
import type { HeldRemoteChange } from "./types";

/**
 * Tiny in-memory conflict queue scoped to the active live session.
 * Not persisted — discarded on session end / unmount.
 */
export function useConflictQueue() {
  const [items, setItems] = useState<HeldRemoteChange[]>([]);

  const push = useCallback((c: HeldRemoteChange) => {
    setItems((prev) => {
      // De-dup by script_block_id + reason so a flurry of remote updates
      // for the same block doesn't pile up.
      const key = `${c.scriptBlockId ?? c.localBlockId ?? ""}:${c.reason}`;
      const filtered = prev.filter(
        (p) => `${p.scriptBlockId ?? p.localBlockId ?? ""}:${p.reason}` !== key,
      );
      return [...filtered, c];
    });
  }, []);

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  return { items, push, dismiss, clear };
}
