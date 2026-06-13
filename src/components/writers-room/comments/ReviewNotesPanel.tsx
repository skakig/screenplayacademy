import { useEffect, useState } from "react";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

import { t } from "@/lib/i18n/t";
import type { ProjectRole } from "@/components/writers-room/roles";
import {
  canCreateComment,
  canViewComments,
} from "@/components/writers-room/permissions";

import {
  useProjectComments,
  useProjectScenes,
} from "./useProjectComments";
import { CommentThread } from "./CommentThread";
import { CommentComposer } from "./CommentComposer";

interface Props {
  projectId: string;
  role: ProjectRole | null;
}

export function ReviewNotesPanel({ projectId, role }: Props) {
  const [userId, setUserId] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [showResolved, setShowResolved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) setUserId(data.user?.id ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const open = useProjectComments(projectId, "open");
  const resolved = useProjectComments(projectId, "resolved");
  const { data: scenes } = useProjectScenes(projectId);

  if (!canViewComments(role)) {
    return null;
  }

  const canCreate = canCreateComment(role);

  return (
    <div className="space-y-6">
      <Card className="p-6 bg-card/60">
        <header className="mb-4">
          <h2 className="font-display text-xl font-semibold">
            {t("collab.comments.title")}
          </h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl">
            {t("collab.comments.subtitle")}
          </p>
        </header>

        {canCreate ? (
          composerOpen ? (
            <div className="rounded-md border border-border/60 bg-background/40 p-4">
              <CommentComposer
                projectId={projectId}
                onSubmitted={() => setComposerOpen(false)}
                onCancel={() => setComposerOpen(false)}
              />
            </div>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setComposerOpen(true)}
            >
              <Plus className="h-4 w-4 mr-1.5" />
              {t("collab.comments.add")}
            </Button>
          )
        ) : (
          <p className="text-xs text-muted-foreground italic">
            {t("collab.comments.readOnlyHint")}
          </p>
        )}
      </Card>

      <Card className="p-6 bg-card/60">
        <h3 className="font-display text-lg font-semibold mb-4">
          {t("collab.comments.open")}
        </h3>
        {open.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : open.isError ? (
          <p className="text-sm text-destructive">
            {t("collab.comments.errorLoad")}
          </p>
        ) : open.threads.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            {t("collab.comments.emptyOpen")}
          </p>
        ) : (
          <div className="space-y-5">
            {open.threads.map((thread) => (
              <CommentThread
                key={thread.root.id}
                projectId={projectId}
                root={thread.root}
                replies={thread.replies}
                scenes={scenes}
                currentUserId={userId}
                role={role}
              />
            ))}
          </div>
        )}
      </Card>

      <Card className="p-6 bg-card/60">
        <button
          type="button"
          onClick={() => setShowResolved((s) => !s)}
          className="flex items-center justify-between w-full text-left"
        >
          <h3 className="font-display text-lg font-semibold">
            {t("collab.comments.resolved")}
          </h3>
          <span className="text-xs text-muted-foreground">
            {showResolved ? "—" : "+"}
          </span>
        </button>

        {showResolved && (
          <div className="mt-4">
            {resolved.isLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : resolved.isError ? (
              <p className="text-sm text-destructive">
                {t("collab.comments.errorLoad")}
              </p>
            ) : resolved.threads.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                {t("collab.comments.emptyResolved")}
              </p>
            ) : (
              <div className="space-y-5">
                {resolved.threads.map((thread) => (
                  <CommentThread
                    key={thread.root.id}
                    projectId={projectId}
                    root={thread.root}
                    replies={thread.replies}
                    scenes={scenes}
                    currentUserId={userId}
                    role={role}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
