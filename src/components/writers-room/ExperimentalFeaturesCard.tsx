import { useEffect, useState } from "react";
import { FlaskConical } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { t } from "@/lib/i18n/t";
import {
  isArenaAvailable,
  isArenaUserEnabled,
  isLiveSceneCollabAvailable,
  isLiveSceneCollabUserEnabled,
  setArenaUserEnabled,
  setLiveSceneCollabUserEnabled,
  useArenaEnabled,
  useLiveSceneCollabEnabled,
} from "@/lib/featureFlags";

/**
 * In-app toggles for experimental features. Each switch is only the
 * per-browser user gate — the build-time env gate is still required to
 * unlock anything. No DB writes.
 */
export function ExperimentalFeaturesCard() {
  const liveAvailable = isLiveSceneCollabAvailable();
  const arenaAvailable = isArenaAvailable();
  // Keep listeners mounted so switch state stays in sync across tabs.
  useLiveSceneCollabEnabled();
  useArenaEnabled();
  const [liveEnabled, setLiveEnabled] = useState<boolean>(() =>
    isLiveSceneCollabUserEnabled(),
  );
  const [arenaEnabled, setArenaEnabled] = useState<boolean>(() =>
    isArenaUserEnabled(),
  );

  useEffect(() => {
    setLiveEnabled(isLiveSceneCollabUserEnabled());
    setArenaEnabled(isArenaUserEnabled());
  }, []);

  const anyAvailable = liveAvailable || arenaAvailable;

  return (
    <Card className="p-6 bg-card/60">
      <div className="flex items-start gap-3 mb-4">
        <FlaskConical className="h-4 w-4 mt-1 text-muted-foreground" />
        <div>
          <h2 className="font-display text-xl font-semibold">
            {t("collab.experimental.title")}
          </h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            {t("collab.experimental.subtitle")}
          </p>
        </div>
      </div>

      {!anyAvailable ? (
        <p className="text-xs italic text-muted-foreground border-t border-border/40 pt-3">
          {t("collab.experimental.unavailable")}
        </p>
      ) : (
        <div className="space-y-4">
          {liveAvailable && (
            <div className="flex items-start justify-between gap-4 border-t border-border/40 pt-4">
              <div className="min-w-0">
                <Label
                  htmlFor="exp-live-collab-switch"
                  className="font-display text-sm font-semibold"
                >
                  {t("collab.experimental.liveCollab.title")}
                </Label>
                <p className="text-xs text-muted-foreground mt-1 max-w-xl">
                  {t("collab.experimental.liveCollab.body")}
                </p>
              </div>
              <Switch
                id="exp-live-collab-switch"
                checked={liveEnabled}
                onCheckedChange={(next) => {
                  setLiveEnabled(next);
                  setLiveSceneCollabUserEnabled(next);
                }}
              />
            </div>
          )}

          {arenaAvailable && (
            <div className="flex items-start justify-between gap-4 border-t border-border/40 pt-4">
              <div className="min-w-0">
                <Label
                  htmlFor="exp-arena-switch"
                  className="font-display text-sm font-semibold"
                >
                  {t("collab.experimental.arena.title")}
                </Label>
                <p className="text-xs text-muted-foreground mt-1 max-w-xl">
                  {t("collab.experimental.arena.body")}
                </p>
              </div>
              <Switch
                id="exp-arena-switch"
                checked={arenaEnabled}
                onCheckedChange={(next) => {
                  setArenaEnabled(next);
                  setArenaUserEnabled(next);
                }}
              />
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
