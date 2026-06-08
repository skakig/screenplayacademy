import { useCallback, useEffect, useState } from "react";

const KEY = "lovable.editor.tourCompleted.v1";

export function useEditorTour() {
  const [isOpen, setIsOpen] = useState(false);
  const [hasSeen, setHasSeen] = useState(true); // assume seen during SSR

  useEffect(() => {
    if (typeof window === "undefined") return;
    const seen = window.localStorage.getItem(KEY) === "1";
    setHasSeen(seen);
    // Do NOT auto-open the tour. It used to pop up on first visit and
    // covered the page, blocking the user from actually writing. Users can
    // start the tour from the "Replay tour" button in the editor header.
  }, []);

  const stop = useCallback(() => {
    setIsOpen(false);
    if (typeof window !== "undefined") window.localStorage.setItem(KEY, "1");
    setHasSeen(true);
  }, []);

  const start = useCallback(() => {
    if (typeof window !== "undefined") window.localStorage.removeItem(KEY);
    setHasSeen(false);
    setIsOpen(true);
  }, []);

  return { isOpen, hasSeen, start, stop };
}
