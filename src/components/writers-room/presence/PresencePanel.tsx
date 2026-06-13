import { useMemo } from "react";

import { Card } from "@/components/ui/card";
import { t } from "@/lib/i18n/t";
import { useOptionalPresence } from "@/lib/presence/PresenceProvider";

import { PresenceAvatarStack } from "./PresenceAvatarStack";

export function PresencePanel() {
  const presence = useOptionalPresence();

  const others = useMemo(
    () => (presence ? presence.peers.filter((p) => !p.is_self) : []),
    [presence],
  );

  return (
    <Card className="p-5 bg-card/40 border-border/60">
      <div className="flex items-start gap-4 flex-wrap">
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-semibold tracking-tight">
            {t("collab.presence.title")}
          </h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl">
            {t("collab.presence.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {others.length === 0 ? (
            <p className="text-xs italic text-muted-foreground">
              {t("collab.presence.noOneOnline")}
            </p>
          ) : (
            <>
              <span className="text-xs text-muted-foreground">
                {t("collab.presence.onlineNow")}
              </span>
              <PresenceAvatarStack size="md" />
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
