import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n/t";
import { presenceDisplayName, presenceInitials } from "@/lib/presence/displayName";
import type { PresencePeer } from "@/lib/presence/types";

interface Props {
  peer: PresencePeer;
  size?: "sm" | "md";
  className?: string;
  ring?: boolean;
}

/**
 * Status dot semantics:
 *   - primary (pulsing): typing in a scene
 *   - sky:               in a scene, not typing
 *   - emerald:           present, no scene focus
 *   - muted:             idle (no ping in > IDLE_AFTER_MS)
 */
export function PresenceAvatar({ peer, size = "sm", className, ring = true }: Props) {
  const name = presenceDisplayName(peer);
  const sizing = size === "md" ? "h-9 w-9 text-sm" : "h-7 w-7 text-[10px]";
  const typing = !!peer.is_typing_scene_id;
  const idle = !!peer.is_idle && !typing;
  const inScene = !!peer.active_scene_id && !idle;

  const title = idle
    ? `${name} · ${t("collab.presence.idle")}`
    : typing && peer.active_scene_label
      ? `${name} · ${t("collab.presence.typingNow")} — ${peer.active_scene_label}`
      : peer.active_scene_label
        ? `${name} · ${t("collab.presence.inScene", { scene: peer.active_scene_label })}`
        : name;

  const dotClass = typing
    ? "bg-primary animate-pulse"
    : idle
      ? "bg-muted-foreground/60"
      : inScene
        ? "bg-sky-500"
        : "bg-emerald-500";

  return (
    <div
      className={cn(
        "relative inline-flex shrink-0 transition-opacity",
        typing && "presence-typing-ring",
        idle && "opacity-60",
        className,
      )}
      title={title}
      data-presence-state={typing ? "typing" : idle ? "idle" : inScene ? "in-scene" : "here"}
    >
      <Avatar
        className={cn(
          sizing,
          ring && "ring-2 ring-background",
          inScene && !typing && "ring-sky-500/60",
          typing && "ring-primary/60",
          idle && "grayscale",
        )}
      >
        {peer.avatar_url ? (
          <AvatarImage src={peer.avatar_url} alt={name} />
        ) : null}
        <AvatarFallback className="bg-secondary text-foreground/80 font-medium">
          {presenceInitials(peer)}
        </AvatarFallback>
      </Avatar>
      <span
        aria-hidden
        className={cn(
          "absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full ring-2 ring-background",
          dotClass,
        )}
      />
    </div>
  );
}
