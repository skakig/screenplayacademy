import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { t } from "@/lib/i18n/t";
import { assignScene, boardKeys, type AssignmentStatus } from "@/lib/assignments";
import { useActiveProjectMembers } from "./useProductionBoard";
import {
  AssignmentStatusSelect,
} from "./AssignmentStatusSelect";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  sceneId: string;
  sceneLabel: string;
  initial?: {
    assigneeId: string;
    status: AssignmentStatus;
    dueAt: string | null;
    note: string | null;
  };
}

export function AssignSceneDialog({
  open,
  onOpenChange,
  projectId,
  sceneId,
  sceneLabel,
  initial,
}: Props) {
  const qc = useQueryClient();
  const { data: members } = useActiveProjectMembers(projectId);
  const [assigneeId, setAssigneeId] = useState<string>(
    initial?.assigneeId ?? "",
  );
  const [status, setStatus] = useState<AssignmentStatus>(
    initial?.status ?? "assigned",
  );
  const [dueAt, setDueAt] = useState<Date | undefined>(
    initial?.dueAt ? new Date(initial.dueAt) : undefined,
  );
  const [note, setNote] = useState<string>(initial?.note ?? "");

  const mut = useMutation({
    mutationFn: () =>
      assignScene({
        projectId,
        sceneId,
        assigneeId,
        status,
        dueAt: dueAt ? dueAt.toISOString() : null,
        note: note.trim() || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: boardKeys.assignments(projectId) });
      toast.success(t("collab.assignments.savedToast"));
      onOpenChange(false);
    },
    onError: (e: unknown) =>
      toast.error(
        e instanceof Error ? e.message : t("collab.assignments.errorSave"),
      ),
  });

  const noteTooLong = note.length > 500;
  const canSubmit = !!assigneeId && !mut.isPending && !noteTooLong;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("collab.assignments.assign")}</DialogTitle>
          <DialogDescription>{sceneLabel}</DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit) mut.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              {t("collab.assignments.assignee")}
            </Label>
            <Select value={assigneeId} onValueChange={setAssigneeId}>
              <SelectTrigger>
                <SelectValue
                  placeholder={t("collab.assignments.assigneePlaceholder")}
                />
              </SelectTrigger>
              <SelectContent>
                {(members ?? []).map((m) => (
                  <SelectItem key={m.user_id} value={m.user_id}>
                    Member {m.user_id.slice(0, 6)} · {m.role}
                  </SelectItem>
                ))}
                {members && members.length === 0 && (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    No active members yet.
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              {t("collab.assignments.status")}
            </Label>
            <AssignmentStatusSelect
              value={status}
              onChange={setStatus}
              className="h-9 w-full"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              {t("collab.assignments.dueOptional")}
            </Label>
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="justify-start font-normal flex-1"
                  >
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    {dueAt ? format(dueAt, "PP") : t("collab.assignments.dueClear")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dueAt}
                    onSelect={setDueAt}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {dueAt && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setDueAt(undefined)}
                >
                  {t("collab.assignments.dueClear")}
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              {t("collab.assignments.noteOptional")}
            </Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("collab.assignments.notePlaceholder")}
              rows={3}
              maxLength={500}
              className="bg-background/60"
              aria-invalid={noteTooLong}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={mut.isPending}
            >
              {t("collab.comments.cancel")}
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {mut.isPending
                ? t("collab.assignments.saving")
                : t("collab.assignments.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
