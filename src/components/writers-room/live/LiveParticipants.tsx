import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { t } from "@/lib/i18n/t";
import { presenceDisplayName } from "@/lib/presence/displayName";
import type { LiveParticipant } from "@/lib/live-collab/types";

interface Props {
  participants: LiveParticipant[];
}

export function LiveParticipants({ participants }: Props) {
  if (participants.length === 0) {
    return (
      <p className="text-xs italic text-muted-foreground">
        {t("collab.live.noCollaborators")}
      </p>
    );
  }
  return (
    <div className="flex flex-wrap gap-2">
      {participants.map((p) => {
        const name = presenceDisplayName({
          display_name: p.display_name ?? null,
          email: null,
        });
        const initial = name.slice(0, 1).toUpperCase();
        return (
          <div
            key={p.user_id}
            className="flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-2 py-1"
            title={name}
          >
            <Avatar className="h-5 w-5">
              {p.avatar_url ? <AvatarImage src={p.avatar_url} alt={name} /> : null}
              <AvatarFallback className="text-[10px]">{initial}</AvatarFallback>
            </Avatar>
            <span className="text-xs">
              {name}
              {p.is_self ? (
                <span className="ml-1 text-muted-foreground">
                  ({t("collab.presence.you")})
                </span>
              ) : null}
            </span>
          </div>
        );
      })}
    </div>
  );
}
