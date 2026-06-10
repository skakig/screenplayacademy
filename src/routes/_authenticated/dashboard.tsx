import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Film, Tv, Clapperboard, BookOpen, FileText } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { useOnboarding } from "@/hooks/use-onboarding";
import { GuidedDashboard } from "@/components/dashboard/GuidedDashboard";
import { seedGuidedSteps } from "@/lib/academy.functions";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — SceneSmith AI" }] }),
  component: Dashboard,
});

const PROJECT_TYPES = [
  { value: "Feature Film", icon: Film },
  { value: "TV Pilot", icon: Tv },
  { value: "Short Film", icon: Clapperboard },
  { value: "Comic Script", icon: BookOpen },
  { value: "Stage Play", icon: FileText },
  { value: "Audio Drama", icon: FileText },
];

function Dashboard() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { data: onboarding, isLoading: onboardingLoading } = useOnboarding();
  const seedFn = useServerFn(seedGuidedSteps);

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async (input: any) => {
      const { data: u } = await supabase.auth.getUser();
      const { data, error } = await supabase.from("projects").insert({ ...input, user_id: u.user!.id }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: async (p) => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      setOpen(false);
      toast.success("Project created");
      if (onboarding?.preferred_mode === "guided") {
        try { await seedFn({ data: { projectId: p.id } }); } catch { /* ignore */ }
        navigate({ to: "/first-screenplay/$projectId", params: { projectId: p.id } });
      } else {
        navigate({ to: "/editor/$projectId", params: { projectId: p.id } });
      }
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Redirect to onboarding if user has no row
  useEffect(() => {
    if (!onboardingLoading && !onboarding) {
      navigate({ to: "/onboarding", replace: true });
    }
  }, [onboardingLoading, onboarding, navigate]);

  if (!onboardingLoading && !onboarding) return null;

  if (onboarding?.preferred_mode === "guided") {
    return <AppShell><GuidedDashboard /></AppShell>;
  }


  return (
    <AppShell>
      <div className="max-w-[1400px] mx-auto px-4 py-10">
        <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Studio Lobby</h1>
            <p className="text-muted-foreground mt-1">Every great film starts with a blank page. Yours doesn't have to.</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="shadow-lg shadow-primary/20"><Plus className="h-4 w-4 mr-2" />Start a Script</Button>
            </DialogTrigger>
            <NewProjectDialog onCreate={(v) => create.mutate(v)} loading={create.isPending} />
          </Dialog>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-10">
          {PROJECT_TYPES.map(({ value, icon: Icon }) => (
            <button
              key={value}
              onClick={() => { setOpen(true); }}
              className="group p-4 rounded-lg bg-card border border-border/60 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 transition text-left"
            >
              <Icon className="h-5 w-5 text-primary mb-2 group-hover:scale-110 transition" />
              <div className="text-xs text-muted-foreground">New</div>
              <div className="text-sm font-medium">{value}</div>
            </button>
          ))}
        </div>

        <h2 className="text-xl font-semibold mb-4">In Production</h2>
        {isLoading ? (
          <div className="text-muted-foreground">Loading...</div>
        ) : projects.length === 0 ? (
          <Card className="p-12 text-center border-dashed">
            <Film className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-semibold mb-1">The page is waiting</h3>
            <p className="text-sm text-muted-foreground mb-4">Start your first screenplay to open the Writer's Desk.</p>
            <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" />Start a Script</Button>
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((p) => (
              <Link key={p.id} to="/editor/$projectId" params={{ projectId: p.id }}>
                <Card className="p-5 h-full hover:border-primary/60 hover:shadow-lg hover:shadow-primary/10 transition cursor-pointer group">
                  <div className="flex items-start justify-between mb-2">
                    <Badge variant="secondary" className="text-[10px]">{p.project_type}</Badge>
                    <Badge variant="outline" className="text-[10px]">{p.status}</Badge>
                  </div>
                  <h3 className="font-display text-xl font-semibold group-hover:text-primary transition">{p.title}</h3>
                  {p.genre && <p className="text-xs text-muted-foreground mt-1">{p.genre}{p.tone ? ` · ${p.tone}` : ""}</p>}
                  {p.logline && <p className="text-sm text-muted-foreground mt-3 line-clamp-2">{p.logline}</p>}
                  <p className="text-xs text-muted-foreground mt-4">Updated {formatDistanceToNow(new Date(p.updated_at), { addSuffix: true })}</p>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function NewProjectDialog({ onCreate, loading }: { onCreate: (v: any) => void; loading: boolean }) {
  const [form, setForm] = useState({
    title: "", project_type: "Feature Film", genre: "", tone: "", target_length: "", logline: "", ai_help_level: "Balanced",
  });
  return (
    <DialogContent className="max-w-lg">
      <DialogHeader><DialogTitle>New Project</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div><Label>Title *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="The Last Lighthouse" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Type</Label>
            <Select value={form.project_type} onValueChange={(v) => setForm({ ...form, project_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PROJECT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.value}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Genre</Label><Input value={form.genre} onChange={(e) => setForm({ ...form, genre: e.target.value })} placeholder="Thriller" /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Tone</Label><Input value={form.tone} onChange={(e) => setForm({ ...form, tone: e.target.value })} placeholder="Atmospheric, slow-burn" /></div>
          <div>
            <Label>AI Help Level</Label>
            <Select value={form.ai_help_level} onValueChange={(v) => setForm({ ...form, ai_help_level: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Minimal">Minimal</SelectItem>
                <SelectItem value="Balanced">Balanced</SelectItem>
                <SelectItem value="Heavy">Heavy</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div><Label>Logline</Label><Textarea value={form.logline} onChange={(e) => setForm({ ...form, logline: e.target.value })} placeholder="A retired lighthouse keeper must..." rows={3} /></div>
        <Button className="w-full" disabled={!form.title || loading} onClick={() => onCreate(form)}>
          {loading ? "Creating..." : "Create Project"}
        </Button>
      </div>
    </DialogContent>
  );
}
