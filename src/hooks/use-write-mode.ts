import { useEffect, useState, useCallback } from "react";

const KEY = "lovable.editor.writeMode.v1";

/**
 * Local "Write Mode" toggle. Stored in localStorage so it persists across
 * reloads but doesn't need a DB column. When on, the editor hides side
 * panes and shows only the manuscript page.
 */
export function useWriteMode() {
  const [on, setOn] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      setOn(localStorage.getItem(KEY) === "1");
    } catch { /* ignore */ }
  }, []);

  const toggle = useCallback(() => {
    setOn((v) => {
      const next = !v;
      try { localStorage.setItem(KEY, next ? "1" : "0"); } catch { /* ignore */ }
      return next;
    });
  }, []);

  return { on, toggle };
}
