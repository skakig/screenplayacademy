import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { useDefaultUniverse } from "@/hooks/useDefaultUniverse";
import { WorldEntityRelationshipsPanel } from "@/components/world/WorldEntityRelationshipsPanel";

export const Route = createFileRoute(
  "/_authenticated/world/$projectId/entity/$entityId",
)({
  head: () => ({
    meta: [
      { title: "World Entity — SceneSmith Studio" },
      {
        name: "description",
        content: "View and edit typed relationships for a world entity.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EntityRelationshipsPage,
  errorComponent: RouteErrorBoundary,
});

function EntityRelationshipsPage() {
  const { projectId, entityId } = useParams({
    from: "/_authenticated/world/$projectId/entity/$entityId",
  });
  const universeQuery = useDefaultUniverse(projectId);
  const universeId = universeQuery.data?.universeId;

  return (
    <AppShell title="World Entity">
      <div className="container max-w-4xl py-6 space-y-4">
        <Link to="/world/$projectId" params={{ projectId }}>
          <Button variant="ghost" size="sm">
            <ChevronLeft className="h-4 w-4 mr-1" /> Back to World Hub
          </Button>
        </Link>

        {!universeId ? (
          <p className="text-sm text-muted-foreground">Resolving universe…</p>
        ) : (
          <WorldEntityRelationshipsPanel
            entityId={entityId}
            universeId={universeId}
          />
        )}
      </div>
    </AppShell>
  );
}
