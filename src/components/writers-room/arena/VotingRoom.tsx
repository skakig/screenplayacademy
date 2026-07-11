import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Vote } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { t } from "@/lib/i18n/t";
import type { I18nKey } from "@/lib/i18n/keys";
import { supabase } from "@/integrations/supabase/client";
import type { ProjectRole } from "@/components/writers-room/roles";
import {
  arenaKeys,
  castArenaVote,
  finalizeArenaRound,
  getProjectMemberIdentities,
  getVotingProgress,
  listMyVotes,
  listVotingEntries,
  type ArenaSessionRow,
  type ArenaVotingEntry,
  type VoteScores,
} from "@/lib/arena";
import { AuthorshipRail } from "./AuthorshipRail";
import {
  NEUTRAL_AUTHORSHIP_COLOR,
  buildAuthorshipPalette,
} from "./authorshipPalette";

interface Props {
  session: ArenaSessionRow;
  role: ProjectRole | null;
  projectId: string;
}

const DEFAULT: VoteScores = {
  originality: 3,
  characterTruth: 3,
  cinematicValue: 3,
  emotionalImpact: 3,
  craft: 3,
};

export function VotingRoom({ session, role, projectId }: Props) {
  const qc = useQueryClient();
  const [uid, setUid] = useState<string | null>(null);
  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null));
  }, []);

  const entriesQ = useQuery({
    queryKey: arenaKeys.votingEntries(session.id),
    queryFn: () => listVotingEntries(session.id),
    refetchInterval: 5000,
  });
  const myVotesQ = useQuery({
    queryKey: arenaKeys.myVotes(session.id),
    queryFn: () => listMyVotes(session.id),
  });
  const progressQ = useQuery({
    queryKey: arenaKeys.progress(session.id),
    queryFn: () => getVotingProgress(session.id),
    refetchInterval: 5000,
  });

  const entries = entriesQ.data ?? [];
  const identityIds = useMemo(
    () =>
      entries
        .map((e) => e.author_id)
        .filter((v): v is string => typeof v === "string"),
    [entries],
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

  const myVotes = useMemo(
    () => new Map((myVotesQ.data ?? []).map((v) => [v.entry_id, v])),
    [myVotesQ.data],
  );

  const canFinalize =
    !!uid && (uid === session.created_by || role === "owner");

  const finalizeM = useMutation({
    mutationFn: () => finalizeArenaRound(session.id),
    onSuccess: () => {
      toast(t("arena.toast.finalized"));
      qc.invalidateQueries({ queryKey: arenaKeys.list(projectId) });
    },
    onError: (e) => toast.error((e as Error).message || t("arena.error.save")),
  });

  return (
    <Card className="p-6 bg-card/60 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-display text-xl font-semibold flex items-center gap-2">
            <Vote className="h-5 w-5 text-primary" />
            {t("arena.voting.title")}
          </h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            {t("arena.voting.body")}
          </p>
        </div>
        {canFinalize && (() => {
          const p = progressQ.data;
          const isEarly =
            !!p &&
            p.eligible_voters > 0 &&
            p.completed_voters < p.eligible_voters;
          return (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm">{t("arena.voting.finalize")}</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {t("arena.voting.finalizeConfirm.title")}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {t("arena.voting.finalizeConfirm.body")}
                    {isEarly && (
                      <span className="mt-2 block text-amber-600 dark:text-amber-400">
                        {t("arena.voting.finalizeConfirm.earlyWarning")}
                      </span>
                    )}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => finalizeM.mutate()}>
                    {t("arena.voting.finalize")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          );
        })()}
      </div>

      {progressQ.data && (
        <div
          data-testid="arena-voting-progress"
          className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground"
        >
          <span>
            {t("arena.voting.progress", {
              completed: String(progressQ.data.completed_voters),
              eligible: String(progressQ.data.eligible_voters),
              entriesVoted: String(progressQ.data.entries_with_votes),
            })}
          </span>
          <span aria-hidden>·</span>
          <span>
            {progressQ.data.current_user_has_voted
              ? t("arena.voting.progressYouVoted")
              : t("arena.voting.progressYouHaventVoted")}
          </span>
        </div>
      )}

      {entries.length === 0 ? (
        <p className="text-sm italic text-muted-foreground">
          {t("arena.voting.noEntries")}
        </p>
      ) : (
        <ul className="space-y-4">
          {entries.map((e) => {
            const blind = e.author_id === null;
            const identity = e.author_id
              ? identitiesQ.data?.get(e.author_id)
              : null;
            const color =
              (e.author_id ? palette.get(e.author_id) : undefined) ??
              NEUTRAL_AUTHORSHIP_COLOR;
            return (
              <EntryCard
                key={e.entry_id}
                entry={e}
                session={session}
                selfId={uid}
                color={color}
                identityName={identity?.display_name ?? ""}
                identityAvatar={identity?.avatar_url ?? null}
                identityRole={null}
                blind={blind}
                existingVote={myVotes.get(e.entry_id) ?? null}
              />
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function EntryCard({
  entry,
  session,
  selfId,
  color,
  identityName,
  identityAvatar,
  identityRole,
  blind,
  existingVote,
}: {
  entry: ArenaVotingEntry;
  session: ArenaSessionRow;
  selfId: string | null;
  color: ReturnType<typeof buildAuthorshipPalette> extends Map<string, infer C>
    ? C
    : never;
  identityName: string;
  identityAvatar: string | null;
  identityRole: string | null;
  blind: boolean;
  existingVote: {
    score_originality: number;
    score_character_truth: number;
    score_cinematic_value: number;
    score_emotional_impact: number;
    score_craft: number;
    comment: string | null;
  } | null;
}) {
  const qc = useQueryClient();
  const isMine = !blind && entry.author_id === selfId;
  const [scores, setScores] = useState<VoteScores>(
    existingVote
      ? {
          originality: existingVote.score_originality,
          characterTruth: existingVote.score_character_truth,
          cinematicValue: existingVote.score_cinematic_value,
          emotionalImpact: existingVote.score_emotional_impact,
          craft: existingVote.score_craft,
        }
      : DEFAULT,
  );
  const [comment, setComment] = useState(existingVote?.comment ?? "");

  const voteM = useMutation({
    mutationFn: () =>
      castArenaVote({
        session,
        entryId: entry.entry_id,
        scores,
        comment,
      }),
    onSuccess: () => {
      toast(t("arena.toast.voted"));
      qc.invalidateQueries({ queryKey: arenaKeys.myVotes(session.id) });
    },
    onError: (e) => toast.error((e as Error).message || t("arena.error.save")),
  });

  return (
    <li>
      <AuthorshipRail
        color={color}
        displayName={identityName}
        avatarUrl={identityAvatar}
        role={identityRole}
        anonymousLabel={entry.anonymous_label}
        blind={blind}
        isSelf={isMine}
        meta={
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {existingVote ? t("arena.voting.voted") : t("arena.voting.notVoted")}
          </span>
        }
      >
        <div className="mb-1 font-medium text-sm">
          {entry.title || "Untitled entry"}
        </div>
        <p className="text-sm whitespace-pre-wrap font-mono bg-muted/40 p-3 rounded max-h-72 overflow-y-auto">
          {entry.body}
        </p>

        {!isMine && (
          <div className="mt-4 space-y-3">
            {(
              [
                ["originality", "arena.voting.score.originality"],
                ["characterTruth", "arena.voting.score.characterTruth"],
                ["cinematicValue", "arena.voting.score.cinematicValue"],
                ["emotionalImpact", "arena.voting.score.emotionalImpact"],
                ["craft", "arena.voting.score.craft"],
              ] as [keyof VoteScores, I18nKey][]
            ).map(([key, label]) => (
              <div key={key} className="flex items-center gap-3">
                <div className="w-40 text-xs text-muted-foreground">
                  {t(label)}
                </div>
                <Slider
                  value={[scores[key]]}
                  onValueChange={([v]) => setScores({ ...scores, [key]: v })}
                  min={1}
                  max={5}
                  step={1}
                  className="flex-1"
                />
                <div className="w-6 text-right text-sm font-mono">
                  {scores[key]}
                </div>
              </div>
            ))}
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t("arena.voting.commentPlaceholder")}
              rows={2}
              maxLength={1000}
            />
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={() => voteM.mutate()}
                disabled={voteM.isPending}
              >
                {existingVote ? t("arena.voting.recast") : t("arena.voting.cast")}
              </Button>
            </div>
          </div>
        )}
      </AuthorshipRail>
    </li>
  );
}

