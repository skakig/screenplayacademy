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
  listEntries,
  listVotes,
  type ArenaEntryRow,
  type ArenaSessionRow,
  type VoteScores,
} from "@/lib/arena";

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
    queryKey: arenaKeys.entries(session.id),
    queryFn: () => listEntries(session.id),
  });
  const votesQ = useQuery({
    queryKey: arenaKeys.votes(session.id),
    queryFn: () => listVotes(session.id),
    refetchInterval: 4000,
  });

  const submitted = useMemo(
    () => (entriesQ.data ?? []).filter((e) => e.status === "submitted"),
    [entriesQ.data],
  );

  const myVotes = useMemo(
    () =>
      new Map(
        (votesQ.data ?? [])
          .filter((v) => v.voter_id === uid)
          .map((v) => [v.entry_id, v]),
      ),
    [votesQ.data, uid],
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
        {canFinalize && (
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
        )}
      </div>

      {submitted.length === 0 ? (
        <p className="text-sm italic text-muted-foreground">
          {t("arena.voting.noEntries")}
        </p>
      ) : (
        <ul className="space-y-4">
          {submitted.map((e) => (
            <EntryCard
              key={e.id}
              entry={e}
              session={session}
              selfId={uid}
              existingVote={myVotes.get(e.id) ?? null}
            />
          ))}
        </ul>
      )}
    </Card>
  );
}

function EntryCard({
  entry,
  session,
  selfId,
  existingVote,
}: {
  entry: ArenaEntryRow;
  session: ArenaSessionRow;
  selfId: string | null;
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
  const isMine = entry.author_id === selfId;
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
        entryId: entry.id,
        scores,
        comment,
      }),
    onSuccess: () => {
      toast(t("arena.toast.voted"));
      qc.invalidateQueries({ queryKey: arenaKeys.votes(session.id) });
    },
    onError: (e) => toast.error((e as Error).message || t("arena.error.save")),
  });

  return (
    <li className="border border-border/60 rounded-lg p-4 bg-background/50">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div>
          <div className="font-medium">
            {entry.title || "Untitled entry"}
          </div>
          <div className="text-xs text-muted-foreground">
            {isMine
              ? t("arena.voting.selfEntry")
              : t("arena.voting.byLine", {
                  name: entry.author_id.slice(0, 8),
                })}
          </div>
        </div>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {existingVote ? t("arena.voting.voted") : t("arena.voting.notVoted")}
        </span>
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
    </li>
  );
}
