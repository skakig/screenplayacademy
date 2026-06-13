import { useMemo } from "react";
import { formatDistanceToNow } from "date-fns";

import { Badge } from "@/components/ui/badge";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n/t";
import { roleLabel } from "@/components/writers-room/roles";
import { useOptionalPresence } from "@/lib/presence/PresenceProvider";
import { presenceDisplayName } from "@/lib/presence/displayName";
import type { PresencePeer } from "@/lib/presence/types";

import { PresenceAvatar } from "./PresenceAvatar";
import { ActiveAreaLabel } from "./ActiveAreaLabel";

interface Props {
  /** Max avatars shown before "+N". */
  max?: number;
  /** Include the current user in the stack. Defaults to false. */
  includeSelf?: boolean;
  className?: string;
  size?: "sm" | "md";
}

export function PresenceAvatarStack({
  max = 5,
  includeSelf = false,
  className,
  size = "sm",
}: Props) {
  const presence = useOptionalPresence();

  const ordered = useMemo(() => {
    if (!presence) return [] as PresencePeer[];
    const list = includeSelf ? presence.peers : presence.peers.filter((p) => !p.is_self);
    return [...list].sort((a, b) =>
      a.last_active_at < b.last_active_at ? 1 : -1,
    );
  }, [presence, includeSelf]);

  if (!presence || ordered.length === 0) return null;

  const visible = ordered.slice(0, max);
  const overflow = ordered.length - visible.length;

  return (
    <div className={cn("flex items-center -space-x-2", className)}>
      {visible.map((peer) => (
        <HoverCard key={peer.user_id} openDelay={120} closeDelay={80}>
          <HoverCardTrigger asChild>
            <button type="button" className="rounded-full focus:outline-none focus:ring-2 focus:ring-primary/40">
              <PresenceAvatar peer={peer} size={size} />
            </button>
          </HoverCardTrigger>
          <HoverCardContent className="w-64" align="end">
            <PeerCard peer={peer} />
          </HoverCardContent>
        </HoverCard>
      ))}
      {overflow > 0 && (
        <span
          className={cn(
            "ring-2 ring-background bg-secondary text-muted-foreground rounded-full inline-flex items-center justify-center",
            size === "md" ? "h-9 w-9 text-xs" : "h-7 w-7 text-[10px]",
          )}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}

function PeerCard({ peer }: { peer: PresencePeer }) {
  const name = presenceDisplayName(peer);
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-display text-sm font-semibold truncate">
          {peer.is_self ? `${name} · ${t("collab.presence.you")}` : name}
        </span>
        {peer.role && (
          <Badge variant="secondary" className="font-normal">
            {roleLabel(peer.role)}
          </Badge>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        <ActiveAreaLabel peer={peer} />
      </p>
      <p className="text-[11px] text-muted-foreground/80">
        {t("collab.presence.lastSeen", {
          when: formatDistanceToNow(new Date(peer.last_active_at), { addSuffix: true }),
        })}
      </p>
    </div>
  );
}
