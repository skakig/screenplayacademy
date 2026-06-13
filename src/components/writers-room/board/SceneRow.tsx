import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { CalendarClock, Plus, Trash2, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { t } from "@/lib/i18n/t";
import {
  boardKeys,
  clearAssignment,
  updateAssignmentStatus,
  type AssignmentStatus,
} from "@/lib/assignments";
import type { ProjectRole } from "@/components/writers-room/roles";
import {
  canClaimScene,
  canManageSceneAssignments,
  canOverrideSceneLock,
} from "@/components/writers-room/permissions";

import type { SceneRowData } from "./useProductionBoard";
import {
  AssignmentStatusSelect,
  statusLabel,
} from "./AssignmentStatusSelect";
import { LockStatusBadge } from "./LockStatusBadge";
import { LockActions } from "./LockActions";
import { AssignSceneDialog } from "./AssignSceneDialog";

interface Props {
  projectId: string;
  row: SceneRowData;
  role: ProjectRole | null;
  currentUserId: string | null;
}

export function SceneRow({ projectId, row, role, currentUserId }: Props) {
  const { scene, ordinal, assignments, activeLock } = row;
  const qc = useQueryClient();
  const [assignOpen, setAssignOpen] = useState(false);
  const [confirmClearId, setConfirmClearId] = useState<string | null>(null);

  const canManage = canManageSceneAssignments(role);
  const userCanInteract =
    canManage ||
    canClaimScene(role) ||
    canOverrideSceneLock(role);

  const sceneLabel =
    (scene.scene_heading || scene.title || "").trim() ||
    t("collab.board.sceneFallback", { n: ordinal });

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: boardKeys.assignments(projectId) });

  const statusMut = useMutation({
    mutationFn: (vars: { id: string; status: AssignmentStatus }) =>
      updateAssignmentStatus(vars.id, vars.status),
    onSuccess: invalidate,
    onError: (e: unknown) =>
      toast.error(
        e instanceof Error ? e.message : t("collab.assignments.errorSave"),
      ),
  });

  const clearMut = useMutation({
    mutationFn: (id: string) => clearAssignment(id),
    onSuccess: () => {
      invalidate();
      toast.success(t("collab.assignments.clearedToast"));
    },
    onError: (e: unknown) =>
      toast.error(
        e instanceof Error ? e.message : t("collab.assignments.errorSave"),
      ),
  });

  return (
    <div className="rounded-md border border-border/60 bg-card/40 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h4 className="font-display text-base font-medium leading-tight">
            {sceneLabel}
          </h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("collab.board.sceneFallback", { n: ordinal })}
            {scene.status && scene.status !== "idea" ? ` · ${scene.status}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <LockStatusBadge lock={activeLock} currentUserId={currentUserId} />
          {userCanInteract && (
            <LockActions
              projectId={projectId}
              sceneId={scene.id}
              lock={activeLock}
              role={role}
              currentUserId={currentUserId}
            />
          )}
        </div>
      </div>

      <div className="space-y-2">
        {assignments.length === 0 ? (
          <p className="text-xs italic text-muted-foreground">
            {t("collab.assignments.unassigned")}
          </p>
        ) : (
          <ul className="space-y-2">
            {assignments.map((a) => {
              const isSelf = a.assignee_id === currentUserId;
              return (
                <li
                  key={a.id}
                  className="flex items-center gap-3 flex-wrap text-sm"
                >
                  <span className="font-medium">
                    {isSelf
                      ? t("collab.member.you")
                      : `Member ${a.assignee_id.slice(0, 6)}`}
                  </span>
                  {canManage ? (
                    <AssignmentStatusSelect
                      value={a.status}
                      onChange={(status) =>
                        statusMut.mutate({ id: a.id, status })
                      }
                      disabled={statusMut.isPending}
                    />
                  ) : (
                    <Badge variant="secondary" className="font-normal">
                      {statusLabel(a.status)}
                    </Badge>
                  )}
                  {a.due_at && (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <CalendarClock className="h-3 w-3" />
                      {t("collab.assignments.dueDate")} {format(new Date(a.due_at), "PP")}
                    </span>
                  )}
                  {a.note && (
                    <span className="text-xs text-muted-foreground italic max-w-md truncate">
                      “{a.note}”
                    </span>
                  )}
                  {canManage && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 ml-auto"
                      onClick={() => setConfirmClearId(a.id)}
                      aria-label={t("collab.assignments.clear")}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {canManage && (
          <Button
            size="sm"
            variant="ghost"
            className="h-8 -ml-2"
            onClick={() => setAssignOpen(true)}
          >
            {assignments.length === 0 ? (
              <>
                <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                {t("collab.assignments.assign")}
              </>
            ) : (
              <>
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                {t("collab.assignments.changeAssignee")}
              </>
            )}
          </Button>
        )}
      </div>

      {canManage && (
        <AssignSceneDialog
          open={assignOpen}
          onOpenChange={setAssignOpen}
          projectId={projectId}
          sceneId={scene.id}
          sceneLabel={sceneLabel}
        />
      )}

      <AlertDialog
        open={confirmClearId !== null}
        onOpenChange={(o) => !o && setConfirmClearId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("collab.assignments.clear.confirm.title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("collab.assignments.clear.confirm.body")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("collab.comments.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmClearId) clearMut.mutate(confirmClearId);
                setConfirmClearId(null);
              }}
            >
              {t("collab.assignments.clear")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
