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
