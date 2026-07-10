import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { t } from "@/lib/i18n/t";
import type { I18nKey } from "@/lib/i18n/keys";
import {
  ARENA_DURATION_PRESETS,
  ARENA_MODES,
  arenaKeys,
  createArenaSession,
  type ArenaMode,
} from "@/lib/arena";

interface Props {
  projectId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const DURATION_LABELS: Record<number, I18nKey> = {
  180: "arena.duration.short",
  300: "arena.duration.medium",
  420: "arena.duration.default",
  600: "arena.duration.long",
  900: "arena.duration.epic",
};

export function CreateRoundDialog({ projectId, open, onOpenChange }: Props) {
  const [title, setTitle] = useState("");
  const [mode, setMode] = useState<ArenaMode>("dialogue_duel");
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState<number>(420);
  const qc = useQueryClient();

  const m = useMutation({
    mutationFn: () =>
      createArenaSession({
        projectId,
        title,
        mode,
        prompt,
        durationSeconds: duration,
      }),
    onSuccess: () => {
      toast(t("arena.toast.joined"));
      qc.invalidateQueries({ queryKey: arenaKeys.list(projectId) });
      setTitle("");
      setPrompt("");
      onOpenChange(false);
    },
    onError: (e) => {
      toast.error(
        (e as Error).message || t("arena.create.error"),
      );
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{t("arena.create.dialogTitle")}</DialogTitle>
          <DialogDescription>
            {t("arena.create.dialogSubtitle")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="arena-title">{t("arena.create.titleLabel")}</Label>
            <Input
              id="arena-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("arena.create.titlePlaceholder")}
              maxLength={120}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("arena.create.modeLabel")}</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as ArenaMode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ARENA_MODES.map((m) => (
                    <SelectItem key={m} value={m}>
                      {t(`arena.mode.${m}` as I18nKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("arena.create.durationLabel")}</Label>
              <Select
                value={String(duration)}
                onValueChange={(v) => setDuration(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ARENA_DURATION_PRESETS.map((s) => (
                    <SelectItem key={s} value={String(s)}>
                      {t(DURATION_LABELS[s] ?? "arena.duration.default")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="arena-prompt">{t("arena.create.promptLabel")}</Label>
            <Textarea
              id="arena-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={t("arena.create.promptPlaceholder")}
              rows={4}
              maxLength={2000}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("arena.create.cancel")}
          </Button>
          <Button
            onClick={() => m.mutate()}
            disabled={m.isPending || !title.trim() || !prompt.trim()}
          >
            {t("arena.create.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
