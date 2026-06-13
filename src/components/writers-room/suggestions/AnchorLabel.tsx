import { AlignLeft, FileText, Film } from "lucide-react";

import { t } from "@/lib/i18n/t";
import type { SceneOption } from "@/lib/comments";
import type { SuggestionRow } from "@/lib/suggestions";

interface Props {
  suggestion: SuggestionRow;
  scenes: SceneOption[] | undefined;
}

export function SuggestionAnchorLabel({ suggestion, scenes }: Props) {
  if (suggestion.script_block_id) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <AlignLeft className="h-3 w-3" />
        {t("collab.suggestions.blockAnchor")}
      </span>
    );
  }
  if (suggestion.scene_id) {
    const scene = scenes?.find((s) => s.id === suggestion.scene_id);
    const heading = (scene?.scene_heading || scene?.title || "").trim();
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Film className="h-3 w-3" />
        {heading
          ? `${t("collab.suggestions.sceneAnchor")}: ${heading}`
          : t("collab.suggestions.sceneAnchor")}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <FileText className="h-3 w-3" />
      {t("collab.suggestions.projectAnchor")}
    </span>
  );
}
