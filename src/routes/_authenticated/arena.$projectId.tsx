/**
 * Arena Owner Preview — /arena/$projectId
 *
 * Standalone owner/admin-only surface for the existing Arena panel so the
 * project owner can validate Issue #26 gates before Arena is exposed
 * publicly. Reuses `ArenaPanel` from the Writers' Room so there is no
 * doctrinal divergence between preview and future public rollout. Access
 * requires either the project owner role or the global `admin` role; the
 * underlying `arena_*` RLS still enforces authorization server-side.
 */
import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FlaskConical, ArrowLeft } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArenaPanel } from "@/components/writers-room/arena/ArenaPanel";
import { PresenceProvider } from "@/lib/presence/PresenceProvider";
import { RouteReadinessGate } from "@/components/RouteReadinessGate";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import { fetchProjectRole, wrKeys } from "@/lib/collab";
import { useIsAdmin } from "@/hooks/useIsAdmin";

export const Route = createFileRoute("/_authenticated/arena/$projectId")({
  head: () => ({
    meta: [
      { title: "Arena Owner Preview — SceneSmith Studio" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <RouteReadinessGate to="/arena/$projectId">
      <ArenaOwnerPreviewPage />
    </RouteReadinessGate>
  ),
  errorComponent: RouteErrorBoundary,
});

function ArenaOwnerPreviewPage() {
  const { projectId } = Route.useParams();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
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
    queryKey: ["arena-preview", "project", projectId],
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
  const canPreview = isOwner || isAdmin;
  const gating = adminLoading || roleLoading;

  return (
    <AppShell title="Arena Owner Preview">
      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-display font-semibold truncate">
                Arena
              </h1>
              <Badge
                variant="outline"
                className="text-[10px] gap-1 border-purple-500/40 text-purple-600 dark:text-purple-400"
              >
                <FlaskConical className="h-3 w-3" />
                Owner Preview
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground truncate">
              {project?.title ?? "Loading project…"}
            </p>
          </div>
          <Link to="/writers-room/$projectId" params={{ projectId }}>
            <Button variant="ghost" size="sm" className="gap-1.5">
              <ArrowLeft className="h-4 w-4" />
              Writers' Room
            </Button>
          </Link>
        </div>

        <Card className="p-3 text-xs text-muted-foreground bg-muted/30 border-dashed">
          Arena is not publicly enabled. This page is visible only to the
          project owner and Studio admins so Issue #26 release gates can be
          verified against real project data. Nothing here is shared with
          collaborators until Arena ships.
        </Card>

        {gating ? (
          <Skeleton className="h-72 w-full" />
        ) : !userId ? (
          <Card className="p-6 text-sm">Sign in required.</Card>
        ) : !canPreview ? (
          <Card className="p-6 text-sm space-y-2">
            <div className="font-medium">Preview restricted</div>
            <p className="text-muted-foreground">
              Arena Owner Preview is limited to the project owner and Studio
              admins. Ask the project owner to open this page, or return to
              the Writers' Room.
            </p>
            <div>
              <Link to="/writers-room/$projectId" params={{ projectId }}>
                <Button size="sm" variant="secondary">
                  Back to Writers' Room
                </Button>
              </Link>
            </div>
          </Card>
        ) : (
          <PresenceProvider projectId={projectId} role={role ?? null}>
            <ArenaPanel projectId={projectId} role={role ?? null} />
          </PresenceProvider>
        )}
      </div>
    </AppShell>
  );
}
