import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Users, Play } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n/t";
import type { I18nKey } from "@/lib/i18n/keys";
import { supabase } from "@/integrations/supabase/client";
import type { ProjectRole } from "@/components/writers-room/roles";
import {
  arenaKeys,
  joinArenaSession,
  leaveArenaSession,
  listParticipants,
  startArenaRound,
  type ArenaSessionRow,
} from "@/lib/arena";

interface Props {
  session: ArenaSessionRow;
  role: ProjectRole | null;
  projectId: string;
}

export function RoundLobby({ session, role, projectId }: Props) {
  const qc = useQueryClient();
  const [uid, setUid] = useState<string | null>(null);
  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null));
  }, []);

  const partsQ = useQuery({
    queryKey: arenaKeys.participants(session.id),
    queryFn: () => listParticipants(session.id),
    refetchInterval: 3000,
  });

  const joined = !!(partsQ.data ?? []).find((p) => p.user_id === uid);
  const canStart =
    !!uid && (uid === session.created_by || role === "owner");

  const joinM = useMutation({
    mutationFn: () => joinArenaSession(session, "writer"),
    onSuccess: () => {
      toast(t("arena.toast.joined"));
      qc.invalidateQueries({ queryKey: arenaKeys.participants(session.id) });
    },
    onError: () => toast.error(t("arena.error.save")),
  });
  const leaveM = useMutation({
    mutationFn: () => leaveArenaSession(session.id),
    onSuccess: () => {
      toast(t("arena.toast.left"));
      qc.invalidateQueries({ queryKey: arenaKeys.participants(session.id) });
    },
    onError: () => toast.error(t("arena.error.save")),
  });
  const startM = useMutation({
    mutationFn: () => startArenaRound(session.id),
    onSuccess: () => {
      toast(t("arena.toast.started"));
      qc.invalidateQueries({ queryKey: arenaKeys.list(projectId) });
    },
    onError: (e) => toast.error((e as Error).message || t("arena.error.save")),
  });

  return (
    <Card className="p-6 bg-card/60 space-y-4">
      <div>
        <div className="text-xs text-muted-foreground uppercase tracking-wider">
          {t(`arena.mode.${session.mode}` as I18nKey)}
        </div>
        <h3 className="font-display text-2xl font-semibold mt-1">
          {session.title}
        </h3>
        <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">
          {session.prompt}
        </p>
      </div>

      <div className="border-t border-border/40 pt-4">
        <div className="flex items-center gap-2 text-sm font-medium mb-2">
          <Users className="h-4 w-4" />
          {t("arena.lobby.participants")} ({partsQ.data?.length ?? 0})
        </div>
        <ParticipantList sessionId={session.id} selfId={uid} />
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border/40 pt-4 flex-wrap">
        <p className="text-xs text-muted-foreground max-w-md">
          {t("arena.lobby.body")}
        </p>
        <div className="flex items-center gap-2">
          {joined ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => leaveM.mutate()}
              disabled={leaveM.isPending}
            >
              {t("arena.lobby.leave")}
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => joinM.mutate()}
              disabled={joinM.isPending}
            >
              {t("arena.lobby.join")}
            </Button>
          )}
          {canStart && (
            <Button
              size="sm"
              variant="default"
              onClick={() => startM.mutate()}
              disabled={startM.isPending || (partsQ.data?.length ?? 0) === 0}
            >
              <Play className="h-4 w-4 mr-1.5" />
              {t("arena.lobby.start")}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

function ParticipantList({
  sessionId,
  selfId,
}: {
  sessionId: string;
  selfId: string | null;
}) {
  const { data } = useQuery({
    queryKey: arenaKeys.participants(sessionId),
    queryFn: () => listParticipants(sessionId),
  });
  const list = data ?? [];
  if (list.length === 0) {
    return (
      <p className="text-xs italic text-muted-foreground">No one yet.</p>
    );
  }
  return (
    <ul className="flex flex-wrap gap-2">
      {list.map((p) => (
        <li
          key={p.id}
          className="text-xs rounded-full bg-muted/60 px-2 py-1 border border-border/40"
        >
          {p.user_id === selfId ? "You" : p.user_id.slice(0, 8)}
          <span className="ml-1 text-muted-foreground">· {p.role}</span>
        </li>
      ))}
    </ul>
  );
}
