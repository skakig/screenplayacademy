import { formatDistanceToNow } from "date-fns";

import { Badge } from "@/components/ui/badge";
import { t } from "@/lib/i18n/t";
import type { CommentRow } from "@/lib/comments";

interface Props {
  comment: CommentRow;
  currentUserId: string | null;
  /** Optional trailing slot for action buttons. */
  actions?: React.ReactNode;
  /** Optional header slot (e.g. anchor label) rendered above the body. */
  header?: React.ReactNode;
  compact?: boolean;
}

export function CommentCard({
  comment,
  currentUserId,
  actions,
  header,
  compact,
}: Props) {
  const isSelf = comment.author_id === currentUserId;
  const authorLabel = isSelf
    ? t("collab.member.you")
    : `Member ${comment.author_id.slice(0, 6)}`;

  return (
    <div
      className={
        compact
          ? "py-3 pl-4 border-l border-border/60"
          : "rounded-md border border-border/60 bg-card/40 p-4"
      }
    >
      {header && <div className="mb-2">{header}</div>}
      <div className="flex items-center gap-2 flex-wrap mb-1.5">
        <span className="text-sm font-medium">{authorLabel}</span>
        <span className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(comment.created_at), {
            addSuffix: true,
          })}
        </span>
        {comment.status === "resolved" && (
          <Badge variant="outline" className="font-normal">
            {t("collab.comments.resolvedBy")}
          </Badge>
        )}
      </div>
      <p className="text-sm whitespace-pre-wrap leading-relaxed text-foreground/90">
        {comment.body}
      </p>
      {actions && (
        <div className="mt-3 flex items-center gap-1.5">{actions}</div>
      )}
    </div>
  );
}
