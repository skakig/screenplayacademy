import { useCallback, useEffect, useRef } from "react";

/**
 * Keeps the active screenplay line inside a comfortable "focus zone" of the
 * editor scroll container — see docs/EDITOR_FOCUS_AND_VIEWPORT.md.
 *
 * Smooth, professional auto-follow:
 * - Custom rAF easing (easeOutCubic) so repeated triggers re-target the
 *   same in-flight animation instead of stacking native smooth scrolls
 *   (which is the root cause of "jumpy" behavior).
 * - Pure visual scroll: never touches focus, selection, or the DOM beyond
 *   the container's scrollTop.
 * - Respects manual user scrolling (suspends auto-follow ~1500ms).
 * - Respects `prefers-reduced-motion`.
 * - Mobile: uses visualViewport to keep the active line above the keyboard.
 * - Tracks active-line height via ResizeObserver so wrapping doesn't drift.
 */

export type ActiveLineViewportMode = "normal" | "focus" | "review";

type Options = {
  containerRef: React.RefObject<HTMLElement | null>;
  getActiveLineEl: () => HTMLElement | null;
  mode?: ActiveLineViewportMode;
  isMobile?: boolean;
};

const MANUAL_SCROLL_SUSPEND_MS = 1200;
const DEAD_ZONE_PX = 6;
const MIN_DURATION_MS = 180;
const MAX_DURATION_MS = 520;
// Speed: roughly how many pixels per ms we want to cover.
const PX_PER_MS = 2.4;

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Cubic ease-out — fast start, soft landing. Feels "pro".
function easeOutCubic(t: number): number {
  const x = 1 - t;
  return 1 - x * x * x;
}

