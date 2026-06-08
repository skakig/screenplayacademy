import { useEffect, useLayoutEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { X, ArrowLeft, ArrowRight } from "lucide-react";
import { EDITOR_TOUR_STEPS, type TourStep } from "@/lib/editor/tourSteps";

type Rect = { top: number; left: number; width: number; height: number };

const PAD = 8;
const CARD_W = 320;
const GAP = 14;

function getRect(selector?: string): Rect | null {
  if (!selector || typeof document === "undefined") return null;
  const el = document.querySelector(selector) as HTMLElement | null;
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 4 || r.height < 4) return null;
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

function computeCardPos(rect: Rect | null, placement: TourStep["placement"]) {
  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  if (!rect || placement === "center") {
    return { top: Math.max(40, vh / 2 - 120), left: Math.max(16, vw / 2 - CARD_W / 2) };
  }
  let top = rect.top + rect.height + GAP;
  let left = rect.left;
  if (placement === "top") {
    top = rect.top - GAP - 220;
    left = rect.left;
  } else if (placement === "left") {
    top = rect.top;
    left = rect.left - CARD_W - GAP;
  } else if (placement === "right") {
    top = rect.top;
    left = rect.left + rect.width + GAP;
  }
  // clamp
  left = Math.max(12, Math.min(left, vw - CARD_W - 12));
  top = Math.max(12, Math.min(top, vh - 240));
  return { top, left };
}

export function EditorTour({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [idx, setIdx] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [, setTick] = useState(0);

  const step = EDITOR_TOUR_STEPS[idx];

  const measure = useCallback(() => {
    setRect(getRect(step?.targetSelector));
    setTick((t) => t + 1);
  }, [step?.targetSelector]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    measure();
    // retry once after layout in case target mounts late
    const t = setTimeout(measure, 120);
    return () => clearTimeout(t);
  }, [isOpen, idx, measure]);

  useEffect(() => {
    if (!isOpen) return;
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [isOpen, measure]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") setIdx((i) => Math.min(i + 1, EDITOR_TOUR_STEPS.length - 1));
      else if (e.key === "ArrowLeft") setIdx((i) => Math.max(i - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) setIdx(0);
  }, [isOpen]);

  if (!isOpen || typeof document === "undefined") return null;

  const total = EDITOR_TOUR_STEPS.length;
  const isLast = idx === total - 1;
  const isFirst = idx === 0;
  const pct = Math.round(((idx + 1) / total) * 100);
  const cardPos = computeCardPos(rect, step.placement);

  const spotlight = rect
    ? {
        top: rect.top - PAD,
        left: rect.left - PAD,
        width: rect.width + PAD * 2,
        height: rect.height + PAD * 2,
      }
    : null;

  return createPortal(
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label="Editor walkthrough">
      {/* Backdrop with spotlight cutout via SVG mask */}
      <svg className="absolute inset-0 w-full h-full pointer-events-auto" onClick={onClose}>
        <defs>
          <mask id="tour-mask">
            <rect width="100%" height="100%" fill="white" />
            {spotlight && (
              <rect
                x={spotlight.left}
                y={spotlight.top}
                width={spotlight.width}
                height={spotlight.height}
                rx="10"
                ry="10"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="currentColor"
          className="text-background"
          opacity="0.82"
          mask="url(#tour-mask)"
        />
        {spotlight && (
          <rect
            x={spotlight.left}
            y={spotlight.top}
            width={spotlight.width}
            height={spotlight.height}
            rx="10"
            ry="10"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-primary pointer-events-none"
          />
        )}
      </svg>

      {/* Popover card */}
      <div
        className="absolute rounded-lg border border-border bg-card shadow-2xl p-4 animate-in fade-in slide-in-from-bottom-2"
        style={{ top: cardPos.top, left: cardPos.left, width: CARD_W }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* progress */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            Step {idx + 1} of {total}
          </span>
          <button
            onClick={onClose}
            aria-label="Skip tour"
            className="text-muted-foreground hover:text-foreground transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="h-1 w-full rounded-full bg-secondary overflow-hidden mb-3">
          <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>

        <h3 className="text-base font-semibold mb-1">{step.title}</h3>
        <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{step.body}</p>

        <div className="flex items-center justify-between gap-2">
          <button
            onClick={onClose}
            className="text-xs text-muted-foreground hover:text-foreground transition"
          >
            Skip tour
          </button>
          <div className="flex items-center gap-2">
            {!isFirst && (
              <Button size="sm" variant="outline" onClick={() => setIdx((i) => i - 1)}>
                <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                Back
              </Button>
            )}
            {isLast ? (
              <Button size="sm" onClick={onClose}>
                Got it — start writing
              </Button>
            ) : (
              <Button size="sm" onClick={() => setIdx((i) => i + 1)}>
                Next
                <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
