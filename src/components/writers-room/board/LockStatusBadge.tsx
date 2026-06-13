import { Lock, LockOpen, AlertCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { t } from "@/lib/i18n/t";
import { isLockStale, type SceneLockRow } from "@/lib/assignments";

interface Props {
  lock: SceneLockRow | null;
  currentUserId: string | null;
}

export function LockStatusBadge({ lock, currentUserId }: Props) {
  if (!lock) {
    return (
      <Badge
        variant="outline"
        className="font-normal text-muted-foreground gap-1"
      >
        <LockOpen className="h-3 w-3" />
        {t("collab.locks.unlocked")}
      </Badge>
    );
  }

  if (isLockStale(lock)) {
    return (
      <Badge
        variant="outline"
        className="font-normal border-dashed gap-1 text-muted-foreground"
      >
        <AlertCircle className="h-3 w-3" />
        {t("collab.locks.expired")}
      </Badge>
    );
  }

  if (currentUserId && lock.locked_by === currentUserId) {
    return (
      <Badge
        variant="outline"
        className="font-normal ring-1 ring-primary/30 text-primary gap-1"
      >
        <Lock className="h-3 w-3" />
        {t("collab.locks.lockedByYou")}
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="font-normal gap-1">
      <Lock className="h-3 w-3" />
      {t("collab.locks.lockedByUser", {
        name: `Member ${lock.locked_by.slice(0, 6)}`,
      })}
    </Badge>
  );
}
