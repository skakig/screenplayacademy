import { t } from "@/lib/i18n/t";
import type { HeldRemoteChange } from "@/lib/live-collab/types";

import { LiveConflictCard } from "./LiveConflictCard";

interface Props {
  conflicts: HeldRemoteChange[];
  onKeepMine: (c: HeldRemoteChange) => void;
  onUseTheirs: (c: HeldRemoteChange) => void;
  onResolveLater: (c: HeldRemoteChange) => void;
}

export function LiveConflictsPanel({
  conflicts,
  onKeepMine,
  onUseTheirs,
  onResolveLater,
}: Props) {
  return (
    <div className="space-y-3">
      <h4 className="font-display text-sm font-semibold">
        {t("collab.live.conflictsTitle")}
      </h4>
      {conflicts.length === 0 ? (
        <p className="text-xs italic text-muted-foreground">
          {t("collab.live.conflictHeld")} —{" "}
          <span className="not-italic">0</span>
        </p>
      ) : (
        <div className="space-y-2">
          {conflicts.map((c) => (
            <LiveConflictCard
              key={c.id}
              conflict={c}
              onKeepMine={onKeepMine}
              onUseTheirs={onUseTheirs}
              onResolveLater={onResolveLater}
            />
          ))}
        </div>
      )}
    </div>
  );
}
