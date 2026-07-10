import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trophy, Clock, Plus, Flag } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { t } from "@/lib/i18n/t";
import type { I18nKey } from "@/lib/i18n/keys";
import type { ProjectRole } from "@/components/writers-room/roles";
import {
  advanceArenaRoundIfDue,
  arenaKeys,
  archiveArenaSession,
  listArenaSessions,
  listProjectAwards,
  type ArenaSessionRow,
  type ArenaStatus,
} from "@/lib/arena";

import { CreateRoundDialog } from "./CreateRoundDialog";
import { RoundStage } from "./RoundStage";
import { VotingRoom } from "./VotingRoom";
import { ResultsPanel } from "./ResultsPanel";
import { RoundLobby } from "./RoundLobby";
import { AwardsWall } from "./AwardsWall";

interface Props {
  projectId: string;
  role: ProjectRole | null;
}

const HOST_ROLES: ProjectRole[] = [
  "owner",
  "co_writer",
  "editor",
  "producer",
  "assistant",
];

export function ArenaPanel({ projectId, role }: Props) {
  const [createOpen, setCreateOpen] = useState(false);
  const qc = useQueryClient();

  const sessionsQ = useQuery({
    queryKey: arenaKeys.list(projectId),
    queryFn: () => listArenaSessions(projectId),
    refetchInterval: 5000,
  });

  const awardsQ = useQuery({
    queryKey: arenaKeys.awards(projectId),
    queryFn: () => listProjectAwards(projectId),
  });

  const sessions = sessionsQ.data ?? [];
  const active = sessions.find((s) =>
    (["open", "running", "voting"] as ArenaStatus[]).includes(s.status),
  );
  const complete = sessions.filter((s) => s.status === "complete");

  // Auto-advance running rounds whose clock expired.
  useEffect(() => {
    if (!active || active.status !== "running") return;
    if (!active.ends_at) return;
    const dueMs =
      new Date(active.ends_at).getTime() +
      (active.submission_grace_seconds ?? 0) * 1000 -
      Date.now();
    if (dueMs > 15_000) return;
    const timer = setTimeout(
      () => {
        void advanceArenaRoundIfDue(active.id)
          .catch(() => {})
          .finally(() => qc.invalidateQueries({ queryKey: arenaKeys.list(projectId) }));
      },
      Math.max(0, dueMs + 500),
    );
    return () => clearTimeout(timer);
  }, [active, projectId, qc]);

  const archiveM = useMutation({
    mutationFn: (id: string) => archiveArenaSession(id),
    onSuccess: () => {
      toast(t("arena.toast.archived"));
      qc.invalidateQueries({ queryKey: arenaKeys.list(projectId) });
    },
    onError: () => toast.error(t("arena.error.save")),
  });

  const canHost = !!role && HOST_ROLES.includes(role);

  return (
    <div className="space-y-6">
      <Card className="p-6 bg-card/60">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" />
              <h2 className="font-display text-xl font-semibold tracking-tight">
                {t("arena.title")}
              </h2>
              <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-700 dark:text-amber-400">
                {t("arena.badge.experimental")}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              {t("arena.subtitle")}
            </p>
          </div>
          {canHost && !active && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              {t("arena.create.cta")}
            </Button>
          )}
        </div>
      </Card>

      {sessionsQ.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : active ? (
        <ActiveRoundSection session={active} role={role} projectId={projectId} />
      ) : sessions.length === 0 ? (
        <Card className="p-10 text-center bg-card/40">
          <p className="text-sm text-muted-foreground italic">
            {t("arena.empty.rounds")}
          </p>
        </Card>
      ) : null}

      {complete.length > 0 && (
        <Card className="p-6 bg-card/60">
          <h3 className="font-display text-lg font-semibold mb-3 flex items-center gap-2">
            <Flag className="h-4 w-4 text-muted-foreground" />
            {t("arena.section.past")}
          </h3>
          <ul className="space-y-2">
            {complete.slice(0, 10).map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-3 text-sm border-b border-border/40 pb-2 last:border-b-0"
              >
                <div className="min-w-0">
                  <div className="font-medium truncate">{s.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {t(`arena.mode.${s.mode}` as I18nKey)}
                    <span className="mx-1">·</span>
                    {new Date(s.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px]">
                    {t(`arena.status.${s.status}` as I18nKey)}
                  </Badge>
                  {canHost && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => archiveM.mutate(s.id)}
                    >
                      Archive
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <AwardsWall awards={awardsQ.data ?? []} />

      {canHost && (
        <CreateRoundDialog
          projectId={projectId}
          open={createOpen}
          onOpenChange={setCreateOpen}
        />
      )}
    </div>
  );
}

function ActiveRoundSection({
  session,
  role,
  projectId,
}: {
  session: ArenaSessionRow;
  role: ProjectRole | null;
  projectId: string;
}) {
  return useMemo(() => {
    if (session.status === "open") {
      return <RoundLobby session={session} role={role} projectId={projectId} />;
    }
    if (session.status === "running") {
      return <RoundStage session={session} role={role} projectId={projectId} />;
    }
    if (session.status === "voting") {
      return <VotingRoom session={session} role={role} projectId={projectId} />;
    }
    return <ResultsPanel session={session} role={role} projectId={projectId} />;
  }, [session, role, projectId]);
}

// Small clock badge used inside the active card
export function ArenaClockBadge({
  endsAt,
  running,
}: {
  endsAt: string | null;
  running: boolean;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, [running]);
  if (!endsAt) return null;
  const remaining = Math.max(0, Math.floor((new Date(endsAt).getTime() - now) / 1000));
  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-mono tabular-nums">
      <Clock className="h-3.5 w-3.5" />
      {mm}:{ss}
    </span>
  );
}
