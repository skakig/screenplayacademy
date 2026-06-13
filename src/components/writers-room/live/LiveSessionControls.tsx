import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n/t";

interface Props {
  active: boolean;
  canStart: boolean;
  canJoin: boolean;
  onStart: () => void;
  onJoin: () => void;
  onLeave: () => void;
  errorKind: null | "permission" | "locked" | "flag_off" | "unknown";
}

export function LiveSessionControls({
  active,
  canStart,
  canJoin,
  onStart,
  onJoin,
  onLeave,
  errorKind,
}: Props) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {active ? (
          <Button size="sm" variant="secondary" onClick={onLeave}>
            {t("collab.live.leave")}
          </Button>
        ) : (
          <>
            <Button
              size="sm"
              onClick={onStart}
              disabled={!canStart}
              title={!canStart ? t("collab.live.errorPermission") : undefined}
            >
              {t("collab.live.start")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onJoin}
              disabled={!canJoin}
            >
              {t("collab.live.join")}
            </Button>
          </>
        )}
        {active ? (
          <span className="text-xs text-emerald-700 dark:text-emerald-400">
            {t("collab.live.active")}
          </span>
        ) : null}
      </div>
      {errorKind ? (
        <p className="text-xs text-destructive">
          {errorKind === "locked"
            ? t("collab.live.errorLocked")
            : errorKind === "permission"
              ? t("collab.live.errorPermission")
              : errorKind === "flag_off"
                ? t("collab.live.errorUnsupported")
                : t("collab.live.errorUnsupported")}
        </p>
      ) : null}
    </div>
  );
}
