import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { t } from "@/lib/i18n/t";
import {
  commentKeys,
  createComment,
  type CommentRow,
} from "@/lib/comments";
import { useProjectScenes } from "./useProjectComments";

interface Props {
  projectId: string;
  /** When set, this is a reply form (anchor inherited from parent). */
  parent?: CommentRow;
  onSubmitted?: () => void;
  onCancel?: () => void;
  /** Hide the cancel button (e.g. top-level composer that's always open). */
  hideCancel?: boolean;
  /** Default anchor for a fresh top-level note. */
  defaultAnchor?: "project" | "scene";
}

type AnchorMode = "project" | "scene";

export function CommentComposer({
  projectId,
  parent,
  onSubmitted,
  onCancel,
  hideCancel,
  defaultAnchor = "project",
}: Props) {
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [anchor, setAnchor] = useState<AnchorMode>(
    parent?.scene_id ? "scene" : defaultAnchor,
  );
  const [sceneId, setSceneId] = useState<string | null>(
    parent?.scene_id ?? null,
  );
  const [error, setError] = useState<string | null>(null);

  const isReply = !!parent;
  const { data: scenes } = useProjectScenes(projectId);

  const mut = useMutation({
    mutationFn: () => {
      if (isReply) {
        return createComment({
          projectId,
          body,
          parentCommentId: parent!.id,
          sceneId: parent!.scene_id,
          scriptBlockId: parent!.script_block_id,
        });
      }
      return createComment({
        projectId,
        body,
        sceneId: anchor === "scene" ? sceneId : null,
      });
    },
    onSuccess: () => {
      setBody("");
      setError(null);
      qc.invalidateQueries({ queryKey: commentKeys.all(projectId) });
      toast.success(
        isReply ? t("collab.comments.reply") : t("collab.comments.add"),
      );
      onSubmitted?.();
    },
    onError: (e: unknown) => {
      const msg =
        e instanceof Error ? e.message : t("collab.comments.errorSave");
      setError(msg);
      toast.error(msg);
    },
  });

  const trimmed = body.trim();
  const tooLong = trimmed.length > 5000;
  const sceneMissing = !isReply && anchor === "scene" && !sceneId;
  const canSubmit =
    trimmed.length > 0 && !tooLong && !sceneMissing && !mut.isPending;

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!canSubmit) return;
        mut.mutate();
      }}
    >
      {!isReply && (
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            {t("collab.comments.anchorChoose")}
          </Label>
          <RadioGroup
            value={anchor}
            onValueChange={(v) => setAnchor(v as AnchorMode)}
            className="flex flex-wrap gap-4"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem id="anchor-project" value="project" />
              <Label htmlFor="anchor-project" className="text-sm font-normal">
                {t("collab.comments.anchorProject")}
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem id="anchor-scene" value="scene" />
              <Label htmlFor="anchor-scene" className="text-sm font-normal">
                {t("collab.comments.anchorScene")}
              </Label>
            </div>
          </RadioGroup>
          {anchor === "scene" && (
            <Select
              value={sceneId ?? ""}
              onValueChange={(v) => setSceneId(v || null)}
            >
              <SelectTrigger className="w-full sm:w-[320px]">
                <SelectValue
                  placeholder={t("collab.comments.sceneSelectPlaceholder")}
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
      )}

      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={t("collab.comments.placeholder")}
        rows={isReply ? 3 : 4}
        maxLength={5000}
        className="bg-background/60"
        aria-invalid={tooLong}
      />

      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="flex items-center justify-end gap-2">
        {!hideCancel && onCancel && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={mut.isPending}
          >
            {t("collab.comments.cancel")}
          </Button>
        )}
        <Button type="submit" size="sm" disabled={!canSubmit}>
          {mut.isPending
            ? t("collab.comments.saving")
            : isReply
              ? t("collab.comments.submitReply")
              : t("collab.comments.submit")}
        </Button>
      </div>
    </form>
  );
}
