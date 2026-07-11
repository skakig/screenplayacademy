import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trophy, Sparkles, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

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
  getProjectMemberIdentities,
  listEntries,
  listSessionAwards,
  listVotes,
  promoteEntryToSuggestion,
  resolveArenaWinners,
  type ArenaAwardType,
  type ArenaEntryRow,
  type ArenaSessionRow,
} from "@/lib/arena";
import { AuthorshipRail } from "./AuthorshipRail";
import {
  NEUTRAL_AUTHORSHIP_COLOR,
  buildAuthorshipPalette,
  type AuthorshipColor,
} from "./authorshipPalette";

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
  const winnersQ = useQuery({
    queryKey: [...arenaKeys.sessionAwards(session.id), "studio_winner"] as const,
    queryFn: () => resolveArenaWinners(session.id),
  });
  const [uid, setUid] = useState<string | null>(null);
  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null));
  }, []);

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

  const identityIds = useMemo(
    () => submitted.map((e) => e.author_id),
    [submitted],
  );
  const identitiesQ = useQuery({
    queryKey: [...arenaKeys.identities(projectId), identityIds],
    queryFn: () => getProjectMemberIdentities(projectId, identityIds),
    enabled: identityIds.length > 0,
  });
  const palette = useMemo(
    () => buildAuthorshipPalette(session.id, identityIds),
    [session.id, identityIds],
  );

  const winner = ranked[0];
  const isHostOrOwner = role === "owner"; // extra grants happen server-side too

  const winnerColor: AuthorshipColor = winner
    ? (palette.get(winner.author_id) ?? NEUTRAL_AUTHORSHIP_COLOR)
    : NEUTRAL_AUTHORSHIP_COLOR;
  const winnerIdentity = winner
    ? identitiesQ.data?.get(winner.author_id)
    : null;

  return (
    <Card className="p-6 bg-card/60 space-y-4">
      <div className="flex items-center gap-2">
        <Trophy className="h-5 w-5 text-amber-500" />
        <h3 className="font-display text-xl font-semibold">
          {t("arena.results.title")} · {session.title}
        </h3>
      </div>

      {winner && (
        <AuthorshipRail
          color={winnerColor}
          displayName={winnerIdentity?.display_name ?? ""}
          avatarUrl={winnerIdentity?.avatar_url ?? null}
          role={null}
          meta={
            <Badge variant="secondary">{t("arena.results.winner")}</Badge>
          }
        >
          <div className="font-display text-lg font-semibold mt-1">
            {winner.title || "Untitled entry"}
          </div>
          <div className="text-xs text-muted-foreground">
            avg {(scores.get(winner.id)?.average ?? 0).toFixed(1)}
          </div>
          <p className="text-sm whitespace-pre-wrap font-mono bg-background/60 p-3 rounded mt-3 max-h-60 overflow-y-auto">
            {winner.body}
          </p>
        </AuthorshipRail>
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
            {ranked.map((e, i) => {
              const color =
                palette.get(e.author_id) ?? NEUTRAL_AUTHORSHIP_COLOR;
              const identity = identitiesQ.data?.get(e.author_id);
              return (
                <EntryResultRow
                  key={e.id}
                  rank={i + 1}
                  entry={e}
                  session={session}
                  average={scores.get(e.id)?.average ?? 0}
                  count={scores.get(e.id)?.count ?? 0}
                  awarded={
                    (awardsQ.data ?? []).find((a) => a.entry_id === e.id) ??
                    null
                  }
                  canAward={isHostOrOwner}
                  color={color}
                  identityName={identity?.display_name ?? ""}
                  identityAvatar={identity?.avatar_url ?? null}
                  onChanged={() => {
                    qc.invalidateQueries({
                      queryKey: arenaKeys.sessionAwards(session.id),
                    });
                    qc.invalidateQueries({
                      queryKey: arenaKeys.awards(projectId),
                    });
                  }}
                />
              );
            })}
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
  color,
  identityName,
  identityAvatar,
  onChanged,
}: {
  rank: number;
  entry: ArenaEntryRow;
  session: ArenaSessionRow;
  average: number;
  count: number;
  awarded: { award_type: ArenaAwardType } | null;
  canAward: boolean;
  color: AuthorshipColor;
  identityName: string;
  identityAvatar: string | null;
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
    <li>
      <AuthorshipRail
        color={color}
        displayName={identityName}
        avatarUrl={identityAvatar}
        role={null}
        meta={
          awarded ? (
            <Badge variant="secondary">
              {t(`arena.awards.${awarded.award_type}` as I18nKey)}
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground">#{rank}</span>
          )
        }
      >
        <div className="min-w-0">
          <div className="font-medium truncate">
            {entry.title || "Untitled entry"}
          </div>
          <div className="text-xs text-muted-foreground">
            avg {average.toFixed(1)} · {count} vote{count === 1 ? "" : "s"}
          </div>
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
      </AuthorshipRail>
    </li>
  );
}

