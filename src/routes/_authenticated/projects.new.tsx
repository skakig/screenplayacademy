import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useOnboarding } from "@/hooks/use-onboarding";
import { seedGuidedSteps } from "@/lib/academy.functions";

export const Route = createFileRoute("/_authenticated/projects/new")({
  head: () => ({ meta: [{ title: "Start a Script — SceneSmith AI" }] }),
  component: NewProject,
});

const PROJECT_TYPES = ["Feature Film", "TV Pilot", "Short Film", "Comic Script", "Stage Play", "Audio Drama"];

function NewProject() {
  const navigate = useNavigate();
  const { data: onboarding } = useOnboarding();
  const seedFn = useServerFn(seedGuidedSteps);
  const [form, setForm] = useState({
    title: "", project_type: "Feature Film", genre: "", tone: "",
    target_length: "", logline: "", ai_help_level: "Balanced",
  });
  const create = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { data, error } = await supabase.from("projects").insert({ ...form, user_id: u.user!.id }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: async (p) => {
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

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-4 py-10">
        <Link to="/projects" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4">
          <ArrowLeft className="h-3 w-3" /> Back to the vault
        </Link>
        <h1 className="text-3xl font-bold tracking-tight mb-1">Start a Script</h1>
        <p className="text-muted-foreground mb-6">Tell us about your story. You can change all of this later.</p>
        <Card className="p-6 space-y-4">
          <div>
            <Label>Title *</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="The Last Lighthouse" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Type</Label>
              <Select value={form.project_type} onValueChange={(v) => setForm({ ...form, project_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PROJECT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Genre</Label>
              <Input value={form.genre} onChange={(e) => setForm({ ...form, genre: e.target.value })} placeholder="Thriller" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tone</Label>
              <Input value={form.tone} onChange={(e) => setForm({ ...form, tone: e.target.value })} placeholder="Slow-burn, atmospheric" />
            </div>
            <div>
              <Label>Target length</Label>
              <Input value={form.target_length} onChange={(e) => setForm({ ...form, target_length: e.target.value })} placeholder="~110 pages" />
            </div>
          </div>
          <div>
            <Label>AI help level</Label>
            <Select value={form.ai_help_level} onValueChange={(v) => setForm({ ...form, ai_help_level: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Minimal">Minimal — I write, AI assists rarely</SelectItem>
                <SelectItem value="Balanced">Balanced — partner mode</SelectItem>
                <SelectItem value="Heavy">Heavy — AI co-writer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Logline (optional)</Label>
            <Textarea value={form.logline} onChange={(e) => setForm({ ...form, logline: e.target.value })} placeholder="A retired lighthouse keeper must..." rows={3} />
          </div>
          <Button className="w-full" size="lg" disabled={!form.title || create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? "Creating..." : "Create & Start Writing"}
          </Button>
        </Card>
      </div>
    </AppShell>
  );
}
