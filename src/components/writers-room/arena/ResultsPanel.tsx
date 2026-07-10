import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trophy, Sparkles, Send } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { t } from "@/lib/i18n/t";
import type { I18nKey } from "@/lib/i18n/keys";
import type { ProjectRole } from "@/components/writers-room/roles";
import {
  ARENA_AWARD_TYPES,
  arenaKeys,
  awardArenaEntry,
  computeEntryScores,
  listEntries,
  listSessionAwards,
  listVotes,
  promoteEntryToSuggestion,
  type ArenaAwardType,
  type ArenaEntryRow,
  type ArenaSessionRow,
} from "@/lib/arena";

interface Props {
  session: ArenaSessionRow;
  role: ProjectRole | null;
  projectId: string;
}

export function ResultsPanel({ session, role, projectId }: Props) {
  const qc = useQueryClient();
  const entriesQ = useQuery({
    queryKey: arenaKeys.entries(session.id),
    queryFn: () => listEntries(session.id),
  });
  const votesQ = useQuery({
    queryKey: arenaKeys.votes(session.id),
    queryFn: () => listVotes(session.id),
  });
  const awardsQ = useQuery({
    queryKey: arenaKeys.sessionAwards(session.id),
    queryFn: () => listSessionAwards(session.id),
  });

  const submitted = useMemo(
    () => (entriesQ.data ?? []).filter((e) => e.status === "submitted"),
    [entriesQ.data],
  );
  const scores = useMemo(
    () => computeEntryScores(votesQ.data ?? []),
    [votesQ.data],
  );
  const ranked = useMemo(() => {
    return [...submitted].sort((a, b) => {
      const av = scores.get(a.id)?.average ?? 0;
      const bv = scores.get(b.id)?.average ?? 0;
      return bv - av;
    });
  }, [submitted, scores]);

  const winner = ranked[0];
  const isHostOrOwner = role === "owner"; // extra grants happen server-side too

  return (
    <Card className="p-6 bg-card/60 space-y-4">
      <div className="flex items-center gap-2">
        <Trophy className="h-5 w-5 text-amber-500" />
        <h3 className="font-display text-xl font-semibold">
          {t("arena.results.title")} · {session.title}
        </h3>
      </div>

      {winner && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4">
          <div className="text-[10px] uppercase tracking-wider text-amber-700 dark:text-amber-400 font-semibold">
            {t("arena.results.winner")}
          </div>
          <div className="font-display text-lg font-semibold mt-1">
            {winner.title || "Untitled entry"}
          </div>
          <div className="text-xs text-muted-foreground">
            {t("arena.voting.byLine", { name: winner.author_id.slice(0, 8) })}
            <span className="mx-1">·</span>
            avg{" "}
            {(scores.get(winner.id)?.average ?? 0).toFixed(1)}
          </div>
          <p className="text-sm whitespace-pre-wrap font-mono bg-background/60 p-3 rounded mt-3 max-h-60 overflow-y-auto">
            {winner.body}
          </p>
        </div>
      )}

      <div className="space-y-3">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          {t("arena.results.runners")}
        </div>
        {ranked.length === 0 ? (
          <p className="text-sm italic text-muted-foreground">
            {t("arena.voting.noEntries")}
          </p>
        ) : (
          <ul className="space-y-3">
            {ranked.map((e, i) => (
              <EntryResultRow
                key={e.id}
                rank={i + 1}
                entry={e}
                session={session}
                average={scores.get(e.id)?.average ?? 0}
                count={scores.get(e.id)?.count ?? 0}
                awarded={
                  (awardsQ.data ?? []).find((a) => a.entry_id === e.id) ?? null
                }
                canAward={isHostOrOwner}
                onChanged={() => {
                  qc.invalidateQueries({ queryKey: arenaKeys.sessionAwards(session.id) });
                  qc.invalidateQueries({ queryKey: arenaKeys.awards(projectId) });
                }}
              />
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

function EntryResultRow({
  rank,
  entry,
  session,
  average,
  count,
  awarded,
  canAward,
  onChanged,
}: {
  rank: number;
  entry: ArenaEntryRow;
  session: ArenaSessionRow;
  average: number;
  count: number;
  awarded: { award_type: ArenaAwardType } | null;
  canAward: boolean;
  onChanged: () => void;
}) {
  const [awardType, setAwardType] = useState<ArenaAwardType>("best_dialogue");
  const [promoted, setPromoted] = useState(false);

  const awardM = useMutation({
    mutationFn: () =>
      awardArenaEntry({
        session,
        entry,
        awardType,
        title: t(`arena.awards.${awardType}` as I18nKey),
      }),
    onSuccess: () => {
      toast(t("arena.toast.awarded"));
      onChanged();
    },
    onError: (e) => toast.error((e as Error).message || t("arena.error.save")),
  });

  const promoteM = useMutation({
    mutationFn: () =>
      promoteEntryToSuggestion({
        session,
        entry,
      }),
    onSuccess: (r) => {
      setPromoted(true);
      toast(
        r.alreadyExisted
          ? t("arena.results.promoted")
          : t("arena.results.promoted"),
      );
    },
    onError: (e) => toast.error((e as Error).message || t("arena.error.save")),
  });

  return (
    <li className="border border-border/60 rounded-lg p-3 bg-background/50">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">#{rank}</div>
          <div className="font-medium truncate">
            {entry.title || "Untitled entry"}
          </div>
          <div className="text-xs text-muted-foreground">
            avg {average.toFixed(1)} · {count} vote{count === 1 ? "" : "s"}
          </div>
        </div>
        {awarded && (
          <Badge variant="secondary">
            {t(`arena.awards.${awarded.award_type}` as I18nKey)}
          </Badge>
        )}
      </div>
      {canAward && (
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <Select
            value={awardType}
            onValueChange={(v) => setAwardType(v as ArenaAwardType)}
          >
            <SelectTrigger className="w-52 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ARENA_AWARD_TYPES.map((a) => (
                <SelectItem key={a} value={a}>
                  {t(`arena.awards.${a}` as I18nKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => awardM.mutate()}
            disabled={awardM.isPending}
          >
            <Sparkles className="h-3.5 w-3.5 mr-1" />
            {t("arena.results.awardCta")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => promoteM.mutate()}
            disabled={promoteM.isPending || promoted}
          >
            <Send className="h-3.5 w-3.5 mr-1" />
            {promoted ? t("arena.results.promoted") : t("arena.results.promote")}
          </Button>
        </div>
      )}
    </li>
  );
}
