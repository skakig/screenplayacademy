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
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { t } from "@/lib/i18n/t";
import {
  createSuggestion,
  SUGGESTION_LIMITS,
  suggestionKeys,
  type SuggestionType,
} from "@/lib/suggestions";
import { useProjectScenes } from "@/components/writers-room/comments/useProjectComments";

import { suggestionTypeLabel } from "./SuggestionTypeLabel";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

type AnchorMode = "project" | "scene";

const PROJECT_TYPES: SuggestionType[] = [
  "structure_note",
  "character_note",
  "continuity_fix",
  "pitch_deck_note",
];

const SCENE_TYPES: SuggestionType[] = [
  "rewrite_scene",
  "structure_note",
  "character_note",
  "continuity_fix",
];

export function CreateSuggestionDialog({ open, onOpenChange, projectId }: Props) {
  const qc = useQueryClient();
  const { data: scenes } = useProjectScenes(projectId);
  const [anchor, setAnchor] = useState<AnchorMode>("project");
  const [sceneId, setSceneId] = useState<string | null>(null);
  const [suggestionType, setSuggestionType] =
    useState<SuggestionType>("structure_note");
  const [title, setTitle] = useState("");
  const [rationale, setRationale] = useState("");
  const [suggestedText, setSuggestedText] = useState("");

  const reset = () => {
    setAnchor("project");
    setSceneId(null);
    setSuggestionType("structure_note");
    setTitle("");
    setRationale("");
    setSuggestedText("");
  };

  const types = anchor === "scene" ? SCENE_TYPES : PROJECT_TYPES;

  const mut = useMutation({
    mutationFn: () =>
      createSuggestion({
        projectId,
        sceneId: anchor === "scene" ? sceneId : null,
        suggestionType,
        title: title.trim() || null,
        rationale: rationale.trim() || null,
        after: {
          text: suggestedText.trim(),
          scope: anchor,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: suggestionKeys.all(projectId) });
      toast.success(t("collab.suggestions.savedToast"));
      reset();
      onOpenChange(false);
    },
    onError: (e: unknown) =>
      toast.error(
        e instanceof Error ? e.message : t("collab.suggestions.errorSave"),
      ),
  });

  const trimmedSuggested = suggestedText.trim();
  const trimmedRationale = rationale.trim();
  const sceneMissing = anchor === "scene" && !sceneId;
  const empty =
    !trimmedSuggested && !trimmedRationale && !title.trim();
  const titleTooLong = title.length > SUGGESTION_LIMITS.title;
  const rationaleTooLong = rationale.length > SUGGESTION_LIMITS.rationale;
  const textTooLong = suggestedText.length > SUGGESTION_LIMITS.text;
  const canSubmit =
    !mut.isPending &&
    !sceneMissing &&
    !empty &&
    !titleTooLong &&
    !rationaleTooLong &&
    !textTooLong;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("collab.suggestions.create")}</DialogTitle>
          <DialogDescription>
            {t("collab.reviewMode.subtitle")}
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit) mut.mutate();
          }}
        >
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              {t("collab.suggestions.anchorChoose")}
            </Label>
            <RadioGroup
              value={anchor}
              onValueChange={(v) => {
                const next = v as AnchorMode;
                setAnchor(next);
                const allowed = next === "scene" ? SCENE_TYPES : PROJECT_TYPES;
                if (!allowed.includes(suggestionType)) {
                  setSuggestionType(allowed[0]);
                }
              }}
              className="flex flex-wrap gap-4"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem id="sgg-anchor-project" value="project" />
                <Label htmlFor="sgg-anchor-project" className="text-sm font-normal">
                  {t("collab.suggestions.anchorProject")}
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem id="sgg-anchor-scene" value="scene" />
                <Label htmlFor="sgg-anchor-scene" className="text-sm font-normal">
                  {t("collab.suggestions.anchorScene")}
                </Label>
              </div>
            </RadioGroup>
            {anchor === "scene" && (
              <Select
                value={sceneId ?? ""}
                onValueChange={(v) => setSceneId(v || null)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={t("collab.suggestions.sceneSelectPlaceholder")}
                  />
                </SelectTrigger>
                <SelectContent>
                  {(scenes ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {(s.scene_heading || s.title || "Untitled scene").trim()}
                    </SelectItem>
                  ))}
                  {scenes && scenes.length === 0 && (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      No scenes yet.
                    </div>
                  )}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              {t("collab.suggestions.type")}
            </Label>
            <Select
              value={suggestionType}
              onValueChange={(v) => setSuggestionType(v as SuggestionType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {types.map((tp) => (
                  <SelectItem key={tp} value={tp}>
                    {suggestionTypeLabel(tp)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              {t("collab.suggestions.titleLabel")}
            </Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={SUGGESTION_LIMITS.title}
              placeholder={t("collab.suggestions.titlePlaceholder")}
              aria-invalid={titleTooLong}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              {t("collab.suggestions.rationale")}
            </Label>
            <Textarea
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              rows={3}
              maxLength={SUGGESTION_LIMITS.rationale}
              placeholder={t("collab.suggestions.rationalePlaceholder")}
              aria-invalid={rationaleTooLong}
              className="bg-background/60"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              {t("collab.suggestions.suggestedText")}
            </Label>
            <Textarea
              value={suggestedText}
              onChange={(e) => setSuggestedText(e.target.value)}
              rows={4}
              maxLength={SUGGESTION_LIMITS.text}
              placeholder={t("collab.suggestions.suggestedTextPlaceholder")}
              aria-invalid={textTooLong}
              className="bg-background/60"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={mut.isPending}
            >
              {t("collab.suggestions.cancel")}
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {mut.isPending
                ? t("collab.suggestions.saving")
                : t("collab.suggestions.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
