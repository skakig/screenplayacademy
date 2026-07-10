import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Clock, Send, StopCircle } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  ARENA_LIMITS,
  advanceArenaRoundIfDue,
  arenaKeys,
  endArenaRound,
  getMyEntry,
  listParticipants,
  saveEntryDraft,
  submitEntry,
  type ArenaSessionRow,
} from "@/lib/arena";

interface Props {
  session: ArenaSessionRow;
  role: ProjectRole | null;
  projectId: string;
}

export function RoundStage({ session, role, projectId }: Props) {
  const qc = useQueryClient();
  const [uid, setUid] = useState<string | null>(null);
  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null));
  }, []);

  const entryQ = useQuery({
    queryKey: [...arenaKeys.entries(session.id), "mine", uid],
    queryFn: () => getMyEntry(session),
    enabled: !!uid,
  });
  const partsQ = useQuery({
    queryKey: arenaKeys.participants(session.id),
    queryFn: () => listParticipants(session.id),
  });

  const meParticipant = (partsQ.data ?? []).find((p) => p.user_id === uid);
  const canWrite = meParticipant?.role === "writer";
  const canEnd =
    !!uid && (uid === session.created_by || role === "owner");

  const [title, setTitle] = useState(entryQ.data?.title ?? "");
  const [body, setBody] = useState(entryQ.data?.body ?? "");
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const dirtyRef = useRef(false);

  useEffect(() => {
    if (entryQ.data) {
      setTitle(entryQ.data.title ?? "");
      setBody(entryQ.data.body ?? "");
    }
  }, [entryQ.data]);

  const saveM = useMutation({
    mutationFn: (patch: { title: string | null; body: string }) =>
      saveEntryDraft(session, patch),
    onSuccess: () => {
      dirtyRef.current = false;
      setSavedAt(Date.now());
      qc.invalidateQueries({ queryKey: arenaKeys.entries(session.id) });
    },
    onError: () => toast.error(t("arena.error.save")),
  });

  const submitM = useMutation({
    mutationFn: async () => {
      if (dirtyRef.current) {
        await saveEntryDraft(session, { title: title || null, body });
      }
      const fresh = await getMyEntry(session);
      if (!fresh) throw new Error("No entry to submit");
      await submitEntry(fresh.id);
    },
    onSuccess: () => {
      toast(t("arena.toast.submitted"));
      qc.invalidateQueries({ queryKey: arenaKeys.entries(session.id) });
    },
    onError: () => toast.error(t("arena.error.save")),
  });

  const endM = useMutation({
    mutationFn: () => endArenaRound(session.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: arenaKeys.list(projectId) });
    },
    onError: (e) => toast.error((e as Error).message || t("arena.error.save")),
  });

  // Debounced autosave
  useEffect(() => {
    if (!canWrite || entryQ.data?.status === "submitted") return;
    dirtyRef.current = true;
    const h = setTimeout(() => {
      if (!dirtyRef.current) return;
      if (!body.trim() && !title.trim()) return;
      saveM.mutate({ title: title || null, body });
    }, 1500);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, body]);

  // Countdown
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);
  const remaining = useMemo(() => {
    if (!session.ends_at) return 0;
    return Math.max(
      0,
      Math.floor((new Date(session.ends_at).getTime() - now) / 1000),
    );
  }, [session.ends_at, now]);
  const timeUp = remaining === 0;

  // Auto-advance when clock runs out (any participant may trigger; RPC is idempotent).
  useEffect(() => {
    if (!timeUp) return;
    const graceMs = (session.submission_grace_seconds ?? 0) * 1000 + 750;
    const timer = setTimeout(() => {
      void advanceArenaRoundIfDue(session.id)
        .catch(() => {})
        .finally(() => qc.invalidateQueries({ queryKey: arenaKeys.list(projectId) }));
    }, graceMs);
    return () => clearTimeout(timer);
  }, [timeUp, session.id, session.submission_grace_seconds, qc, projectId]);

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  const submitted = entryQ.data?.status === "submitted";

  return (
    <Card className="p-6 bg-card/60 space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">
            {t(`arena.mode.${session.mode}` as I18nKey)} ·{" "}
            {t("arena.stage.clockRunning")}
          </div>
          <h3 className="font-display text-2xl font-semibold mt-1">
            {session.title}
          </h3>
          <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">
            {session.prompt}
          </p>
        </div>
        <div className="text-right">
          <div className="inline-flex items-center gap-2 text-2xl font-mono tabular-nums font-semibold">
            <Clock className="h-5 w-5" />
            {mm}:{ss}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {timeUp
              ? t("arena.stage.timeUp")
              : t("arena.stage.timeLeft", { time: `${mm}:${ss}` })}
          </div>
        </div>
      </div>

      {canWrite ? (
        <div className="space-y-3 border-t border-border/40 pt-4">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("arena.entry.titlePlaceholder")}
            maxLength={ARENA_LIMITS.entryTitle}
            disabled={submitted}
          />
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t("arena.entry.bodyPlaceholder")}
            rows={12}
            maxLength={ARENA_LIMITS.entryBody}
            disabled={submitted}
            className="font-mono text-sm"
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {saveM.isPending
                ? t("arena.entry.saving")
                : savedAt
                  ? t("arena.entry.saved")
                  : ""}
            </span>
            <span>{body.length} / {ARENA_LIMITS.entryBody}</span>
          </div>
          <div className="flex items-center justify-end gap-2">
            {submitted ? (
              <span className="text-xs font-medium text-emerald-600">
                {t("arena.entry.submitted")}
              </span>
            ) : (
              <Button
                onClick={() => submitM.mutate()}
                disabled={submitM.isPending || !body.trim()}
              >
                <Send className="h-4 w-4 mr-1.5" />
                {t("arena.entry.submit")}
              </Button>
            )}
          </div>
        </div>
      ) : (
        <p className="text-sm italic text-muted-foreground border-t border-border/40 pt-4">
          {t("arena.entry.notWriter")}
        </p>
      )}

      {canEnd && (
        <div className="border-t border-border/40 pt-3 flex justify-end">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm">
                <StopCircle className="h-4 w-4 mr-1.5" />
                {t("arena.stage.endEarly")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {t("arena.stage.endConfirm.title")}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {t("arena.stage.endConfirm.body")}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => endM.mutate()}>
                  {t("arena.stage.endEarly")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </Card>
  );
}
