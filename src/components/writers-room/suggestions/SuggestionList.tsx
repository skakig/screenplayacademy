import { Skeleton } from "@/components/ui/skeleton";
import { t } from "@/lib/i18n/t";
import type { SceneOption } from "@/lib/comments";
import type { SuggestionRow } from "@/lib/suggestions";
import type { ProjectRole } from "@/components/writers-room/roles";

import { SuggestionCard } from "./SuggestionCard";

interface Props {
  projectId: string;
  suggestions: SuggestionRow[] | undefined;
  scenes: SceneOption[] | undefined;
  isLoading: boolean;
  isError: boolean;
  emptyMessage: string;
  role: ProjectRole | null;
  currentUserId: string | null;
}

export function SuggestionList({
  projectId,
  suggestions,
  scenes,
  isLoading,
  isError,
  emptyMessage,
  role,
  currentUserId,
}: Props) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
  if (isError) {
    return (
      <p className="text-sm text-destructive">
        {t("collab.suggestions.errorLoad")}
      </p>
    );
  }
  if (!suggestions || suggestions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">
        {emptyMessage}
      </p>
    );
  }
  return (
    <div className="space-y-3">
      {suggestions.map((s) => (
        <SuggestionCard
          key={s.id}
          projectId={projectId}
          suggestion={s}
          scenes={scenes}
          role={role}
          currentUserId={currentUserId}
        />
      ))}
    </div>
  );
}
