import { useEffect, useMemo, useState } from "react";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { t } from "@/lib/i18n/t";
import type { ProjectRole } from "@/components/writers-room/roles";
import { useProductionBoard } from "@/components/writers-room/board/useProductionBoard";
import { isLiveSceneCollabEnabled } from "@/lib/featureFlags";
import { useLiveSceneSession } from "@/lib/live-collab/useLiveSceneSession";

import { ExperimentalBadge } from "./ExperimentalBadge";
import { LiveSessionControls } from "./LiveSessionControls";
import { LiveParticipants } from "./LiveParticipants";
import { LiveConnectionBadge } from "./LiveConnectionBadge";
import { LiveConflictsPanel } from "./LiveConflictsPanel";

interface Props {
  projectId: string;
  role: ProjectRole | null;
}

interface Self {
  user_id: string;
  display_name?: string | null;
  avatar_url?: string | null;
}

/**
 * Writers' Room → Live Lab tab. Hidden entirely when the feature flag is off.
 *
 * Lets the user pick a scene from the Production Board scene list, then start
 * or join a scene-scoped live session. No editing happens here — the lab is
 * the coordination surface; canonical text edits still go through the normal
 * editor route's local-first save path.
 */
export function LiveCollabLabPanel({ projectId, role }: Props) {
  const flagOn = isLiveSceneCollabEnabled();
  const [self, setSelf] = useState<Self | null>(null);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.auth.getUser();
      if (cancelled || !data.user) return;
      const meta = (data.user.user_metadata ?? {}) as Record<string, unknown>;
      setSelf({
        user_id: data.user.id,
        display_name:
          (typeof meta.full_name === "string" && meta.full_name) ||
          (typeof meta.name === "string" && (meta.name as string)) ||
          data.user.email ||
          null,
        avatar_url:
          (typeof meta.avatar_url === "string" && meta.avatar_url) ||
          (typeof meta.picture === "string" && (meta.picture as string)) ||
          null,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const { rows, isLoading } = useProductionBoard(projectId);

  const selectedRow = useMemo(
    () => rows.find((r) => r.scene.id === selectedSceneId) ?? null,
    [rows, selectedSceneId],
  );

  const session = useLiveSceneSession({
    projectId,
    sceneId: selectedSceneId,
    role,
    self,
    activeLock: selectedRow?.activeLock ?? null,
  });

  if (!flagOn) {
    // Defensive — the tab is hidden, but if rendered directly, show nothing.
    return null;
  }

  return (
    <div className="space-y-6">
      <Card className="p-6 bg-card/60">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-display text-xl font-semibold tracking-tight">
                {t("collab.live.title")}
              </h2>
              <ExperimentalBadge />
            </div>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              {t("collab.live.subtitle")}
            </p>
          </div>
          <LiveConnectionBadge state={session.connection} />
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Card className="p-6 bg-card/60 space-y-5">
          <div>
            <h3 className="font-display text-base font-semibold mb-2">
              {t("collab.live.sessionScene")}
            </h3>
            {isLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : rows.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                {t("collab.assignments.empty")}
              </p>
            ) : (
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={selectedSceneId ?? ""}
                onChange={(e) => setSelectedSceneId(e.target.value || null)}
                disabled={session.active}
              >
                <option value="">—</option>
                {rows.map((r) => (
                  <option key={r.scene.id} value={r.scene.id}>
                    {r.ordinal}. {r.scene.scene_heading ?? r.scene.title ?? `Scene ${r.ordinal}`}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <h3 className="font-display text-base font-semibold mb-2">
              {t("collab.live.collaborators")}
            </h3>
            <LiveParticipants participants={session.participants} />
          </div>

          <div>
            <LiveSessionControls
              active={session.active}
              canStart={session.canStart}
              canJoin={session.canJoin}
              onStart={() => void session.start()}
              onJoin={() => void session.join()}
              onLeave={() => void session.leave()}
              errorKind={session.error}
            />
          </div>

          <p className="text-xs text-muted-foreground italic border-t border-border/40 pt-3">
            {t("collab.live.notWiredNotice")}
          </p>
        </Card>

        <Card className="p-6 bg-card/60">
          <LiveConflictsPanel
            conflicts={session.conflicts}
            onKeepMine={(c) => session.dismissConflict(c.id)}
            onUseTheirs={(c) => session.acceptIncoming(c)}
            onResolveLater={(c) => session.dismissConflict(c.id)}
          />
        </Card>
      </div>
    </div>
  );
}
