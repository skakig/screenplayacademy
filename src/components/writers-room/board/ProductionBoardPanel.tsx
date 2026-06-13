import { useEffect, useState } from "react";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";

import { t } from "@/lib/i18n/t";
import type { ProjectRole } from "@/components/writers-room/roles";
import {
  canClaimScene,
  canManageSceneAssignments,
  canViewSceneAssignments,
} from "@/components/writers-room/permissions";

import { useProductionBoard } from "./useProductionBoard";
import { SceneRow } from "./SceneRow";

interface Props {
  projectId: string;
  role: ProjectRole | null;
}

export function ProductionBoardPanel({ projectId, role }: Props) {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) setUserId(data.user?.id ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const { rows, isLoading, isError } = useProductionBoard(projectId);

  if (!canViewSceneAssignments(role)) return null;

  const canManage = canManageSceneAssignments(role);
  const canClaim = canClaimScene(role);

  return (
    <div className="space-y-6">
      <Card className="p-6 bg-card/60">
        <h2 className="font-display text-xl font-semibold">
          {t("collab.assignments.title")}
        </h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          {t("collab.assignments.subtitle")}
        </p>
        {!canManage && (
          <p className="text-xs text-muted-foreground italic mt-3">
            {t("collab.assignments.readOnlyHint")}
          </p>
        )}
      </Card>

      <Card className="p-6 bg-card/60">
        <div className="mb-4">
          <h3 className="font-display text-lg font-semibold">
            {t("collab.locks.title")}
          </h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            {t("collab.locks.subtitle")}
          </p>
          {!canClaim && (
            <p className="text-xs text-muted-foreground italic mt-3">
              {t("collab.locks.readOnlyHint")}
            </p>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : isError ? (
          <p className="text-sm text-destructive">
            {t("collab.assignments.errorLoad")}
          </p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            {t("collab.assignments.empty")}
          </p>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => (
              <SceneRow
                key={row.scene.id}
                projectId={projectId}
                row={row}
                role={role}
                currentUserId={userId}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
