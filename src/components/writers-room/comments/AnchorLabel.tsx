import { FileText, Film, AlignLeft } from "lucide-react";

import { t } from "@/lib/i18n/t";
import type { CommentRow } from "@/lib/comments";
import type { SceneOption } from "@/lib/comments";

interface Props {
  comment: CommentRow;
  scenes: SceneOption[] | undefined;
}

export function AnchorLabel({ comment, scenes }: Props) {
  if (comment.script_block_id) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <AlignLeft className="h-3 w-3" />
        {t("collab.comments.blockAnchor")}
      </span>
    );
  }
  if (comment.scene_id) {
    const scene = scenes?.find((s) => s.id === comment.scene_id);
    const heading = (scene?.scene_heading || scene?.title || "").trim();
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Film className="h-3 w-3" />
        {heading
          ? `${t("collab.comments.sceneAnchor")}: ${heading}`
          : t("collab.comments.sceneAnchor")}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <FileText className="h-3 w-3" />
      {t("collab.comments.projectAnchor")}
    </span>
  );
}
