import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import {
  Loader2, Globe, FileText, Users, MapPin, Flag, Calendar,
  Scroll, Package, GitBranch, Clock, AlertTriangle, Network, Link2,
} from "lucide-react";
import { useServerFn as useServerFn2 } from "@tanstack/react-start";
import { listWorldEntities } from "@/lib/world/worldGraph.functions";
import { autoLinkSceneLocations } from "@/lib/editor/sceneWorldLink.functions";
import { toast } from "sonner";
import type { ProjectStoryIntelligence } from "@/lib/story-intelligence/projectStoryIntelligence.functions";


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
              Read-only view of the connected story: characters, sources,
              scenes, and world entities. Canon edits still happen in the
              Cast, Importation Center, and Character Bible surfaces.
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
  const { intelligence, samples } = snapshot.data!;

  const groups = [
    { key: "overview", label: "Overview", icon: Globe },
    { key: "sources", label: `Sources · ${intelligence.sources.length}`, icon: FileText },
    { key: "bible", label: `Character Bible · ${intelligence.bibles.versions.length}`, icon: Users },
    { key: "locations", label: `Locations · ${intelligence.world.locations.count}`, icon: MapPin },
    { key: "factions", label: `Factions · ${intelligence.world.factions.count}`, icon: Flag },
    { key: "events", label: `Events · ${intelligence.world.events.count}`, icon: Calendar },
    { key: "rules", label: `Rules · ${intelligence.world.rules.count}`, icon: Scroll },
    { key: "artifacts", label: `Artifacts · ${intelligence.world.artifacts.count}`, icon: Package },
    { key: "threads", label: `Threads · ${intelligence.world.threads.count}`, icon: GitBranch },
    { key: "timeline", label: `Timeline · ${intelligence.world.timeline.count}`, icon: Clock },
    { key: "relationships", label: "Relationships", icon: Network },
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
        <OverviewPanel intelligence={intelligence} projectId={projectId} universeId={universeId} />
      </TabsContent>

      <TabsContent value="sources">
        <SourcesList
          projectId={projectId}
          universeId={universeId}
          rows={samples.sources}
        />
      </TabsContent>

      <TabsContent value="bible">
        <BiblesList
          projectId={projectId}
          universeId={universeId}
          rows={samples.bibles}
        />
      </TabsContent>

      {(["locations", "factions", "events", "rules", "artifacts", "threads", "timeline"] as const).map(
        (k) => (
          <TabsContent key={k} value={k}>
            <SimpleEntityList
              rows={samples[k]}
              emptyLabel={`No ${k} yet. Import sources to populate this tab.`}
            />
          </TabsContent>
        ),
      )}

      <TabsContent value="relationships">
        <RelationshipsTab projectId={projectId} universeId={universeId} />
      </TabsContent>
    </Tabs>
  );
}

