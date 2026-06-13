import { t } from "@/lib/i18n/t";
import type { SuggestionRow } from "@/lib/suggestions";

function extractText(payload: Record<string, unknown> | null): string | null {
  if (!payload) return null;
  const text = (payload as { text?: unknown }).text;
  if (typeof text === "string" && text.trim().length) return text;
  const summary = (payload as { rewrite_summary?: unknown; summary?: unknown })
    .rewrite_summary;
  if (typeof summary === "string" && summary.trim().length) return summary;
  const sum2 = (payload as { summary?: unknown }).summary;
  if (typeof sum2 === "string" && sum2.trim().length) return sum2;
  return null;
}

export function SuggestionDiff({ suggestion }: { suggestion: SuggestionRow }) {
  const before = extractText(suggestion.before ?? null);
  const after = extractText(suggestion.after ?? null);

  return (
    <div className="grid sm:grid-cols-2 gap-3">
      <div className="rounded-md border border-border/60 bg-muted/30 p-3 space-y-1.5">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {t("collab.suggestions.current")}
        </p>
        {before ? (
          <p className="text-sm whitespace-pre-wrap leading-relaxed text-foreground/80">
            {before}
          </p>
        ) : (
          <p className="text-xs italic text-muted-foreground">—</p>
        )}
      </div>
      <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-1.5">
        <p className="text-[10px] uppercase tracking-wide text-primary/80">
          {t("collab.suggestions.suggested")}
        </p>
        {after ? (
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{after}</p>
        ) : (
          <p className="text-xs italic text-muted-foreground">—</p>
        )}
      </div>
    </div>
  );
}