export function useActiveLineViewport({
  containerRef,
  getActiveLineEl,
  mode = "normal",
  isMobile = false,
}: Options) {
  const manualUntilRef = useRef<number>(0);
  const programmaticScrollRef = useRef(false);
  const keyboardInsetRef = useRef<number>(0);

  // Animation state
  const rafRef = useRef<number | null>(null);
  const animStartRef = useRef<number>(0);
  const animFromRef = useRef<number>(0);
  const animToRef = useRef<number>(0);
  const animDurRef = useRef<number>(0);

  const scheduledRef = useRef<number | null>(null);
  const resizeObsRef = useRef<ResizeObserver | null>(null);
  const observedElRef = useRef<HTMLElement | null>(null);

  // Track manual scroll intent on the container.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const markManual = () => {
      manualUntilRef.current = Date.now() + MANUAL_SCROLL_SUSPEND_MS;
      // Cancel any in-flight programmatic animation so the user wins.
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
    const onScroll = () => {
      if (programmaticScrollRef.current) return;
      manualUntilRef.current = Date.now() + MANUAL_SCROLL_SUSPEND_MS;
    };

    el.addEventListener("wheel", markManual, { passive: true });
    el.addEventListener("touchmove", markManual, { passive: true });
    el.addEventListener("pointerdown", markManual, { passive: true });
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("wheel", markManual);
      el.removeEventListener("touchmove", markManual);
      el.removeEventListener("pointerdown", markManual);
      el.removeEventListener("scroll", onScroll);
    };
  }, [containerRef]);

  // Track mobile keyboard inset via visualViewport.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
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

  const computeTargetScrollTop = useCallback((): number | null => {
    const container = containerRef.current;
    const line = getActiveLineEl();
    if (!container || !line) return null;

    const cRect = container.getBoundingClientRect();
    const lRect = line.getBoundingClientRect();
    const usableHeight = Math.max(120, cRect.height - keyboardInsetRef.current);

    const ratio = mode === "focus" ? 0.42 : isMobile ? 0.3 : 0.48;
    const targetViewportY = cRect.top + usableHeight * ratio;

    // Current line top relative to container's scroll origin:
    const lineOffsetInContainer =
      lRect.top - cRect.top + container.scrollTop;
    const desiredScrollTop = lineOffsetInContainer - usableHeight * ratio;

    // Clamp into scrollable range.
    const max = container.scrollHeight - container.clientHeight;
    const clamped = Math.max(0, Math.min(max, desiredScrollTop));

    // Dead-zone check: skip if line is already close enough to focus band.
    const currentDelta = lRect.top - targetViewportY;
    if (Math.abs(currentDelta) < DEAD_ZONE_PX) return null;

    return clamped;
  }, [containerRef, getActiveLineEl, isMobile, mode]);

  const animateTo = useCallback(
    (target: number, opts?: { instant?: boolean }) => {
      const container = containerRef.current;
      if (!container) return;

      const from = container.scrollTop;
      const distance = target - from;
      if (Math.abs(distance) < 1) return;

      // Instant path: reduced-motion or explicit.
      if (opts?.instant || prefersReducedMotion()) {
        programmaticScrollRef.current = true;
        container.scrollTop = target;
        requestAnimationFrame(() => {
          programmaticScrollRef.current = false;
        });
        return;
      }

      // If an animation is already running, just re-target — don't stack.
      const now = performance.now();
      const duration = Math.max(
        MIN_DURATION_MS,
        Math.min(MAX_DURATION_MS, Math.abs(distance) / PX_PER_MS),
      );

      animFromRef.current = from;
      animToRef.current = target;
      animStartRef.current = now;
      animDurRef.current = duration;

      if (rafRef.current != null) return; // existing loop will pick up new target

      const step = (ts: number) => {
        const c = containerRef.current;
        if (!c) {
          rafRef.current = null;
          return;
        }
        const elapsed = ts - animStartRef.current;
        const t = Math.min(1, elapsed / animDurRef.current);
        const eased = easeOutCubic(t);
        const next =
          animFromRef.current +
          (animToRef.current - animFromRef.current) * eased;

        programmaticScrollRef.current = true;
        c.scrollTop = next;
        // Reset programmatic flag right after the scroll event fires.
        queueMicrotask(() => {
          programmaticScrollRef.current = false;
        });

        if (t < 1) {
          rafRef.current = requestAnimationFrame(step);
        } else {
          rafRef.current = null;
        }
      };

      rafRef.current = requestAnimationFrame(step);
    },
    [containerRef],
  );

  const runScroll = useCallback(
    (opts?: { force?: boolean; instant?: boolean }) => {
      if (!opts?.force && manualUntilRef.current > Date.now()) return;
      const target = computeTargetScrollTop();
      if (target == null) return;

      // Re-target animation toward new measurement; this handles the case
      // where new DOM mounted between rAFs and changed the layout.
      animateTo(target, { instant: opts?.instant });
    },
    [animateTo, computeTargetScrollTop],
  );

  const scheduleScroll = useCallback(
    (_reason: "enter" | "jump" | "wrap" | "focus", opts?: { force?: boolean; instant?: boolean }) => {
      if (scheduledRef.current != null) {
        cancelAnimationFrame(scheduledRef.current);
      }
      // Two RAFs to let new block mount + layout settle before measuring.
      scheduledRef.current = requestAnimationFrame(() => {
        scheduledRef.current = requestAnimationFrame(() => {
          scheduledRef.current = null;
          runScroll(opts);
        });
      });
    },
    [runScroll],
  );

  // Observe the active line's size so wrapping growth gently re-centers
  // without re-firing on every keystroke.
  useEffect(() => {
    if (typeof ResizeObserver === "undefined") return;
    let raf: number | null = null;
    const obs = new ResizeObserver(() => {
      if (raf != null) return;
      raf = requestAnimationFrame(() => {
        raf = null;
        // Gentle correction — respects manual-scroll suspension.
        runScroll();
      });
    });
    resizeObsRef.current = obs;

    let pollRaf = 0;
    const poll = () => {
      const el = getActiveLineEl();
      if (el !== observedElRef.current) {
        if (observedElRef.current) obs.unobserve(observedElRef.current);
        if (el) obs.observe(el);
        observedElRef.current = el;
      }
      pollRaf = requestAnimationFrame(poll);
    };
    pollRaf = requestAnimationFrame(poll);

    return () => {
      cancelAnimationFrame(pollRaf);
      if (raf != null) cancelAnimationFrame(raf);
      obs.disconnect();
      resizeObsRef.current = null;
      observedElRef.current = null;
    };
  }, [getActiveLineEl, runScroll]);

  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      if (scheduledRef.current != null) cancelAnimationFrame(scheduledRef.current);
    };
  }, []);

  return { scheduleScroll, runScroll };
}
