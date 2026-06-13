import { Badge } from "@/components/ui/badge";
import { t } from "@/lib/i18n/t";
import type { I18nKey } from "@/lib/i18n/keys";
import type { SuggestionSource } from "@/lib/suggestions";

const KEY: Record<SuggestionSource, I18nKey> = {
  human: "collab.suggestionSource.human",
  ai: "collab.suggestionSource.ai",
  import_diagnostic: "collab.suggestionSource.import_diagnostic",
  script_brain: "collab.suggestionSource.script_brain",
  table_read: "collab.suggestionSource.table_read",
};

export function sourceLabel(source: SuggestionSource): string {
  return t(KEY[source]);
}

export function SourceBadge({ source }: { source: SuggestionSource }) {
  return (
    <Badge variant="outline" className="font-normal text-[10px] uppercase tracking-wide">
      {sourceLabel(source)}
    </Badge>
  );
}
