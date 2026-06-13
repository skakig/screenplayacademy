import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { Lock } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n/t";
import type { SceneOption } from "@/lib/comments";
import type { ProjectRole } from "@/components/writers-room/roles";
import {
  acceptSuggestion,
  archiveSuggestion,
  isApplyableType,
  isNoteType,
  rejectSuggestion,
  suggestionKeys,
  SuggestionLockedError,
  SuggestionTargetMissingError,
  type SuggestionRow,
} from "@/lib/suggestions";
import {
  canAcceptSuggestion,
  canArchiveSuggestion,
  canRejectSuggestion,
} from "@/components/writers-room/permissions";

import { SuggestionAnchorLabel } from "./AnchorLabel";
import { SourceBadge, sourceLabel } from "./SourceBadge";
import { StatusBadge } from "./StatusBadge";
import { SuggestionDiff } from "./SuggestionDiff";
import { suggestionTypeLabel } from "./SuggestionTypeLabel";

interface Props {
  projectId: string;
  suggestion: SuggestionRow;
  scenes: SceneOption[] | undefined;
  role: ProjectRole | null;
  currentUserId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Confirm = "accept" | "reject" | "archive" | null;

export function SuggestionDetail({
  projectId,
  suggestion,
  scenes,
  role,
  currentUserId,
  open,
  onOpenChange,
}: Props) {
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState<Confirm>(null);

  const isOpen = suggestion.status === "open";
  const canAccept = isOpen && canAcceptSuggestion(role);
  const canReject =
    isOpen && canRejectSuggestion(role, suggestion, currentUserId);
  const canArchive = canArchiveSuggestion(role) && suggestion.status !== "archived";

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: suggestionKeys.all(projectId) });

  const acceptMut = useMutation({
    mutationFn: () => acceptSuggestion(suggestion),
    onSuccess: (res) => {
      invalidate();
      toast.success(
        res.appliedToCanonical
          ? t("collab.suggestions.appliedNotice")
          : t("collab.suggestions.acceptedToast"),
      );
      onOpenChange(false);
    },
    onError: (e: unknown) => {
      if (e instanceof SuggestionLockedError) {
        toast.error(
          t("collab.suggestions.errorLocked", {
            name: `Member ${e.lockedById.slice(0, 6)}`,
          }),
        );
        return;
      }
      if (e instanceof SuggestionTargetMissingError) {
        toast.error(t("collab.suggestions.targetMissing"));
        return;
      }
      toast.error(
        e instanceof Error ? e.message : t("collab.suggestions.errorSave"),
      );
    },
  });

  const rejectMut = useMutation({
    mutationFn: () => rejectSuggestion(suggestion.id),
    onSuccess: () => {
      invalidate();
      toast.success(t("collab.suggestions.rejectedToast"));
      onOpenChange(false);
    },
    onError: (e: unknown) =>
      toast.error(
        e instanceof Error ? e.message : t("collab.suggestions.errorSave"),
      ),
  });

  const archiveMut = useMutation({
    mutationFn: () => archiveSuggestion(suggestion.id),
    onSuccess: () => {
      invalidate();
      toast.success(t("collab.suggestions.archivedToast"));
      onOpenChange(false);
    },
    onError: (e: unknown) =>
      toast.error(
        e instanceof Error ? e.message : t("collab.suggestions.errorSave"),
      ),
  });

  const isAutoApply = isApplyableType(suggestion.suggestion_type);
  const isNote = isNoteType(suggestion.suggestion_type);
  const showDeferredBanner = isOpen && !isAutoApply && !isNote;

  const authorLabel = !suggestion.author_id
    ? sourceLabel(suggestion.source)
    : suggestion.author_id === currentUserId
      ? t("collab.member.you")
      : `Member ${suggestion.author_id.slice(0, 6)}`;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display">
              {suggestion.title?.trim() || t("collab.suggestions.noTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("collab.suggestions.byLine", {
                author: authorLabel,
                source: sourceLabel(suggestion.source),
                when: formatDistanceToNow(new Date(suggestion.created_at), {
                  addSuffix: true,
                }),
              })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <SourceBadge source={suggestion.source} />
              <StatusBadge status={suggestion.status} />
              <SuggestionAnchorLabel
                suggestion={suggestion}
                scenes={scenes}
              />
              <span className="text-xs text-muted-foreground">
                · {suggestionTypeLabel(suggestion.suggestion_type)}
              </span>
            </div>

            <section className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {t("collab.suggestions.reason")}
              </p>
              <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/85">
                {suggestion.rationale?.trim() ||
                  t("collab.suggestions.noRationale")}
              </p>
            </section>

            <SuggestionDiff suggestion={suggestion} />

            {showDeferredBanner && (
              <div className="rounded-md border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground flex items-start gap-2">
                <Lock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>{t("collab.suggestions.notAppliedNotice")}</span>
              </div>
            )}

            {suggestion.status === "accepted" && suggestion.applied_to_canonical && (
              <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-xs">
                {t("collab.suggestions.appliedNotice")}
              </div>
            )}
            {suggestion.status === "accepted" && !suggestion.applied_to_canonical && (
              <div className="rounded-md border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
                {t("collab.suggestions.notAppliedNotice")}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 flex-wrap">
            {canArchive && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirm("archive")}
                disabled={archiveMut.isPending}
              >
                {t("collab.suggestions.archive")}
              </Button>
            )}
            {canReject && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setConfirm("reject")}
                disabled={rejectMut.isPending}
              >
                {t("collab.suggestions.reject")}
              </Button>
            )}
            {canAccept && (
              <Button
                size="sm"
                onClick={() => setConfirm("accept")}
                disabled={acceptMut.isPending}
              >
                {acceptMut.isPending
                  ? t("collab.suggestions.saving")
                  : t("collab.suggestions.accept")}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm === "accept" &&
                t("collab.suggestions.acceptConfirm.title")}
              {confirm === "reject" &&
                t("collab.suggestions.rejectConfirm.title")}
              {confirm === "archive" &&
                t("collab.suggestions.archiveConfirm.title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "accept" &&
                t("collab.suggestions.acceptConfirm.body")}
              {confirm === "reject" &&
                t("collab.suggestions.rejectConfirm.body")}
              {confirm === "archive" &&
                t("collab.suggestions.archiveConfirm.body")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t("collab.suggestions.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirm === "accept") acceptMut.mutate();
                if (confirm === "reject") rejectMut.mutate();
                if (confirm === "archive") archiveMut.mutate();
                setConfirm(null);
              }}
            >
              {confirm === "accept" && t("collab.suggestions.accept")}
              {confirm === "reject" && t("collab.suggestions.reject")}
              {confirm === "archive" && t("collab.suggestions.archive")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
