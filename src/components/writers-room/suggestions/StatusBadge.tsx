import { Badge } from "@/components/ui/badge";
import { t } from "@/lib/i18n/t";
import type { I18nKey } from "@/lib/i18n/keys";
import type { SuggestionStatus } from "@/lib/suggestions";

const KEY: Record<SuggestionStatus, I18nKey> = {
  open: "collab.suggestionStatus.open",
  accepted: "collab.suggestionStatus.accepted",
  rejected: "collab.suggestionStatus.rejected",
  archived: "collab.suggestionStatus.archived",
};

export function statusLabel(status: SuggestionStatus): string {
  return t(KEY[status]);
}

export function StatusBadge({ status }: { status: SuggestionStatus }) {
  const variant =
    status === "accepted"
      ? "default"
      : status === "rejected"
        ? "secondary"
        : "outline";
  return (
    <Badge variant={variant} className="font-normal">
      {statusLabel(status)}
    </Badge>
  );
}
