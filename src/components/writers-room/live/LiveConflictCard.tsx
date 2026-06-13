import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n/t";
import type { HeldRemoteChange } from "@/lib/live-collab/types";

interface Props {
  conflict: HeldRemoteChange;
  onKeepMine: (c: HeldRemoteChange) => void;
  onUseTheirs: (c: HeldRemoteChange) => void;
  onResolveLater: (c: HeldRemoteChange) => void;
}

export function LiveConflictCard({
  conflict,
  onKeepMine,
  onUseTheirs,
  onResolveLater,
}: Props) {
  const reasonLabel: Record<HeldRemoteChange["reason"], string> = {
    local_dirty: t("collab.live.conflictHeld"),
    revision_mismatch: t("collab.live.conflictHeld"),
    missing_block: t("collab.live.conflictHeld"),
    locked_scene: t("collab.live.errorLocked"),
    unsupported_operation: t("collab.live.errorUnsupported"),
  };

  return (
    <article className="rounded-lg border border-border/60 bg-card/40 p-3 space-y-2">
      <header className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium">
          {conflict.actorName ?? t("collab.presence.collaborator")}
        </span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {reasonLabel[conflict.reason]}
        </span>
      </header>
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {t("collab.live.localChange")}
          </p>
          <p className="text-xs whitespace-pre-wrap font-mono bg-background/40 rounded p-2 mt-1 min-h-[2.25rem]">
            {conflict.localText ?? "—"}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {t("collab.live.remoteChange")}
          </p>
          <p className="text-xs whitespace-pre-wrap font-mono bg-background/40 rounded p-2 mt-1 min-h-[2.25rem]">
            {conflict.incomingText ?? "—"}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 pt-1">
        <Button size="sm" variant="outline" onClick={() => onKeepMine(conflict)}>
          {t("collab.live.keepMine")}
        </Button>
        <Button size="sm" onClick={() => onUseTheirs(conflict)}>
          {t("collab.live.useTheirs")}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onResolveLater(conflict)}
        >
          {t("collab.live.resolveLater")}
        </Button>
      </div>
    </article>
  );
}
