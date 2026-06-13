import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { roleLabel } from "./roles";
import { t } from "@/lib/i18n/t";
import { fetchPendingInvites, revokeInvite, wrKeys } from "@/lib/collab";

interface Props {
  projectId: string;
}

export function InvitesList({ projectId }: Props) {
  const qc = useQueryClient();
  const { data: invites, isLoading } = useQuery({
    queryKey: wrKeys.invites(projectId),
    queryFn: () => fetchPendingInvites(projectId),
  });
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);

  const revokeMut = useMutation({
    mutationFn: (id: string) => revokeInvite(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: wrKeys.invites(projectId) });
      toast.success("Invite revoked");
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Couldn't revoke invite"),
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (!invites || invites.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">
        {t("collab.invites.empty")}
      </p>
    );
  }

  return (
    <>
      <ul className="divide-y divide-border/60">
        {invites.map((inv) => (
          <li
            key={inv.id}
            className="flex items-center gap-4 py-3 first:pt-0 last:pb-0"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium truncate">{inv.email}</span>
                <Badge variant="secondary" className="font-normal">
                  {roleLabel(inv.role)}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Invited {formatDistanceToNow(new Date(inv.created_at), { addSuffix: true })}
                {" · "}
                Expires {formatDistanceToNow(new Date(inv.expires_at), { addSuffix: true })}
              </p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setConfirmRevoke(inv.id)}
            >
              {t("collab.invite.revoke")}
            </Button>
          </li>
        ))}
      </ul>

      <AlertDialog
        open={confirmRevoke !== null}
        onOpenChange={(o) => !o && setConfirmRevoke(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("collab.invite.revoke.confirm.title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("collab.invite.revoke.confirm.body")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmRevoke) revokeMut.mutate(confirmRevoke);
                setConfirmRevoke(null);
              }}
            >
              {t("collab.invite.revoke")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
