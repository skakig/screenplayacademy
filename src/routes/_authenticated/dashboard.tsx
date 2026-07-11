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
import { Plus, Film, Tv, Clapperboard, BookOpen, FileText, Lightbulb, Type, ListOrdered, Pencil, RefreshCw, Mic, Presentation, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { useOnboarding } from "@/hooks/use-onboarding";
import { GuidedDashboard } from "@/components/dashboard/GuidedDashboard";
import { seedGuidedSteps } from "@/lib/academy.functions";
import { t } from "@/lib/i18n/t";
import { VoiceCreditsPanel } from "@/components/dashboard/VoiceCreditsPanel";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Studio Lobby — SceneSmith Studio" }] }),
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

const PIPELINE = [
  { key: "idea", label: "Idea", icon: Lightbulb },
  { key: "logline", label: "Logline", icon: Type },
  { key: "outline", label: "Outline", icon: ListOrdered },
  { key: "beats", label: "Beat Sheet", icon: ListOrdered },
  { key: "draft", label: "Draft", icon: Pencil },
  { key: "revision", label: "Revision", icon: RefreshCw },
  { key: "tableread", label: "Table Read", icon: Mic },
  { key: "pitch", label: "Pitch", icon: Presentation },
];

function ProjectStageIndex(status?: string | null) {
  // Map free-form project status to a pipeline stage index (best-effort).
  const s = (status ?? "").toLowerCase();
  if (s.includes("pitch")) return 7;
  if (s.includes("table")) return 6;
  if (s.includes("revis") || s.includes("rewrite")) return 5;
  if (s.includes("draft") || s.includes("writ")) return 4;
  if (s.includes("beat")) return 3;
  if (s.includes("outline")) return 2;
  if (s.includes("log")) return 1;
  return 0;
}

function PipelineStrip({ stageIndex }: { stageIndex: number }) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1" aria-label="Screenplay pipeline">
      {PIPELINE.map((stage, i) => {
        const Icon = stage.icon;
        const active = i === stageIndex;
        const done = i < stageIndex;
        return (
          <div key={stage.key} className="flex items-center shrink-0">
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-mono uppercase tracking-[0.12em] transition ${
                active
                  ? "bg-primary/15 border-primary/60 text-primary"
                  : done
                    ? "bg-primary/[0.04] border-primary/20 text-primary/70"
                    : "bg-card border-border/50 text-muted-foreground"
              }`}
            >
              <Icon className="h-3 w-3" />
              <span>{stage.label}</span>
            </div>
            {i < PIPELINE.length - 1 && (
              <div className={`h-px w-3 mx-0.5 ${i < stageIndex ? "bg-primary/40" : "bg-border"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function Dashboard() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [initialType, setInitialType] = useState<string>("Feature Film");
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
      toast.success(t("dashboard.toast.created"));
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

  const mostRecent = projects[0];

  return (
    <AppShell>
      <div className="max-w-[1400px] mx-auto px-4 py-10">
        {/* Marquee header */}
        <div className="relative rounded-xl border border-border/60 p-6 md:p-8 mb-8 overflow-hidden"
          style={{ background: "var(--gradient-cinematic)", boxShadow: "var(--shadow-cinematic)" }}>
          <div className="absolute inset-0 opacity-[0.07] pointer-events-none"
            style={{ backgroundImage: "radial-gradient(circle at 15% 25%, var(--primary) 0, transparent 38%), radial-gradient(circle at 85% 75%, var(--accent) 0, transparent 42%)" }} />
          <div className="relative flex items-end justify-between flex-wrap gap-4">
            <div>
              <p className="font-mono uppercase tracking-[0.22em] text-[10px] text-primary/80 mb-2">{t("dashboard.studio_lobby")}</p>
              <h1 className="font-display text-4xl md:text-5xl font-semibold tracking-tight">{t("dashboard.welcome_back")}</h1>
              <p className="font-script italic text-muted-foreground mt-2 text-base md:text-lg">
                {t("dashboard.tagline")}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {mostRecent && (
                <Button asChild size="lg" className="shadow-lg shadow-primary/20 max-w-[22rem]">
                  <Link to="/editor/$projectId" params={{ projectId: mostRecent.id }}>
                    <PlayCircle className="h-4 w-4 mr-2 shrink-0" />
                    <span className="truncate">{t("dashboard.continue_prefix", { title: mostRecent.title })}</span>
                  </Link>
                </Button>
              )}
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button
                    size="lg"
                    variant={mostRecent ? "outline" : "default"}
                    className={mostRecent ? "" : "shadow-lg shadow-primary/20"}
                    onClick={() => setInitialType("Feature Film")}
                  >
                    <Plus className="h-4 w-4 mr-2" />{t("dashboard.start_project")}
                  </Button>
                </DialogTrigger>
                <NewProjectDialog
                  open={open}
                  initialType={initialType}
                  onCreate={(v) => create.mutate(v)}
                  loading={create.isPending}
                />
              </Dialog>
            </div>
          </div>
        </div>

        {/* Quick-start: format slates */}
        <p className="font-mono uppercase tracking-[0.2em] text-[10px] text-muted-foreground mb-3">{t("dashboard.new_on_slate")}</p>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-12">
          {PROJECT_TYPES.map(({ value, icon: Icon }) => (
            <button
              key={value}
              onClick={() => { setInitialType(value); setOpen(true); }}
              className="cine-card group p-4 rounded-lg bg-card border border-border/60 hover:border-primary/50 transition text-left"
            >
              <Icon className="h-5 w-5 text-primary mb-2 group-hover:scale-110 transition" aria-hidden="true" />
              <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground">{t("dashboard.new_card_kicker")}</div>
              <div className="text-sm font-medium">{value}</div>
            </button>
          ))}
        </div>

        <div className="mb-8">
          <VoiceCreditsPanel />
        </div>

        <div className="flex items-baseline justify-between mb-4">
          <h2 className="font-display text-2xl font-semibold">{t("dashboard.in_production")}</h2>
          <span className="font-mono uppercase tracking-[0.2em] text-[10px] text-muted-foreground">
            {t(projects.length === 1 ? "dashboard.projects_on_lot_one" : "dashboard.projects_on_lot_other", { count: projects.length })}
          </span>
        </div>

        {isLoading ? (
          <div className="text-muted-foreground font-script italic">{t("dashboard.setting_stage")}</div>
        ) : projects.length === 0 ? (
          <Card className="p-12 text-center border-dashed">
            <Film className="h-10 w-10 text-muted-foreground mx-auto mb-3" aria-hidden="true" />
            <h3 className="font-display text-xl font-semibold mb-1">{t("dashboard.page_waiting")}</h3>
            <p className="text-sm text-muted-foreground mb-4">{t("dashboard.page_waiting_body")}</p>
            <Button onClick={() => { setInitialType("Feature Film"); setOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />{t("dashboard.start_project")}
            </Button>
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((p) => {
              const stageIndex = ProjectStageIndex(p.status);
              return (
                <Link key={p.id} to="/editor/$projectId" params={{ projectId: p.id }} className="group block">
                  <Card className="cine-card p-0 h-full overflow-hidden border-border/60 hover:border-primary/60 transition">
                    {/* Slate header */}
                    <div className="relative px-5 pt-5 pb-4 border-b border-border/60"
                      style={{ background: "linear-gradient(180deg, color-mix(in oklab, var(--primary) 8%, transparent), transparent)" }}>
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <Badge variant="secondary" className="font-mono uppercase tracking-[0.15em] text-[9px]">
                          {p.project_type}
                        </Badge>
                        <Badge variant="outline" className="font-mono uppercase tracking-[0.15em] text-[9px]">
                          {p.status}
                        </Badge>
                      </div>
                      <h3 className="font-display text-xl font-semibold leading-tight group-hover:text-primary transition">
                        {p.title}
                      </h3>
                      {(p.genre || p.tone) && (
                        <p className="font-mono uppercase tracking-[0.18em] text-[10px] text-muted-foreground mt-2">
                          {p.genre}{p.tone ? ` · ${p.tone}` : ""}
                        </p>
                      )}
                    </div>
                    {/* Body */}
                    <div className="px-5 py-4 space-y-4">
                      {p.logline ? (
                        <p className="font-script italic text-sm text-foreground/80 line-clamp-3 leading-relaxed">
                          "{p.logline}"
                        </p>
                      ) : (
                        <p className="font-script italic text-sm text-muted-foreground">{t("dashboard.logline_pending")}</p>
                      )}
                      <PipelineStrip stageIndex={stageIndex} />
                      <div className="flex items-center justify-between pt-2 border-t border-border/40 gap-2">
                        <span className="font-mono uppercase tracking-[0.18em] text-[10px] text-muted-foreground">
                          {t("dashboard.updated_prefix", { when: formatDistanceToNow(new Date(p.updated_at), { addSuffix: true }) })}
                        </span>
                        <span className="text-[11px] text-primary opacity-100 md:opacity-60 md:group-hover:opacity-100 transition whitespace-nowrap">
                          {t("dashboard.open_writers_desk")}
                        </span>
                      </div>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}


function NewProjectDialog({ open, initialType, onCreate, loading }: { open: boolean; initialType: string; onCreate: (v: any) => void; loading: boolean }) {
  const [form, setForm] = useState({
    title: "", project_type: initialType, genre: "", tone: "", target_length: "", logline: "", ai_help_level: "Balanced",
  });
  // Re-seed the form whenever the dialog opens (with the currently selected quick-start type).
  useEffect(() => {
    if (open) {
      setForm({
        title: "", project_type: initialType, genre: "", tone: "", target_length: "", logline: "", ai_help_level: "Balanced",
      });
    }
  }, [open, initialType]);
  return (
    <DialogContent className="max-w-lg">
      <DialogHeader><DialogTitle className="font-display">{t("dashboard.dialog.title")}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div><Label>{t("dashboard.dialog.title_label")}</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={t("dashboard.dialog.title_placeholder")} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>{t("dashboard.dialog.type_label")}</Label>
            <Select value={form.project_type} onValueChange={(v) => setForm({ ...form, project_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PROJECT_TYPES.map((pt) => <SelectItem key={pt.value} value={pt.value}>{pt.value}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>{t("dashboard.dialog.genre_label")}</Label><Input value={form.genre} onChange={(e) => setForm({ ...form, genre: e.target.value })} placeholder={t("dashboard.dialog.genre_placeholder")} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>{t("dashboard.dialog.tone_label")}</Label><Input value={form.tone} onChange={(e) => setForm({ ...form, tone: e.target.value })} placeholder={t("dashboard.dialog.tone_placeholder")} /></div>
          <div>
            <Label>{t("dashboard.dialog.ai_label")}</Label>
            <Select value={form.ai_help_level} onValueChange={(v) => setForm({ ...form, ai_help_level: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Minimal">{t("dashboard.dialog.ai_minimal")}</SelectItem>
                <SelectItem value="Balanced">{t("dashboard.dialog.ai_balanced")}</SelectItem>
                <SelectItem value="Heavy">{t("dashboard.dialog.ai_heavy")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div><Label>{t("dashboard.dialog.logline_label")}</Label><Textarea value={form.logline} onChange={(e) => setForm({ ...form, logline: e.target.value })} placeholder={t("dashboard.dialog.logline_placeholder")} rows={3} /></div>
        <Button className="w-full" disabled={!form.title || loading} onClick={() => onCreate(form)}>
          {loading ? t("dashboard.rolling") : t("dashboard.open_studio")}
        </Button>
      </div>
    </DialogContent>
  );
}
