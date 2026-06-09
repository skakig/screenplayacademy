import { useCallback, useEffect, useRef } from "react";

/**
 * Keeps the active screenplay line inside a comfortable "focus zone" of the
 * editor scroll container — see docs/EDITOR_FOCUS_AND_VIEWPORT.md.
 *
 * - Pure visual scroll: never touches focus, selection, or the DOM beyond
 *   the container's scrollTop.
 * - Respects manual user scrolling (suspends auto-follow for ~1500ms).
 * - Respects `prefers-reduced-motion`.
 * - Mobile: uses visualViewport to keep the active line above the keyboard.
 */

export type ActiveLineViewportMode = "normal" | "focus" | "review";

type Options = {
  containerRef: React.RefObject<HTMLElement | null>;
  /** Resolver returning the current active line element (called lazily). */
  getActiveLineEl: () => HTMLElement | null;
  mode?: ActiveLineViewportMode;
  isMobile?: boolean;
};

const MANUAL_SCROLL_SUSPEND_MS = 1500;

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function useActiveLineViewport({
  containerRef,
  getActiveLineEl,
  mode = "normal",
  isMobile = false,
}: Options) {
  const manualUntilRef = useRef<number>(0);
  const programmaticScrollRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const keyboardInsetRef = useRef<number>(0);

  // Track manual scroll intent on the container.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const markManual = () => {
      manualUntilRef.current = Date.now() + MANUAL_SCROLL_SUSPEND_MS;
    };
    const onScroll = () => {
      if (programmaticScrollRef.current) return;
      manualUntilRef.current = Date.now() + MANUAL_SCROLL_SUSPEND_MS;
    };

    el.addEventListener("wheel", markManual, { passive: true });
    el.addEventListener("touchmove", markManual, { passive: true });
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("wheel", markManual);
      el.removeEventListener("touchmove", markManual);
      el.removeEventListener("scroll", onScroll);
    };
  }, [containerRef]);

  // Track mobile keyboard inset via visualViewport.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      // Difference between layout viewport height and visual viewport height
      // ≈ keyboard height when keyboard is open.
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      keyboardInsetRef.current = inset;
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  const scrollNow = useCallback(
    (opts?: { smooth?: boolean; force?: boolean }) => {
      const container = containerRef.current;
      const line = getActiveLineEl();
      if (!container || !line) return;
      if (!opts?.force && manualUntilRef.current > Date.now()) return;

      const cRect = container.getBoundingClientRect();
      const lRect = line.getBoundingClientRect();
      const usableHeight =
        Math.max(120, cRect.height - keyboardInsetRef.current);

      // Target band: 48% from top on desktop, ~30% on mobile (above keyboard).
      const ratio =
        mode === "focus" ? 0.42 : isMobile ? 0.3 : 0.48;
      const targetY = cRect.top + usableHeight * ratio;

      const delta = lRect.top - targetY;
      if (Math.abs(delta) < 8) return;

      const behavior: ScrollBehavior =
        prefersReducedMotion() || !opts?.smooth ? "auto" : "smooth";

      programmaticScrollRef.current = true;
      container.scrollBy({ top: delta, behavior });
      // Clear the programmatic flag after the scroll settles.
      window.setTimeout(() => {
        programmaticScrollRef.current = false;
      }, behavior === "smooth" ? 450 : 50);
    },
    [containerRef, getActiveLineEl, isMobile, mode],
  );

  const scheduleScroll = useCallback(
    (_reason: "enter" | "jump" | "wrap" | "focus", opts?: { force?: boolean }) => {
      if (rafRef.current != null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        // Two RAFs to let the new block mount + measure.
        requestAnimationFrame(() => scrollNow({ smooth: true, force: opts?.force }));
      });
    },
    [scrollNow],
  );

  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return { scheduleScroll, scrollNow };
}
