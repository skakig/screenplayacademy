import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy } from "lucide-react";
import { t } from "@/lib/i18n/t";
import type { I18nKey } from "@/lib/i18n/keys";
import type { ArenaAwardRow } from "@/lib/arena";

interface Props {
  awards: ArenaAwardRow[];
}

export function AwardsWall({ awards }: Props) {
  return (
    <Card className="p-6 bg-card/60">
      <h3 className="font-display text-lg font-semibold mb-3 flex items-center gap-2">
        <Trophy className="h-4 w-4 text-amber-500" />
        {t("arena.section.awards")}
      </h3>
      {awards.length === 0 ? (
        <p className="text-sm italic text-muted-foreground">
          {t("arena.empty.awards")}
        </p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {awards.map((a) => (
            <li
              key={a.id}
              className="border border-border/60 rounded-lg p-3 bg-background/50 flex items-center justify-between gap-2"
            >
              <div className="min-w-0">
                <div className="font-medium truncate">
                  {a.title ?? t(`arena.awards.${a.award_type}` as I18nKey)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(a.created_at).toLocaleDateString()}
                </div>
              </div>
              <Badge variant="secondary" className="shrink-0">
                {t(`arena.awards.${a.award_type}` as I18nKey)}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
