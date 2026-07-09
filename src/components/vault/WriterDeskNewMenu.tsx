import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, FileText, Archive, MessageSquare, Camera, Copy } from "lucide-react";
import { VaultSceneDialog } from "./VaultSceneDialog";
import { listVaultScenes } from "@/lib/vault/vaultScenes.functions";
import { supabase } from "@/integrations/supabase/client";
import type { VaultKind } from "@/lib/vault/schemas";

/**
 * Writer's Desk "New…" widget. Renders a compact floating button that lets
 * the writer create a Timeline Scene, Vault Scene, Dialogue Fragment,
 * Set Piece, or Alternate Take from anywhere in the editor.
 */
export function WriterDeskNewMenu({
  projectId,
  onCreateTimelineScene,
}: {
  projectId: string;
  onCreateTimelineScene?: () => void;
}) {
  const [openKind, setOpenKind] = useState<VaultKind | null>(null);
  const listFn = useServerFn(listVaultScenes);

  const { data: vault = [] } = useQuery({
    queryKey: ["vault-scenes", projectId],
    queryFn: () => listFn({ data: { projectId } }),
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

  const count = vault.filter((v) => v.status !== "deleted").length;

  return (
    <>
      <div className="fixed bottom-5 right-5 z-30 flex items-center gap-2">
        <Link
          to="/vault/$projectId"
          params={{ projectId }}
          className="text-[11px] px-2.5 py-1 rounded-full bg-background/90 backdrop-blur border border-border/60 shadow-sm hover:bg-muted transition"
          title="Open the Scene Vault"
        >
          <Archive className="inline h-3 w-3 mr-1" />
          Vault ({count})
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" className="shadow-lg gap-1.5">
              <Plus className="h-4 w-4" /> New…
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="w-56">
            <DropdownMenuLabel>Writer's Desk</DropdownMenuLabel>
            {onCreateTimelineScene && (
              <DropdownMenuItem onClick={onCreateTimelineScene}>
                <FileText className="h-3.5 w-3.5 mr-2" /> Timeline Scene
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setOpenKind("vault_scene")}>
              <Archive className="h-3.5 w-3.5 mr-2" /> Vault Scene
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setOpenKind("dialogue_fragment")}>
              <MessageSquare className="h-3.5 w-3.5 mr-2" /> Dialogue Fragment
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setOpenKind("set_piece")}>
              <Camera className="h-3.5 w-3.5 mr-2" /> Set Piece
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setOpenKind("alternate_take")}>
              <Copy className="h-3.5 w-3.5 mr-2" /> Alternate Take
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {openKind && (
        <VaultSceneDialog
          open={!!openKind}
          onOpenChange={(v) => { if (!v) setOpenKind(null); }}
          projectId={projectId}
          defaultKind={openKind}
          characters={characters}
        />
      )}
    </>
  );
}
