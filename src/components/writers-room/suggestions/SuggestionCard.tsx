import { useState } from "react";
import { formatDistanceToNow } from "date-fns";

import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n/t";
import type { SceneOption } from "@/lib/comments";
import type { SuggestionRow } from "@/lib/suggestions";
import type { ProjectRole } from "@/components/writers-room/roles";

import { SuggestionAnchorLabel } from "./AnchorLabel";
import { SourceBadge, sourceLabel } from "./SourceBadge";
import { StatusBadge } from "./StatusBadge";
import { suggestionTypeLabel } from "./SuggestionTypeLabel";
import { SuggestionDetail } from "./SuggestionDetail";

interface Props {
  projectId: string;
  suggestion: SuggestionRow;
  scenes: SceneOption[] | undefined;
  role: ProjectRole | null;
  currentUserId: string | null;
}

export function SuggestionCard({
  projectId,
  suggestion,
  scenes,
  role,
  currentUserId,
}: Props) {
  const [open, setOpen] = useState(false);

  const isSelf = suggestion.author_id === currentUserId;
  const authorLabel = !suggestion.author_id
    ? sourceLabel(suggestion.source)
    : isSelf
      ? t("collab.member.you")
      : `Member ${suggestion.author_id.slice(0, 6)}`;

  const titleText =
    suggestion.title?.trim() ||
    suggestionTypeLabel(suggestion.suggestion_type) ||
    t("collab.suggestions.noTitle");

  return (
    <>
      <article className="rounded-md border border-border/60 bg-card/40 p-4 space-y-3">
        <header className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0 space-y-1">
            <h4 className="font-display text-base font-medium leading-snug">
              {titleText}
            </h4>
            <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
              <span>{authorLabel}</span>
              <span>·</span>
              <span>
                {formatDistanceToNow(new Date(suggestion.created_at), {
                  addSuffix: true,
                })}
              </span>
              <span>·</span>
              <span>{suggestionTypeLabel(suggestion.suggestion_type)}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <SourceBadge source={suggestion.source} />
            <StatusBadge status={suggestion.status} />
          </div>
        </header>

        <SuggestionAnchorLabel suggestion={suggestion} scenes={scenes} />

        {suggestion.rationale && (
          <p className="text-sm text-foreground/80 leading-relaxed line-clamp-3 whitespace-pre-wrap">
            {suggestion.rationale}
          </p>
        )}

        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
            {t("collab.suggestions.viewDetails")}
          </Button>
        </div>
      </article>

      <SuggestionDetail
        projectId={projectId}
        suggestion={suggestion}
        scenes={scenes}
        role={role}
        currentUserId={currentUserId}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
