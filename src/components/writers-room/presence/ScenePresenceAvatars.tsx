import { useMemo } from "react";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n/t";
import { useOptionalPresence } from "@/lib/presence/PresenceProvider";
import { presenceDisplayName, presenceInitials } from "@/lib/presence/displayName";
import { BLOCK_LABEL } from "@/lib/editor/autoFormat";

export interface ScenePresenceBlock {
  id: string;
  serverId?: string;
  block_type: string;
  content: string;
}

interface Props {
  /** Title of the scene as seen in the local outline (case-insensitive matched). */
  sceneTitle: string;
  /** Local blocks so we can resolve a peer's active_block_id → block type. */
  blocks?: ScenePresenceBlock[];
  /** Max avatars shown before "+N". */
  max?: number;
  className?: string;
}

/**
 * Compact avatar row for a scene card / outline row indicating which
 * teammates are currently on this scene. When a peer's active block resolves
 * inside the local outline, the tooltip also names the block type they're on.
 * Read-only: no writes, no side effects, no per-keystroke signals.
 */
export function ScenePresenceAvatars({ sceneTitle, blocks, max = 3, className }: Props) {
  const presence = useOptionalPresence();

  const peersHere = useMemo(() => {
    if (!presence) return [];
    const needle = (sceneTitle ?? "").trim().toLowerCase();
    if (!needle) return [];
    return presence.peers.filter(
      (p) => !p.is_self && (p.active_scene_label ?? "").trim().toLowerCase() === needle,
    );
  }, [presence, sceneTitle]);

  const blockIndex = useMemo(() => {
    const idx = new Map<string, ScenePresenceBlock>();
    for (const b of blocks ?? []) {
      idx.set(b.id, b);
      if (b.serverId) idx.set(b.serverId, b);
    }
    return idx;
  }, [blocks]);

  if (peersHere.length === 0) return null;

  const visible = peersHere.slice(0, max);
  const overflow = peersHere.length - visible.length;

  return (
    <TooltipProvider delayDuration={120}>
      <div
        className={cn("flex items-center -space-x-1", className)}
        aria-label={t("collab.presence.onThisScene")}
      >
        {visible.map((peer) => {
          const name = presenceDisplayName(peer);
          const initials = presenceInitials(peer);
          const isTyping = peer.is_typing_scene_id === peer.active_scene_id;
          const block = peer.active_block_id ? blockIndex.get(peer.active_block_id) : null;
          const blockLabel = block
            ? BLOCK_LABEL[block.block_type as keyof typeof BLOCK_LABEL] ?? block.block_type
            : null;
          const tooltip = blockLabel
            ? `${name} · ${t("collab.presence.onBlock", { blockLabel })}${isTyping ? " · " + t("collab.presence.typingNow") : ""}`
            : `${name}${isTyping ? " · " + t("collab.presence.typingNow") : ""}`;
          return (
            <Tooltip key={peer.user_id}>
              <TooltipTrigger asChild>
                <span
                  className={cn(
                    "relative inline-flex items-center justify-center h-4 w-4 rounded-full ring-1 ring-background bg-primary/20 text-[8px] font-semibold text-primary-foreground/90 uppercase overflow-hidden",
                    isTyping && "ring-primary/60 shadow-[0_0_0_2px_rgba(120,120,255,0.15)]",
                  )}
                  aria-label={tooltip}
                >
                  {peer.avatar_url ? (
                    <img src={peer.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span aria-hidden>{initials}</span>
                  )}
                  {isTyping && (
                    <span
                      aria-hidden
                      className="absolute -bottom-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-emerald-500 ring-1 ring-background animate-pulse"
                    />
                  )}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                {tooltip}
              </TooltipContent>
            </Tooltip>
          );
        })}
        {overflow > 0 && (
          <span className="inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-muted text-[8px] font-semibold text-muted-foreground ring-1 ring-background">
            +{overflow}
          </span>
        )}
      </div>
    </TooltipProvider>
  );
}