function RelationshipsTab({
  projectId,
  universeId,
}: {
  projectId: string;
  universeId: string;
}) {
  const fetchEntities = useServerFn2(listWorldEntities);
  const q = useQuery({
    queryKey: ["world-entities", universeId],
    queryFn: () => fetchEntities({ data: { universeId, limit: 500 } }),
    staleTime: 30_000,
  });
  if (q.isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading entities…
      </div>
    );
  }
  if (q.isError) {
    return (
      <Card>
        <CardContent className="p-4 text-sm text-destructive">
          Couldn't load world entities. {(q.error as Error)?.message}
        </CardContent>
      </Card>
    );
  }
  const rows = q.data ?? [];
  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          No world entities yet. Approve candidates in the Importation Center or
          add locations, factions, and characters to build the graph.
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">
          Select an entity to edit its typed relationships
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.map((r) => (
          <Link
            key={r.id}
            to="/world/$projectId/entity/$entityId"
            params={{ projectId, entityId: r.id }}
            className="flex items-center justify-between rounded-md border border-border/40 p-2 hover:bg-secondary text-sm"
          >
            <span className="truncate">{r.name}</span>
            <Badge variant="outline" className="text-[10px] capitalize">
              {r.entity_kind}
            </Badge>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

function OverviewPanel({
  intelligence,
  projectId,
  universeId,
}: {
  intelligence: ProjectStoryIntelligence;
  projectId: string;
  universeId: string;
}) {
  const charsWithEvidence = intelligence.characters.filter(
    (c) => c.evidenceCount > 0 && !c.quarantined,
  ).length;
  const projectCharacters = intelligence.characters.filter(
    (c) => !c.quarantined,
  ).length;
  const unresolvedCastCandidates = intelligence.candidates.byKind["character"] ?? 0;
  const scriptDetectedLocations = new Set(
    intelligence.scenes
      .flatMap((s) => s.detectedLocations.map((d) => d.normalizedKey))
      .filter((k) => k),
  ).size;
  const approvedWorldLocations = intelligence.world.locations.count;
  const unresolvedWorldCandidates =
    intelligence.candidates.unresolved - unresolvedCastCandidates;
  const continuityQuestions = intelligence.world.threads.count;

  const d = intelligence.diagnostics;
  const anyNeedsConnection =
    d.manualCharactersMissingFromBible.length > 0 ||
    d.importedCandidatesUnresolved.length > 0 ||
    d.sceneLocationsWithoutWorldLink.length > 0 ||
    d.worldEntitiesWithoutEvidence.length > 0 ||
    d.possibleCharacterDuplicates.length > 0 ||
    d.possibleLocationDuplicates.length > 0;

  const qc = useQueryClient();
  const runAutoLink = useServerFn(autoLinkSceneLocations);
  const relink = useMutation({
    mutationFn: () => runAutoLink({ data: { projectId } }),
    onSuccess: (r) => {
      toast.success(
        `Re-linked scenes — ${r.usageLinked} linked, ${r.usageUnlinked} pruned, ${r.locationsEnsured} locations ensured`,
      );
      qc.invalidateQueries({ queryKey: ["world-hub-snapshot", projectId] });
      qc.invalidateQueries({ queryKey: ["scene-world-locations"] });
      qc.invalidateQueries({ queryKey: ["world-usage"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Re-link failed"),
  });

  return (
    <div className="space-y-4">

      <Card>
        <CardContent className="p-4 grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
          <Stat label="Characters" value={projectCharacters} />
          <Stat label="Chars w/ Evidence" value={charsWithEvidence} />
          <Stat label="Unresolved Cast" value={unresolvedCastCandidates} />
          <Stat label="Bible Versions" value={intelligence.bibles.versions.length} />
          <Stat label="Script Locations" value={scriptDetectedLocations} />

          <Stat label="Approved Locations" value={approvedWorldLocations} />
          <Stat label="Unresolved World" value={Math.max(0, unresolvedWorldCandidates)} />
          <Stat label="Scenes" value={intelligence.scenes.length} />
          <Stat label="Sources" value={intelligence.sources.length} />
          <Stat label="Continuity Questions" value={continuityQuestions} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-3 flex items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground">
            Re-run scene heading auto-linking against world locations. Idempotent — preserves manual edits.
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => relink.mutate()}
            disabled={relink.isPending}
          >
            {relink.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            ) : (
              <Link2 className="h-3.5 w-3.5 mr-1.5" />
            )}
            Re-link scene locations
          </Button>
        </CardContent>
      </Card>

      <Card>

        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Needs Connection
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {!anyNeedsConnection && (
            <p className="text-muted-foreground">
              Everything connected. Nothing needs attention right now.
            </p>
          )}

          <NeedsRow
            visible={d.manualCharactersMissingFromBible.length > 0}
            label={`${d.manualCharactersMissingFromBible.length} project character${d.manualCharactersMissingFromBible.length === 1 ? "" : "s"} missing from latest Bible`}
            actionLabel="Open Character Bible"
            to="/character-bible/$projectId/$universeId"
            params={{ projectId, universeId }}
          />

          <NeedsRow
            visible={d.importedCandidatesUnresolved.length > 0}
            label={`${d.importedCandidatesUnresolved.length} imported character candidate${d.importedCandidatesUnresolved.length === 1 ? "" : "s"} unresolved`}
            actionLabel="Open Candidate Inbox"
            to="/cast/$projectId"
            params={{ projectId }}
          />

          <NeedsRow
            visible={d.sceneLocationsWithoutWorldLink.length > 0}
            label={`${d.sceneLocationsWithoutWorldLink.length} scene location${d.sceneLocationsWithoutWorldLink.length === 1 ? "" : "s"} not linked to world_locations (Phase 4)`}
            actionLabel="View Scenes"
            to="/scenes/$projectId"
            params={{ projectId }}
          />

          <NeedsRow
            visible={d.worldEntitiesWithoutEvidence.length > 0}
            label={`${d.worldEntitiesWithoutEvidence.length} world entit${d.worldEntitiesWithoutEvidence.length === 1 ? "y" : "ies"} without source evidence`}
            actionLabel="Review in Importation"
            to="/importation/$projectId/$universeId"
            params={{ projectId, universeId }}
          />

          <NeedsRow
            visible={d.possibleCharacterDuplicates.length > 0}
            label={`${d.possibleCharacterDuplicates.length} possible duplicate character${d.possibleCharacterDuplicates.length === 1 ? "" : "s"} (review only, no auto-merge)`}
            actionLabel="Open Cast"
            to="/cast/$projectId"
            params={{ projectId }}
          />

          <NeedsRow
            visible={d.possibleLocationDuplicates.length > 0}
            label={`${d.possibleLocationDuplicates.length} possible duplicate location${d.possibleLocationDuplicates.length === 1 ? "" : "s"}`}
            actionLabel="Review in Importation"
            to="/importation/$projectId/$universeId"
            params={{ projectId, universeId }}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function NeedsRow({
  visible,
  label,
  actionLabel,
  to,
  params,
}: {
  visible: boolean;
  label: string;
  actionLabel: string;
  to: any;
  params: any;
}) {
  if (!visible) return null;
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border/40 p-2">
      <span className="text-sm">{label}</span>
      <Link
        to={to}
        params={params}
        className="text-xs underline whitespace-nowrap"
      >
        {actionLabel}
      </Link>
    </div>
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
            key={r.version}
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
            <div className="font-medium">{r.name ?? r.label ?? "(unnamed)"}</div>
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
