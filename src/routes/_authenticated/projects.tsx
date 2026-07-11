import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Film, Search, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { InviteCollaboratorDialog } from "@/components/writers-room/InviteCollaboratorDialog";

export const Route = createFileRoute("/_authenticated/projects")({
  head: () => ({ meta: [{ title: "Projects — SceneSmith AI" }] }),
  component: Projects,
});

function Projects() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("projects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["projects"] }); toast.success("Project deleted"); },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = projects.filter((p) => p.title.toLowerCase().includes(q.toLowerCase()));

  return (
    <AppShell>
      <div className="max-w-[1400px] mx-auto px-4 py-10">
        <div className="flex items-end justify-between flex-wrap gap-4 mb-6">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Script Vault</h1>
            <p className="text-muted-foreground mt-1">Every screenplay in one place.</p>
          </div>
          <Button size="lg" onClick={() => navigate({ to: "/projects/new" })}><Plus className="h-4 w-4 mr-2" />Start a Script</Button>
        </div>
        <div className="relative mb-6 max-w-md">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the vault..." className="pl-9" />
        </div>

        {isLoading ? (
          <div className="text-muted-foreground">Loading...</div>
        ) : filtered.length === 0 ? (
          <Card className="p-12 text-center border-dashed">
            <Film className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-semibold mb-1">The vault is empty</h3>
            <p className="text-sm text-muted-foreground mb-4">Start your first screenplay — the page is waiting.</p>
            <Button onClick={() => navigate({ to: "/projects/new" })}><Plus className="h-4 w-4 mr-2" />Start a Script</Button>
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((p) => (
              <Card key={p.id} className="p-5 group hover:border-primary/60 hover:shadow-lg hover:shadow-primary/10 transition relative">
                <Link to="/editor/$projectId" params={{ projectId: p.id }} className="block">
                  <div className="flex items-start justify-between mb-2">
                    <Badge variant="secondary" className="text-[10px]">{p.project_type}</Badge>
                    <Badge variant="outline" className="text-[10px]">{p.status}</Badge>
                  </div>
                  <h3 className="font-display text-xl font-semibold group-hover:text-primary transition">{p.title}</h3>
                  {p.genre && <p className="text-xs text-muted-foreground mt-1">{p.genre}{p.tone ? ` · ${p.tone}` : ""}</p>}
                  {p.logline && <p className="text-sm text-muted-foreground mt-3 line-clamp-2">{p.logline}</p>}
                  <p className="text-xs text-muted-foreground mt-4">Updated {formatDistanceToNow(new Date(p.updated_at), { addSuffix: true })}</p>
                </Link>
                <button
                  onClick={(e) => { e.preventDefault(); if (confirm(`Delete "${p.title}"? This cannot be undone.`)) del.mutate(p.id); }}
                  className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition p-1.5 rounded hover:bg-destructive/15 text-muted-foreground hover:text-destructive"
                  aria-label="Delete project"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
