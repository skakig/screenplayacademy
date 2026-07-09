import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { VaultCorkboard } from "@/components/vault/VaultCorkboard";
import { VaultSceneDialog } from "@/components/vault/VaultSceneDialog";
import { SuggestPlacementDialog } from "@/components/vault/SuggestPlacementDialog";
import { IntegrateDialog } from "@/components/vault/IntegrateDialog";
import {
  archiveVaultScene,
  duplicateAsAlternate,
  listVaultScenes,
} from "@/lib/vault/vaultScenes.functions";
import type { VaultSceneRow } from "@/lib/vault/schemas";

export const Route = createFileRoute("/_authenticated/vault/$projectId")({
  head: () => ({
    meta: [
      { title: "Scene Vault — SceneSmith Studio" },
      {
        name: "description",
        content:
          "Stash scenes, dialogue fragments, set pieces, and alternate takes. Integrate them into your timeline when they're ready.",
      },
    ],
  }),
  component: VaultPage,
  errorComponent: ({ error }) => (
    <div className="p-8 text-sm text-destructive">Something broke: {error.message}</div>
  ),
  notFoundComponent: () => <div className="p-8 text-sm">Project not found.</div>,
});

function VaultPage() {
  const { projectId } = Route.useParams();
  const qc = useQueryClient();

  const listFn = useServerFn(listVaultScenes);
  const archiveFn = useServerFn(archiveVaultScene);
  const dupFn = useServerFn(duplicateAsAlternate);

  const [editing, setEditing] = useState<VaultSceneRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [suggestFor, setSuggestFor] = useState<VaultSceneRow | null>(null);
  const [integrateFor, setIntegrateFor] = useState<VaultSceneRow | null>(null);
  const [prefill, setPrefill] = useState<{
    destination: string;
    referenceSceneId: string | null;
    position: "before" | "after";
  } | null>(null);

  const { data: project } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => (await supabase.from("projects").select("id, title").eq("id", projectId).single()).data,
  });

  const { data: scenes = [], isLoading } = useQuery({
    queryKey: ["vault-scenes", projectId],
    queryFn: () => listFn({ data: { projectId } }),
  });

  const { data: timelineScenes = [] } = useQuery({
    queryKey: ["scenes", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scenes")
        .select("id, title, scene_heading, order_index")
        .eq("project_id", projectId)
        .order("order_index");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: characters = [] } = useQuery({
    queryKey: ["characters", projectId, "min"],
    queryFn: async () => {
      const { data } = await supabase
        .from("characters")
        .select("id, name")
        .eq("project_id", projectId)
        .order("name");
      return data ?? [];
    },
  });

  const archive = useMutation({
    mutationFn: (id: string) => archiveFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vault-scenes", projectId] });
      toast.success("Archived");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const duplicate = useMutation({
    mutationFn: (id: string) => dupFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vault-scenes", projectId] });
      toast.success("Alt take pinned");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell>
      <div
        className="min-h-[calc(100vh-4rem)] bg-[radial-gradient(circle_at_20%_10%,hsl(35,45%,88%),transparent_60%),radial-gradient(circle_at_80%_90%,hsl(25,35%,82%),transparent_55%)] dark:bg-[radial-gradient(circle_at_20%_10%,hsl(30,15%,16%),transparent_60%),radial-gradient(circle_at_80%_90%,hsl(20,15%,12%),transparent_55%)]"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                {project?.title ?? "Project"}
              </div>
              <h1 className="font-display text-3xl sm:text-4xl">Scene Vault</h1>
              <p className="text-sm text-muted-foreground max-w-xl mt-1">
                A corkboard for scenes that don't have a home yet. Pin things. Come back later.
              </p>
            </div>
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4 mr-1.5" /> New Vault Item
            </Button>
          </div>

          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading the board…</div>
          ) : (
            <VaultCorkboard
              scenes={scenes}
              onEdit={setEditing}
              onSuggest={setSuggestFor}
              onIntegrate={setIntegrateFor}
              onDuplicate={(s) => duplicate.mutate(s.id)}
              onArchive={(s) => archive.mutate(s.id)}
            />
          )}
        </div>
      </div>

      {creating && (
        <VaultSceneDialog
          open={creating}
          onOpenChange={setCreating}
          projectId={projectId}
          characters={characters}
        />
      )}
      {editing && (
        <VaultSceneDialog
          open={!!editing}
          onOpenChange={(v) => { if (!v) setEditing(null); }}
          projectId={projectId}
          scene={editing}
          characters={characters}
        />
      )}
      {suggestFor && (
        <SuggestPlacementDialog
          open={!!suggestFor}
          onOpenChange={(v) => { if (!v) setSuggestFor(null); }}
          scene={suggestFor}
          scenes={timelineScenes}
          onPick={(destination, referenceSceneId, position) => {
            const s = suggestFor;
            setSuggestFor(null);
            setPrefill({ destination, referenceSceneId, position });
            setIntegrateFor(s);
          }}
        />
      )}
      {integrateFor && (
        <IntegrateDialog
          key={integrateFor.id + (prefill?.referenceSceneId ?? "")}
          open={!!integrateFor}
          onOpenChange={(v) => { if (!v) { setIntegrateFor(null); setPrefill(null); } }}
          scene={integrateFor}
          scenes={timelineScenes}
        />
      )}
    </AppShell>
  );
}
