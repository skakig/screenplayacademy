import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { presenceDisplayName, presenceInitials } from "@/lib/presence/displayName";
import type { PresencePeer } from "@/lib/presence/types";

interface Props {
  peer: PresencePeer;
  size?: "sm" | "md";
  className?: string;
  ring?: boolean;
}

export function PresenceAvatar({ peer, size = "sm", className, ring = true }: Props) {
  const name = presenceDisplayName(peer);
  const sizing = size === "md" ? "h-9 w-9 text-sm" : "h-7 w-7 text-[10px]";
  const typing = !!peer.is_typing_scene_id;
  const idle = !!peer.is_idle && !typing;
  return (
    <div
      className={cn(
        "relative inline-flex shrink-0 transition-opacity",
        typing && "presence-typing-ring",
        idle && "opacity-60",
        className,
      )}
      title={idle ? `${name} · idle` : name}
    >
      <Avatar
        className={cn(
          sizing,
          ring && "ring-2 ring-background",
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
          typing ? "bg-primary" : idle ? "bg-muted-foreground/60" : "bg-emerald-500",
        )}
      />
    </div>
  );
}
