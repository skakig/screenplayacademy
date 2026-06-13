import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, CornerDownRight, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n/t";
import {
  commentKeys,
  setCommentStatus,
  type CommentRow,
} from "@/lib/comments";
import type { ProjectRole } from "@/components/writers-room/roles";
import {
  canCreateComment,
  canResolveComment,
} from "@/components/writers-room/permissions";
import type { SceneOption } from "@/lib/comments";

import { CommentCard } from "./CommentCard";
import { CommentComposer } from "./CommentComposer";
import { AnchorLabel } from "./AnchorLabel";

interface Props {
  projectId: string;
  root: CommentRow;
  replies: CommentRow[];
  scenes: SceneOption[] | undefined;
  currentUserId: string | null;
  role: ProjectRole | null;
}

export function CommentThread({
  projectId,
  root,
  replies,
  scenes,
  currentUserId,
  role,
}: Props) {
  const qc = useQueryClient();
  const [replying, setReplying] = useState(false);

  const statusMut = useMutation({
    mutationFn: (next: "open" | "resolved") =>
      setCommentStatus(root.id, next),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: commentKeys.all(projectId) });
    },
    onError: (e: unknown) =>
      toast.error(
        e instanceof Error ? e.message : t("collab.comments.errorSave"),
      ),
  });

  const canReply = canCreateComment(role);
  const canResolve = canResolveComment(role);
  const isResolved = root.status === "resolved";

  const rootActions = (
    <>
      {canReply && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setReplying((r) => !r)}
          className="h-8"
        >
          <CornerDownRight className="h-3.5 w-3.5 mr-1.5" />
          {t("collab.comments.reply")}
        </Button>
      )}
      {canResolve && !isResolved && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => statusMut.mutate("resolved")}
          disabled={statusMut.isPending}
          className="h-8"
        >
          <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
          {t("collab.comments.resolve")}
        </Button>
      )}
      {canResolve && isResolved && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => statusMut.mutate("open")}
          disabled={statusMut.isPending}
          className="h-8"
        >
          <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
          {t("collab.comments.reopen")}
        </Button>
      )}
    </>
  );

  return (
    <div className="space-y-3">
      <CommentCard
        comment={root}
        currentUserId={currentUserId}
        header={<AnchorLabel comment={root} scenes={scenes} />}
        actions={rootActions}
      />

      {replies.length > 0 && (
        <div className="ml-4 space-y-2">
          {replies.map((reply) => (
            <CommentCard
              key={reply.id}
              comment={reply}
              currentUserId={currentUserId}
              compact
            />
          ))}
        </div>
      )}

      {replying && canReply && (
        <div className="ml-4 rounded-md border border-border/60 bg-background/40 p-3">
          <CommentComposer
            projectId={projectId}
            parent={root}
            onSubmitted={() => setReplying(false)}
            onCancel={() => setReplying(false)}
          />
        </div>
      )}
    </div>
  );
}
