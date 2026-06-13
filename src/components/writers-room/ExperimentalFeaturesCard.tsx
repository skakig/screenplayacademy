import { useEffect, useState } from "react";
import { FlaskConical } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { t } from "@/lib/i18n/t";
import {
  isLiveSceneCollabAvailable,
  isLiveSceneCollabUserEnabled,
  setLiveSceneCollabUserEnabled,
  useLiveSceneCollabEnabled,
} from "@/lib/featureFlags";

/**
 * In-app toggle for the Live Collaboration Lab. Only the per-browser user
 * switch — the build-time env gate is still required to unlock anything.
 * No DB writes. Never affects other users.
 */
export function ExperimentalFeaturesCard() {
  const available = isLiveSceneCollabAvailable();
  // Keep the effective gate listener mounted so the switch state stays in
  // sync if it's flipped from another tab.
  useLiveSceneCollabEnabled();
  const [userEnabled, setUserEnabled] = useState<boolean>(() =>
    isLiveSceneCollabUserEnabled(),
  );

  useEffect(() => {
    setUserEnabled(isLiveSceneCollabUserEnabled());
  }, []);

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

      {!available ? (
        <p className="text-xs italic text-muted-foreground border-t border-border/40 pt-3">
          {t("collab.experimental.unavailable")}
        </p>
      ) : (
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
            checked={userEnabled}
            onCheckedChange={(next) => {
              setUserEnabled(next);
              setLiveSceneCollabUserEnabled(next);
            }}
          />
        </div>
      )}
    </Card>
  );
}
