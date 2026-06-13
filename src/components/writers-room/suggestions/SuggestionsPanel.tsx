import { useEffect, useState } from "react";
import { Plus } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { t } from "@/lib/i18n/t";
import type { ProjectRole } from "@/components/writers-room/roles";
import {
  canCreateSuggestion,
  canViewSuggestions,
} from "@/components/writers-room/permissions";
import { useProjectScenes } from "@/components/writers-room/comments/useProjectComments";

import { useProjectSuggestions } from "./useProjectSuggestions";
import { SuggestionList } from "./SuggestionList";
import { CreateSuggestionDialog } from "./CreateSuggestionDialog";

interface Props {
  projectId: string;
  role: ProjectRole | null;
}

export function SuggestionsPanel({ projectId, role }: Props) {
  const [userId, setUserId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [showRejected, setShowRejected] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) setUserId(data.user?.id ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const open = useProjectSuggestions(projectId, "open");
  const accepted = useProjectSuggestions(projectId, "accepted");
  const rejected = useProjectSuggestions(projectId, "rejected");
  const { data: scenes } = useProjectScenes(projectId);

  if (!canViewSuggestions(role)) return null;

  const canCreate = canCreateSuggestion(role);

  return (
    <div className="space-y-6">
      <Card className="p-6 bg-card/60">
        <header className="mb-4">
          <h2 className="font-display text-xl font-semibold">
            {t("collab.suggestions.title")}
          </h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            {t("collab.suggestions.subtitle")}
          </p>
        </header>

        {canCreate ? (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            {t("collab.suggestions.create")}
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground italic">
            {t("collab.suggestions.readOnlyHint")}
          </p>
        )}
      </Card>

      <Card className="p-6 bg-card/60">
        <h3 className="font-display text-lg font-semibold mb-4">
          {t("collab.suggestions.open")}
        </h3>
        <SuggestionList
          projectId={projectId}
          suggestions={open.data}
          scenes={scenes}
          isLoading={open.isLoading}
          isError={open.isError}
          emptyMessage={t("collab.suggestions.emptyOpen")}
          role={role}
          currentUserId={userId}
        />
      </Card>

      <Card className="p-6 bg-card/60">
        <h3 className="font-display text-lg font-semibold mb-4">
          {t("collab.suggestions.accepted")}
        </h3>
        <SuggestionList
          projectId={projectId}
          suggestions={accepted.data}
          scenes={scenes}
          isLoading={accepted.isLoading}
          isError={accepted.isError}
          emptyMessage={t("collab.suggestions.emptyAccepted")}
          role={role}
          currentUserId={userId}
        />
      </Card>

      <Card className="p-6 bg-card/60">
        <button
          type="button"
          onClick={() => setShowRejected((s) => !s)}
          className="flex items-center justify-between w-full text-left"
        >
          <h3 className="font-display text-lg font-semibold">
            {t("collab.suggestions.rejected")}
          </h3>
          <span className="text-xs text-muted-foreground">
            {showRejected ? "—" : "+"}
          </span>
        </button>
        {showRejected && (
          <div className="mt-4">
            <SuggestionList
              projectId={projectId}
              suggestions={rejected.data}
              scenes={scenes}
              isLoading={rejected.isLoading}
              isError={rejected.isError}
              emptyMessage={t("collab.suggestions.emptyRejected")}
              role={role}
              currentUserId={userId}
            />
          </div>
        )}
      </Card>

      {canCreate && (
        <CreateSuggestionDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          projectId={projectId}
        />
      )}
    </div>
  );
}
