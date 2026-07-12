import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useDefaultUniverse,
  useEnsureDefaultUniverse,
} from "@/hooks/useDefaultUniverse";
import { getWorldHubSnapshot } from "@/lib/importation/world-hub.functions";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import { Loader2, Globe, FileText, Users, MapPin, Flag, Calendar, Scroll, Package, GitBranch, Clock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/world/$projectId")({
  head: () => ({
    meta: [
      { title: "World Hub — SceneSmith Studio" },
      { name: "description", content: "Sources, character bible, locations, factions, events, and lore for this project." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: WorldHubPage,
  errorComponent: RouteErrorBoundary,
});

function WorldHubPage() {
  const { projectId } = useParams({ from: "/_authenticated/world/$projectId" });
  const universeQuery = useDefaultUniverse(projectId);
  const ensure = useEnsureDefaultUniverse(projectId);

  return (
    <AppShell title="World Hub">
      <div className="container max-w-6xl py-6 space-y-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
              <Globe className="h-3.5 w-3.5" /> World Hub
              <Badge variant="outline" className="text-[10px]">Owner Preview</Badge>
            </div>
            <h1 className="text-2xl font-display mt-1">
              {universeQuery.data?.projectTitle ?? "Loading…"}
            </h1>
            <p className="text-sm text-muted-foreground max-w-2xl mt-1">
              Read-only view of every world entity that has been imported or
              proposed for this project. Canon edits still happen inside the
              existing Importation and Character Bible surfaces.
            </p>
          </div>
        </header>

        {universeQuery.isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Resolving world workspace…
          </div>
        )}

        {universeQuery.isError && (
          <Card>
            <CardContent className="p-4 text-sm text-destructive">
              Couldn't load the world workspace. {(universeQuery.error as Error)?.message}
              <Button size="sm" variant="outline" className="ml-3" onClick={() => universeQuery.refetch()}>
                Retry
              </Button>
            </CardContent>
          </Card>
        )}

        {universeQuery.data && !universeQuery.data.universeId && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">No world workspace yet</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Create the world workspace to start importing sources and
                generating a character bible for this project.
              </p>
              <Button
                onClick={() => ensure.mutate(undefined)}
                disabled={ensure.isPending}
              >
                {ensure.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create world workspace
              </Button>
              {ensure.isError && (
                <p className="text-xs text-destructive">
                  {(ensure.error as Error)?.message}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {universeQuery.data?.universeId && (
          <WorldHubTabs
            projectId={projectId}
            universeId={universeQuery.data.universeId}
          />
        )}
      </div>
    </AppShell>
  );
}

function WorldHubTabs({ projectId, universeId }: { projectId: string; universeId: string }) {
  const fetchSnapshot = useServerFn(getWorldHubSnapshot);
  const snapshot = useQuery({
    queryKey: ["world-hub", projectId, universeId],
    queryFn: () => fetchSnapshot({ data: { projectId, universeId } }),
    staleTime: 15_000,
  });

  if (snapshot.isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading world…
      </div>
    );
  }
  if (snapshot.isError) {
    return (
      <Card>
        <CardContent className="p-4 text-sm text-destructive">
          Couldn't load world data. {(snapshot.error as Error)?.message}
          <Button size="sm" variant="outline" className="ml-3" onClick={() => snapshot.refetch()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }
  const d = snapshot.data!;

  const groups = [
    { key: "overview", label: "Overview", icon: Globe },
    { key: "sources", label: `Sources · ${d.sources.count}`, icon: FileText },
    { key: "bible", label: `Character Bible · ${d.bibles.count}`, icon: Users },
    { key: "locations", label: `Locations · ${d.locations.count}`, icon: MapPin },
    { key: "factions", label: `Factions · ${d.factions.count}`, icon: Flag },
    { key: "events", label: `Events · ${d.events.count}`, icon: Calendar },
    { key: "rules", label: `Rules · ${d.rules.count}`, icon: Scroll },
    { key: "artifacts", label: `Artifacts · ${d.artifacts.count}`, icon: Package },
    { key: "threads", label: `Threads · ${d.threads.count}`, icon: GitBranch },
    { key: "timeline", label: `Timeline · ${d.timeline.count}`, icon: Clock },
  ];

  return (
    <Tabs defaultValue="overview" className="w-full">
      <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/40">
        {groups.map((g) => (
          <TabsTrigger key={g.key} value={g.key} className="text-xs gap-1">
            <g.icon className="h-3 w-3" /> {g.label}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="overview">
        <Card>
          <CardContent className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <Stat label="Sources" value={d.sources.count} />
            <Stat label="Character bibles" value={d.bibles.count} />
            <Stat label="Locations" value={d.locations.count} />
            <Stat label="Factions" value={d.factions.count} />
            <Stat label="Events" value={d.events.count} />
            <Stat label="Rules" value={d.rules.count} />
            <Stat label="Artifacts" value={d.artifacts.count} />
            <Stat label="Threads" value={d.threads.count} />
            <Stat label="Timeline entries" value={d.timeline.count} />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="sources">
        <SourcesList
          projectId={projectId}
          universeId={universeId}
          rows={d.sources.rows}
        />
      </TabsContent>

      <TabsContent value="bible">
        <BiblesList
          projectId={projectId}
          universeId={universeId}
          rows={d.bibles.rows}
        />
      </TabsContent>

      {(["locations", "factions", "events", "rules", "artifacts", "threads", "timeline"] as const).map(
        (k) => (
          <TabsContent key={k} value={k}>
            <SimpleEntityList
              rows={d[k].rows}
              emptyLabel={`No ${k} yet. Import sources to populate this tab.`}
            />
          </TabsContent>
        ),
      )}
    </Tabs>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border/40 p-3">
      <div className="text-2xl font-display">{value}</div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

function SourcesList({
  projectId,
  universeId,
  rows,
}: {
  projectId: string;
  universeId: string;
  rows: any[];
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm">Source documents</CardTitle>
        <Link
          to="/importation/$projectId/$universeId"
          params={{ projectId, universeId }}
          className="text-xs underline"
        >
          Open Importation Center
        </Link>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.length === 0 && (
          <p className="text-sm text-muted-foreground">No sources imported yet.</p>
        )}
        {rows.map((r) => (
          <Link
            key={r.id}
            to="/importation/$projectId/$universeId/$documentId"
            params={{ projectId, universeId, documentId: r.id }}
            className="flex items-center justify-between rounded-md border border-border/40 p-2 hover:bg-secondary text-sm"
          >
            <span className="truncate">{r.title || "Untitled"}</span>
            <Badge variant="outline" className="text-[10px]">{r.status ?? "unknown"}</Badge>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

function BiblesList({
  projectId,
  universeId,
  rows,
}: {
  projectId: string;
  universeId: string;
  rows: any[];
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm">Character bibles</CardTitle>
        <Link
          to="/character-bible/$projectId/$universeId"
          params={{ projectId, universeId }}
          className="text-xs underline"
        >
          Open Character Bible
        </Link>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No bible generated yet. Open the Character Bible page to run the first generation.
          </p>
        )}
        {rows.map((r) => (
          <div
            key={r.id}
            className="flex items-center justify-between rounded-md border border-border/40 p-2 text-sm"
          >
            <span>Version {r.version}</span>
            <span className="text-xs text-muted-foreground">
              {new Date(r.created_at).toLocaleString()}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function SimpleEntityList({ rows, emptyLabel }: { rows: any[]; emptyLabel: string }) {
  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          {emptyLabel}
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardContent className="p-3 space-y-2">
        {rows.map((r) => (
          <div
            key={r.id}
            className="rounded-md border border-border/40 p-2 text-sm"
          >
            <div className="font-medium">{r.name ?? "(unnamed)"}</div>
            {r.description && (
              <div className="text-xs text-muted-foreground line-clamp-2">
                {r.description}
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
