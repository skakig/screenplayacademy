/**
 * Right-side scene world context panel.
 *
 * Consumes `getSceneWorldContext` and renders one card per linked world
 * entity, with outgoing and incoming relationship edges to sibling entities.
 * Read-only — editing lives in `SceneWorldLocationsPanel` and the world
 * entity editor routes.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSceneWorldContext } from "@/lib/world/worldGraph.functions";
import { autoLinkSceneLocations } from "@/lib/editor/sceneWorldLink.functions";
import { sceneWorldContextQueryKey } from "@/hooks/useSceneWorldContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import {
  ArrowRight,
  ArrowLeft,
  Globe2,
  MapPin,
  Users,
  Shield,
  Sparkles,
  Landmark,
  Swords,
  Boxes,
  Clock,
  Wand2,
  Loader2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface Props {
  projectId: string;
  sceneId: string;
}

const KIND_ICON: Record<string, LucideIcon> = {
  location: MapPin,
  faction: Shield,
  character: Users,
  event: Clock,
  artifact: Boxes,
  rule: Sparkles,
  institution: Landmark,
  species: Users,
  creature: Swords,
  culture: Users,
};

function kindIcon(kind: string): LucideIcon {
  return KIND_ICON[kind] ?? Globe2;
}

export function SceneWorldContextPanel({ projectId, sceneId }: Props) {
  const getCtx = useServerFn(getSceneWorldContext);
  const autoLink = useServerFn(autoLinkSceneLocations);
  const qc = useQueryClient();
  const ctxQ = useQuery({
    queryKey: sceneWorldContextQueryKey(projectId, sceneId),
    queryFn: () => getCtx({ data: { projectId, sceneId } }),
  });

  const auto = useMutation({
    mutationFn: async () => autoLink({ data: { projectId } }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: sceneWorldContextQueryKey(projectId, sceneId) });
      qc.invalidateQueries({ queryKey: ["scene-world-usage", projectId, sceneId] });
      const linked = (res as any)?.usageLinked ?? 0;
      const created = (res as any)?.locationsEnsured ?? 0;
      toast.success(
        linked > 0 || created > 0
          ? `Auto-linked ${linked} usage row${linked === 1 ? "" : "s"}${created > 0 ? ` (${created} new)` : ""}`
          : "No new links found from scene headings",
      );
    },
    onError: (e: any) => toast.error(e?.message ?? "Auto-link failed"),
  });

  if (ctxQ.isLoading) {
    return (
      <div className="text-xs text-muted-foreground">Loading world context…</div>
    );
  }
  if (ctxQ.isError) {
    return (
      <div className="text-xs text-destructive">
        Couldn't load world context.
      </div>
    );
  }

  const entities = ctxQ.data?.entities ?? [];

  if (entities.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-4 flex flex-col items-center text-center gap-2">
        <Globe2 className="h-5 w-5 text-muted-foreground" />
        <div className="text-sm font-medium">No world entities linked</div>
        <p className="text-xs text-muted-foreground max-w-xs">
          Link a location manually above, or auto-link from this scene's
          heading (e.g. <span className="font-mono">INT. FORT AEGIS</span>).
        </p>
        <Button
          size="sm"
          variant="secondary"
          className="mt-1"
          onClick={() => auto.mutate()}
          disabled={auto.isPending}
        >
          {auto.isPending ? (
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
          ) : (
            <Wand2 className="h-3.5 w-3.5 mr-1.5" />
          )}
          Auto-link from headings
        </Button>
      </div>
    );
  }


  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-medium">
        <Globe2 className="h-3.5 w-3.5" /> Scene world context
        <Badge variant="secondary" className="text-[10px] ml-1">
          {entities.length}
        </Badge>
      </div>
      <ul className="space-y-2">
        {entities.map((ctx) => {
          const Icon = kindIcon(ctx.entity.entity_kind);
          return (
            <li key={ctx.entity.id}>
            <Card className="p-3 space-y-2 bg-muted/20">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="text-sm font-medium truncate">
                      {ctx.entity.name}
                    </span>
                  </div>
                  {ctx.entity.summary && (
                    <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                      {ctx.entity.summary}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <Badge variant="outline" className="text-[9px] capitalize">
                    {ctx.entity.entity_kind}
                  </Badge>
                  <Badge variant="secondary" className="text-[9px] capitalize">
                    {ctx.usage.usage_kind}
                  </Badge>
                </div>
              </div>

              {(ctx.outgoing.length > 0 || ctx.incoming.length > 0) && (
                <div className="space-y-1 pt-1 border-t border-border/50">
                  {ctx.outgoing.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center gap-1.5 text-[11px] text-muted-foreground"
                    >
                      <ArrowRight className="h-3 w-3 text-primary/70 shrink-0" />
                      <span className="capitalize text-foreground/80">
                        {r.relationship_type.replace(/_/g, " ")}
                      </span>
                      <span className="truncate">
                        {r.other?.name ?? "Unknown"}
                      </span>
                      {r.other?.entity_kind && (
                        <Badge
                          variant="outline"
                          className="text-[9px] capitalize ml-auto"
                        >
                          {r.other.entity_kind}
                        </Badge>
                      )}
                    </div>
                  ))}
                  {ctx.incoming.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center gap-1.5 text-[11px] text-muted-foreground"
                    >
                      <ArrowLeft className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="capitalize text-foreground/80">
                        {r.relationship_type.replace(/_/g, " ")}
                      </span>
                      <span className="truncate">
                        {r.other?.name ?? "Unknown"}
                      </span>
                      {r.other?.entity_kind && (
                        <Badge
                          variant="outline"
                          className="text-[9px] capitalize ml-auto"
                        >
                          {r.other.entity_kind}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
