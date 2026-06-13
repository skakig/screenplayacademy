import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { ProjectNav } from "@/components/ProjectNav";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MembersList } from "@/components/writers-room/MembersList";
import { InvitesList } from "@/components/writers-room/InvitesList";
import { InviteCollaboratorDialog } from "@/components/writers-room/InviteCollaboratorDialog";
import { AccessRulesPanel } from "@/components/writers-room/AccessRulesPanel";
import { ReviewNotesPanel } from "@/components/writers-room/comments/ReviewNotesPanel";
import { useProjectComments } from "@/components/writers-room/comments/useProjectComments";
import { ProductionBoardPanel } from "@/components/writers-room/board/ProductionBoardPanel";
import { SuggestionsPanel } from "@/components/writers-room/suggestions/SuggestionsPanel";
import { useProjectSuggestions } from "@/components/writers-room/suggestions/useProjectSuggestions";
import { fetchProjectRole, wrKeys } from "@/lib/collab";
import { t } from "@/lib/i18n/t";

export const Route = createFileRoute("/_authenticated/writers-room/$projectId")({
  head: () => ({ meta: [{ title: "Writers' Room — SceneSmith Studio" }] }),
  component: WritersRoomPage,
});

function WritersRoomPage() {
  const { projectId } = Route.useParams();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) setUserId(data.user?.id ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const { data: project } = useQuery({
    queryKey: ["wr", "project", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, title")
        .eq("id", projectId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: role, isLoading: roleLoading } = useQuery({
    queryKey: wrKeys.role(projectId),
    queryFn: () => fetchProjectRole(projectId),
  });

  const isOwner = role === "owner";
  const hasAccess = role !== null && role !== undefined;

  return (
    <AppShell>
      <ProjectNav projectId={projectId} title={project?.title} />
      <div className="max-w-[1100px] mx-auto px-4 py-10">
        <header className="mb-8">
          <h1 className="font-display text-4xl font-semibold tracking-tight">
            {t("collab.room.title")}
          </h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            {t("collab.room.subtitle")}
          </p>
        </header>

        {roleLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : !hasAccess ? (
          <Card className="p-10 text-center bg-card/40">
            <h2 className="font-display text-xl mb-2">
              {t("collab.permissions.denied")}
            </h2>
            <p className="text-muted-foreground mb-6">
              {t("collab.permissions.denied.body")}
            </p>
            <Button asChild variant="secondary">
              <Link to="/dashboard">Back to Studio Lobby</Link>
            </Button>
          </Card>
        ) : (
          <WritersRoomBody
            projectId={projectId}
            userId={userId}
            isOwner={isOwner}
            role={role ?? null}
            onInvite={() => setInviteOpen(true)}
          />
        )}
      </div>

      {isOwner && (
        <InviteCollaboratorDialog
          projectId={projectId}
          open={inviteOpen}
          onOpenChange={setInviteOpen}
        />
      )}
    </AppShell>
  );
}

interface BodyProps {
  projectId: string;
  userId: string | null;
  isOwner: boolean;
  role: import("@/components/writers-room/roles").ProjectRole | null;
  onInvite: () => void;
}

function WritersRoomBody({
  projectId,
  userId,
  isOwner,
  role,
  onInvite,
}: BodyProps) {
  const openNotes = useProjectComments(projectId, "open");
  const openCount = openNotes.threads.length;

  return (
    <Tabs defaultValue="team" className="space-y-6">
      <TabsList>
        <TabsTrigger value="team">{t("collab.tabs.team")}</TabsTrigger>
        <TabsTrigger value="notes" className="gap-2">
          {t("collab.tabs.notes")}
          {openCount > 0 && (
            <span className="rounded-full bg-primary/15 text-primary text-[10px] px-1.5 py-0.5 leading-none">
              {openCount}
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger value="board">{t("collab.tabs.board")}</TabsTrigger>
      </TabsList>

      <TabsContent value="team" className="space-y-6 mt-0">
        <Card className="p-6 bg-card/60">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h2 className="font-display text-xl font-semibold">
              {t("collab.members.title")}
            </h2>
            {isOwner && (
              <Button onClick={onInvite} size="sm">
                <UserPlus className="h-4 w-4 mr-1.5" />
                {t("collab.invite.button")}
              </Button>
            )}
          </div>
          <MembersList
            projectId={projectId}
            currentUserId={userId}
            isOwner={isOwner}
          />
        </Card>

        {isOwner && (
          <Card className="p-6 bg-card/60">
            <h2 className="font-display text-xl font-semibold mb-4">
              {t("collab.invites.title")}
            </h2>
            <InvitesList projectId={projectId} />
          </Card>
        )}

        <AccessRulesPanel />
      </TabsContent>

      <TabsContent value="notes" className="mt-0">
        <ReviewNotesPanel projectId={projectId} role={role} />
      </TabsContent>

      <TabsContent value="board" className="mt-0">
        <ProductionBoardPanel projectId={projectId} role={role} />
      </TabsContent>
    </Tabs>
  );
}
