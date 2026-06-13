import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Lock, LockOpen, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
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
  claimScene,
  isLockStale,
  overrideLock,
  releaseLock,
  type SceneLockRow,
} from "@/lib/assignments";
import type { ProjectRole } from "@/components/writers-room/roles";
import {
  canClaimScene,
  canOverrideSceneLock,
} from "@/components/writers-room/permissions";

interface Props {
  projectId: string;
  sceneId: string;
  lock: SceneLockRow | null;
  role: ProjectRole | null;
  currentUserId: string | null;
}

export function LockActions({
  projectId,
  sceneId,
  lock,
  role,
  currentUserId,
}: Props) {
  const qc = useQueryClient();
  const [confirmOverride, setConfirmOverride] = useState(false);

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: boardKeys.locks(projectId) });

  const claimMut = useMutation({
    mutationFn: () => claimScene({ projectId, sceneId }),
    onSuccess: () => {
      invalidate();
      toast.success(t("collab.locks.claimedToast"));
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "ALREADY_LOCKED") {
        toast.error(t("collab.locks.alreadyLocked"));
        invalidate();
        return;
      }
      toast.error(msg || t("collab.locks.errorClaim"));
    },
  });

  const releaseMut = useMutation({
    mutationFn: (lockId: string) => releaseLock(lockId),
    onSuccess: () => {
      invalidate();
      toast.success(t("collab.locks.releasedToast"));
    },
    onError: (e: unknown) =>
      toast.error(
        e instanceof Error ? e.message : t("collab.locks.errorRelease"),
      ),
  });

  const overrideMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      overrideLock(id, reason),
    onSuccess: () => {
      invalidate();
      toast.success(t("collab.locks.overriddenToast"));
    },
    onError: (e: unknown) =>
      toast.error(
        e instanceof Error ? e.message : t("collab.locks.errorOverride"),
      ),
  });

  const userCanClaim = canClaimScene(role);
  const userCanOverride = canOverrideSceneLock(role);
  const stale = isLockStale(lock);
  const isOwnLock =
    !!lock && !!currentUserId && lock.locked_by === currentUserId;

  // No active lock → maybe show Claim
  if (!lock) {
    if (!userCanClaim) return null;
    return (
      <Button
        size="sm"
        variant="secondary"
        onClick={() => claimMut.mutate()}
        disabled={claimMut.isPending}
        className="h-8"
      >
        <Lock className="h-3.5 w-3.5 mr-1.5" />
        {t("collab.locks.claimScene")}
      </Button>
    );
  }

  // Active lock — actions depend on who you are
  return (
    <>
      {isOwnLock && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => releaseMut.mutate(lock.id)}
          disabled={releaseMut.isPending}
          className="h-8"
        >
          <LockOpen className="h-3.5 w-3.5 mr-1.5" />
          {t("collab.locks.release")}
        </Button>
      )}
      {!isOwnLock && userCanOverride && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setConfirmOverride(true)}
          disabled={overrideMut.isPending}
          className="h-8"
        >
          <ShieldAlert className="h-3.5 w-3.5 mr-1.5" />
          {stale
            ? t("collab.locks.overrideExpired")
            : t("collab.locks.override")}
        </Button>
      )}

      <AlertDialog
        open={confirmOverride}
        onOpenChange={setConfirmOverride}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("collab.locks.confirmOverride.title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {stale
                ? t("collab.locks.confirmOverrideExpired.body")
                : t("collab.locks.confirmOverride.body", {
                    name: `Member ${lock.locked_by.slice(0, 6)}`,
                  })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("collab.comments.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                overrideMut.mutate({
                  id: lock.id,
                  reason: stale ? "expired_override" : "owner_override",
                });
                setConfirmOverride(false);
              }}
            >
              {stale
                ? t("collab.locks.overrideExpired")
                : t("collab.locks.override")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
