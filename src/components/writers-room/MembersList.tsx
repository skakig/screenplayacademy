import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { RoleSelect } from "./RoleSelect";
import {
  type ProjectRole,
  roleLabel,
} from "./roles";
import { t } from "@/lib/i18n/t";
import {
  fetchMembers,
  removeMember,
  updateMemberRole,
  wrKeys,
} from "@/lib/collab";

interface Props {
  projectId: string;
  currentUserId: string | null;
  isOwner: boolean;
}

export function MembersList({ projectId, currentUserId, isOwner }: Props) {
  const qc = useQueryClient();
  const { data: members, isLoading } = useQuery({
    queryKey: wrKeys.members(projectId),
    queryFn: () => fetchMembers(projectId),
  });

  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const removeMut = useMutation({
    mutationFn: (memberId: string) => removeMember(memberId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: wrKeys.members(projectId) });
      toast.success("Member removed");
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Couldn't remove member"),
  });

  const roleMut = useMutation({
    mutationFn: ({
      memberId,
      role,
    }: {
      memberId: string;
      role: Exclude<ProjectRole, "owner">;
    }) => updateMemberRole(memberId, role),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: wrKeys.members(projectId) });
      toast.success("Role updated");
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Couldn't update role"),
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  if (!members || members.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">
        {t("collab.members.empty")}
      </p>
    );
  }

  const ownerCount = members.filter((m) => m.role === "owner").length;

  return (
    <TooltipProvider delayDuration={150}>
      <ul className="divide-y divide-border/60">
        {members.map((m) => {
          const isSelf = m.user_id === currentUserId;
          const isOwnerRow = m.role === "owner";
          const lastOwner = isOwnerRow && ownerCount <= 1;
          const canManage = isOwner && !isOwnerRow;

          return (
            <li
              key={m.id}
              className="flex items-center gap-4 py-3 first:pt-0 last:pb-0"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium truncate">
                    {isSelf
                      ? t("collab.member.you")
                      : `Member ${m.user_id.slice(0, 8)}`}
                  </span>
                  <Badge variant="secondary" className="font-normal">
                    {roleLabel(m.role)}
                  </Badge>
                  {m.status !== "active" && (
                    <Badge variant="outline" className="font-normal">
                      {m.status}
                    </Badge>
                  )}
                </div>
                {m.joined_at && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t("collab.member.joined", {
                      when: formatDistanceToNow(new Date(m.joined_at), {
                        addSuffix: true,
                      }),
                    })}
                  </p>
                )}
              </div>

              {canManage ? (
                <div className="flex items-center gap-2">
                  <RoleSelect
                    value={m.role}
                    onChange={(role) =>
                      roleMut.mutate({
                        memberId: m.id,
                        role: role as Exclude<ProjectRole, "owner">,
                      })
                    }
                    disabled={roleMut.isPending}
                    className="w-[160px] h-9"
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setConfirmRemove(m.id)}
                    aria-label={t("collab.member.remove")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ) : isOwner && lastOwner ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled
                      aria-label={t("collab.member.ownerLocked")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    {t("collab.member.ownerLocked")}
                  </TooltipContent>
                </Tooltip>
              ) : null}
            </li>
          );
        })}
      </ul>

      <AlertDialog
        open={confirmRemove !== null}
        onOpenChange={(o) => !o && setConfirmRemove(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("collab.member.remove.confirm.title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("collab.member.remove.confirm.body")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmRemove) removeMut.mutate(confirmRemove);
                setConfirmRemove(null);
              }}
            >
              {t("collab.member.remove")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}
