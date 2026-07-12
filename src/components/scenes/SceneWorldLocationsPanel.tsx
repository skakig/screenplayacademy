/**
 * Per-scene view of linked world_locations (project_world_usage rows where
 * usage_kind='setting'). Allows unlinking and re-linking to a location entity
 * in the project's default universe.
 */
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  listProjectWorldUsage,
  linkProjectWorldUsage,
  unlinkProjectWorldUsage,
  listWorldEntities,
} from "@/lib/world/worldGraph.functions";
import { autoLinkSceneLocations } from "@/lib/editor/sceneWorldLink.functions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MapPin, Link2Off, Wand2 } from "lucide-react";
import { toast } from "sonner";

type PendingUnlink = {
  id: string;
  entityId: string;
  usageKind: string;
  name: string;
};


interface Props {
  projectId: string;
  sceneId: string;
  universeId: string | null;
}

export function SceneWorldLocationsPanel({ projectId, sceneId, universeId }: Props) {
  const qc = useQueryClient();
  const [choice, setChoice] = useState<string>("");
  const [pendingUnlink, setPendingUnlink] = useState<PendingUnlink | null>(null);


  const listUsage = useServerFn(listProjectWorldUsage);
  const listEntities = useServerFn(listWorldEntities);
  const linkUsage = useServerFn(linkProjectWorldUsage);
  const unlinkUsage = useServerFn(unlinkProjectWorldUsage);
  const autoLink = useServerFn(autoLinkSceneLocations);

  const usageQ = useQuery({
    queryKey: ["scene-world-usage", projectId, sceneId],
    queryFn: () => listUsage({ data: { projectId, sceneId, limit: 100 } }),
  });

  const entitiesQ = useQuery({
    queryKey: ["world-entities", universeId, "location"],
    enabled: !!universeId,
    queryFn: () =>
      listEntities({
        data: { universeId: universeId!, kind: "location", limit: 300 },
      }),
  });

  const usageRows = usageQ.data ?? [];
  const entities = entitiesQ.data ?? [];

  // Resolve entity names for usage rows (may include non-location kinds too).
  const usageEntityIds = useMemo(
    () => Array.from(new Set(usageRows.map((u) => u.entity_id))),
    [usageRows],
  );
  const namesQ = useQuery({
    queryKey: ["world-entity-names", usageEntityIds.sort().join(",")],
    enabled: usageEntityIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("world_entities")
        .select("id, name, entity_kind")
        .in("id", usageEntityIds);
      if (error) throw error;
      return data ?? [];
    },
  });
  const nameById = new Map(
    (namesQ.data ?? []).map((e) => [e.id, e]),
  );

  const linkedIds = new Set(usageRows.map((u) => u.entity_id));
  const linkable = entities.filter((e) => !linkedIds.has(e.id));

  const link = useMutation({
    mutationFn: async (entityId: string) =>
      linkUsage({
        data: { projectId, entityId, sceneId, usageKind: "setting" },
      }),
    onSuccess: () => {
      setChoice("");
      qc.invalidateQueries({ queryKey: ["scene-world-usage", projectId, sceneId] });
      toast.success("Location linked");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to link"),
  });

  const unlink = useMutation({
    mutationFn: async (target: PendingUnlink) =>
      unlinkUsage({ data: { id: target.id } }).then(() => target),
    onSuccess: (target) => {
      qc.invalidateQueries({ queryKey: ["scene-world-usage", projectId, sceneId] });
      toast.success(`Unlinked ${target.name}`, {
        action: {
          label: "Undo",
          onClick: () => {
            linkUsage({
              data: {
                projectId,
                entityId: target.entityId,
                sceneId,
                usageKind: target.usageKind as any,
              },
            })
              .then(() => {
                qc.invalidateQueries({
                  queryKey: ["scene-world-usage", projectId, sceneId],
                });
                toast.success(`Restored ${target.name}`);
              })
              .catch((e: any) =>
                toast.error(e?.message ?? "Failed to restore link"),
              );
          },
        },
        duration: 10000,
      });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to unlink"),
  });


  const auto = useMutation({
    mutationFn: async () => autoLink({ data: { projectId } }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["scene-world-usage", projectId, sceneId] });
      qc.invalidateQueries({ queryKey: ["world-entities", universeId, "location"] });
      toast.success(
        `Auto-link ran (${res.locationsEnsured} created, ${res.usageLinked} usage rows)`,
      );
    },
    onError: (e: any) => toast.error(e?.message ?? "Auto-link failed"),
  });

  if (!universeId) {
    return (
      <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
        Set a default universe on this project to link scene locations.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5" /> Linked world locations
        </Label>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 text-xs"
          disabled={auto.isPending}
          onClick={() => auto.mutate()}
          title="Scan all scene headings and auto-link locations"
        >
          <Wand2 className="h-3 w-3 mr-1" />
          {auto.isPending ? "Scanning…" : "Auto-link from headings"}
        </Button>
      </div>

      {usageQ.isLoading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : usageRows.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No world locations linked to this scene yet.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {usageRows.map((u) => {
            const ent = nameById.get(u.entity_id);
            return (
              <li
                key={u.id}
                className="flex items-center justify-between rounded-md border bg-muted/30 px-2.5 py-1.5"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm truncate">
                    {ent?.name ?? "Unknown entity"}
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    {u.usage_kind}
                  </Badge>
                  {ent && ent.entity_kind !== "location" && (
                    <Badge variant="secondary" className="text-[10px]">
                      {ent.entity_kind}
                    </Badge>
                  )}
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  disabled={unlink.isPending}
                  onClick={() =>
                    setPendingUnlink({
                      id: u.id,
                      entityId: u.entity_id,
                      usageKind: u.usage_kind,
                      name: ent?.name ?? "this location",
                    })
                  }
                  aria-label="Unlink location"
                >
                  <Link2Off className="h-3 w-3" />
                </Button>

              </li>
            );
          })}
        </ul>
      )}

      <div className="flex items-center gap-2 pt-1">
        <Select value={choice} onValueChange={setChoice}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue
              placeholder={
                entitiesQ.isLoading
                  ? "Loading locations…"
                  : linkable.length === 0
                    ? "All locations already linked"
                    : "Link a location…"
              }
            />
          </SelectTrigger>
          <SelectContent>
            {linkable.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          size="sm"
          className="h-8"
          disabled={!choice || link.isPending}
          onClick={() => choice && link.mutate(choice)}
        >
          Link
        </Button>
      </div>

      <AlertDialog
        open={pendingUnlink !== null}
        onOpenChange={(open) => {
          if (!open) setPendingUnlink(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unlink this world location?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingUnlink
                ? `"${pendingUnlink.name}" will be removed from this scene. You can undo this for 10 seconds.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingUnlink) unlink.mutate(pendingUnlink);
                setPendingUnlink(null);
              }}
            >
              Unlink
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );

}
