import { useEffect, useMemo, useRef, useState } from "react";
import { useOptionalPresence } from "@/lib/presence/PresenceProvider";
import { presenceDisplayName, presenceInitials } from "@/lib/presence/displayName";
import { buildAuthorshipPalette, type AuthorshipColor } from "@/components/writers-room/arena/authorshipPalette";
import type { PresencePeer } from "@/lib/presence/types";
import { t } from "@/lib/i18n/t";

interface Props {
  /** Root element that contains the screenplay blocks. Peer positions are computed relative to it. */
  containerRef: React.RefObject<HTMLElement | null>;
  /** Project id used as the palette scope so colors stay stable within a project. */
  projectId: string;
}

interface PeerMark {
  peer: PresencePeer;
  color: AuthorshipColor;
  top: number;   // offset within container
  height: number;
  typing: boolean;
}

/**
 * Renders a colored caret / block indicator per remote teammate whose caret
 * sits on a script block currently rendered on screen. Positions are computed
 * from the DOM (`[data-block-id]`) — no editor coupling.
 */
export function PeerBlockIndicators({ containerRef, projectId }: Props) {
  const presence = useOptionalPresence();
  const [marks, setMarks] = useState<PeerMark[]>([]);
  const rafRef = useRef<number | null>(null);

  const remotePeers = useMemo(
    () =>
      (presence?.peers ?? []).filter(
        (p) => !p.is_self && p.active_area === "script" && p.active_block_id,
      ),
    [presence?.peers],
  );

  // Deterministic per-project color palette across all peers we've seen.
  const palette = useMemo(() => {
    const ids = remotePeers.map((p) => p.user_id).sort();
    return buildAuthorshipPalette(projectId, ids);
  }, [projectId, remotePeers]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      setMarks([]);
      return;
    }

    const compute = () => {
      const containerRect = container.getBoundingClientRect();
      const next: PeerMark[] = [];
      for (const peer of remotePeers) {
        const id = peer.active_block_id;
        if (!id) continue;
        const el = container.querySelector<HTMLElement>(
          `[data-block-id="${cssEscape(id)}"]`,
        );
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        // Skip blocks outside the container's visible logical box.
        if (rect.bottom < containerRect.top - 200 || rect.top > containerRect.bottom + 200) continue;
        next.push({
          peer,
          color: palette.get(peer.user_id) ?? {
            rail: "hsl(var(--primary))",
            tint: "transparent",
            chip: "hsl(var(--primary))",
            chipFg: "hsl(var(--primary-foreground))",
          },
          top: rect.top - containerRect.top + container.scrollTop,
          height: rect.height,
          typing: peer.is_typing_scene_id === peer.active_scene_id,
        });
      }
      setMarks(next);
    };

    const schedule = () => {
      if (rafRef.current != null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        compute();
      });
    };

    compute();

    const ro = new ResizeObserver(schedule);
    ro.observe(container);
    const mo = new MutationObserver(schedule);
    mo.observe(container, { childList: true, subtree: true, characterData: true });
    container.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);

    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      mo.disconnect();
      container.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [containerRef, remotePeers, palette]);

  if (marks.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-20" aria-hidden>
      {marks.map(({ peer, color, top, height, typing }) => {
        const name = presenceDisplayName(peer);
        return (
          <div
            key={peer.user_id}
            className="absolute left-0"
            style={{ top, height }}
            title={typing ? t("collab.presence.typingInScene", { name }) : name}
          >
            <div
              className="absolute left-0 top-0 w-[3px] rounded-full transition-opacity"
              style={{
                height,
                background: color.rail,
                opacity: typing ? 1 : 0.55,
                boxShadow: typing ? `0 0 0 2px ${color.tint}` : undefined,
              }}
            />
            <div
              className="pointer-events-auto absolute -left-2 top-1/2 -translate-x-full -translate-y-1/2 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium shadow-sm ring-1 ring-black/5"
              style={{ background: color.chip, color: color.chipFg }}
            >
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: color.rail, opacity: typing ? 1 : 0.5 }}
              />
              <span className="whitespace-nowrap">{presenceInitials(peer)}</span>
              {typing ? (
                <span className="ml-0.5 inline-flex items-center gap-[2px]" aria-label="typing">
                  <TypingDot delay={0} />
                  <TypingDot delay={120} />
                  <TypingDot delay={240} />
                </span>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TypingDot({ delay }: { delay: number }) {
  return (
    <span
      className="inline-block h-1 w-1 rounded-full bg-current opacity-70"
      style={{ animation: `presence-typing-pulse 900ms ${delay}ms ease-in-out infinite` }}
    />
  );
}

// `CSS.escape` is browser-only; guard for SSR / older bundling.
function cssEscape(v: string): string {
  if (typeof (globalThis as any).CSS !== "undefined" && typeof (globalThis as any).CSS.escape === "function") {
    return (globalThis as any).CSS.escape(v);
  }
  return v.replace(/["\\]/g, "\\$&");
}
