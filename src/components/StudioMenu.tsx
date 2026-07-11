import { Link, useRouterState } from "@tanstack/react-router";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Menu,
  FileText,
  Compass,
  LayoutGrid,
  Users,
  GitBranch,
  Activity,
  Image as ImageIcon,
  Mic,
  Sparkles,
  UsersRound,
  Settings,
  BookOpen,
  Home,
  FolderKanban,
  GraduationCap,
  CreditCard,
  Archive,
  Lock,
  FlaskConical,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { useState, type ComponentProps } from "react";
import { useOnboarding } from "@/hooks/use-onboarding";
import { useSubscription } from "@/hooks/useSubscription";
import { TIER_LABEL, type Feature, type Tier } from "@/lib/entitlements";
import { isStripeConfigured } from "@/lib/stripe";
import { supabase } from "@/integrations/supabase/client";
import { MENU_MANIFEST } from "./studioMenuManifest";
import { useProjectReadiness } from "@/lib/readiness/useProjectReadiness";
import { resolveMenuGate } from "@/lib/readiness/menuGate";
import { useCurrentProjectId } from "@/lib/readiness/useMenuGate";

/**
 * Fire-and-forget menu telemetry. Emits studio_menu_item_clicked with the
 * gating states applied at click time so we can see where users get stuck
 * (locked by tier, experimental Beta, setup required, needs project/data).
 */
function emitMenuClick(payload: {
  label: string;
  to: string;
  tier: Tier;
  locked: boolean;
  required_tier: Tier | null;
  experimental: boolean;
  setup_required: boolean;
  missing_project: boolean;
  needs_data: Item["needsData"] | null;
}) {
  const blocked =
    payload.locked || payload.missing_project || payload.setup_required;
  const has_friction =
    blocked || payload.experimental || Boolean(payload.needs_data);
  if (!has_friction) return; // only log friction clicks — keeps volume small
  try {
    void supabase.functions.invoke("log-event", {
      body: {
        event_name: "studio_menu_item_clicked",
        payload: { ...payload, blocked, has_friction },
      },
    });
  } catch {
    // never block navigation on telemetry
  }
}

type Item = {
  to: ComponentProps<typeof Link>["to"];
  label: string;
  desc: string;
  icon: LucideIcon;
  needsProject?: boolean;
  guidedOnly?: boolean;
  feature?: Feature;
  experimental?: boolean;
  /** Requires an external integration to be configured before it will work end-to-end. */
  setupRequires?: "billing";
  /** Hint shown as a "needs …" chip when a project exists but likely has no data yet. */
  needsData?: "scenes" | "characters" | "script";
};

/**
 * Standardized state chips rendered in a fixed order across every Studio Menu item:
 *   1. Tier lock  →  2. Beta  →  3. Setup required  →  4. Pick a project  →  5. Needs data
 * Colors and sizes are tokenized so Free/Creator/Pro/Studio see the same visual language.
 */
export function StateBadges(props: {
  locked: boolean;
  requiredTier: Tier | null;
  experimental?: boolean;
  setupRequired?: boolean;
  missingProject: boolean;
  needsData?: Item["needsData"];
}) {
  const { locked, requiredTier, experimental, setupRequired, missingProject, needsData } = props;
  return (
    <>
      {locked && requiredTier && (
        <Badge
          variant="outline"
          className="text-[9px] px-1.5 py-0 gap-0.5 border-amber-500/40 text-amber-600 dark:text-amber-400"
        >
          <Lock className="h-2.5 w-2.5" />
          {TIER_LABEL[requiredTier]}
        </Badge>
      )}
      {experimental && (
        <Badge
          variant="outline"
          className="text-[9px] px-1.5 py-0 gap-0.5 border-purple-500/40 text-purple-600 dark:text-purple-400"
        >
          <FlaskConical className="h-2.5 w-2.5" />
          Beta
        </Badge>
      )}
      {setupRequired && (
        <Badge
          variant="outline"
          className="text-[9px] px-1.5 py-0 gap-0.5 border-sky-500/40 text-sky-600 dark:text-sky-400"
        >
          <Wrench className="h-2.5 w-2.5" />
          Setup
        </Badge>
      )}
      {missingProject && (
        <Badge variant="secondary" className="text-[9px] px-1.5 py-0">Pick a project</Badge>
      )}
      {!missingProject && needsData && (
        <Badge variant="secondary" className="text-[9px] px-1.5 py-0">Needs {needsData}</Badge>
      )}
    </>
  );
}

const GROUPS: { key: string; label: string; items: Item[] }[] = [
  {
    key: "school",
    label: "School — Learn to write",
    items: [
      { to: "/academy", label: "SceneSmith Academy", desc: "Lessons, modules, and craft fundamentals.", icon: GraduationCap },
      { to: "/first-screenplay/$projectId", label: "Guided Path", desc: "Step-by-step from idea to draft.", icon: Compass, needsProject: true, guidedOnly: true },
    ],
  },
  {
    key: "editor",
    label: "Editor — Write the screenplay",
    items: [
      { to: "/editor/$projectId", label: "Writer's Desk", desc: "The page. Where the screenplay lives.", icon: FileText, needsProject: true },
      { to: "/scenes/$projectId", label: "Scene Board", desc: "See every scene on one wall.", icon: LayoutGrid, needsProject: true, needsData: "scenes" },
      { to: "/vault/$projectId", label: "Scene Vault", desc: "Stash scenes, fragments, and alt takes.", icon: Archive, needsProject: true },
      { to: "/story-arc/$projectId", label: "Story Spine", desc: "Beats and turning points across three acts.", icon: GitBranch, needsProject: true },
      { to: "/characters/$projectId", label: "Characters", desc: "Character profiles, wants, wounds.", icon: Users, needsProject: true, needsData: "characters" },
      { to: "/arc-timeline/$projectId", label: "Dramatic Pulse", desc: "Tension and stakes scene-by-scene.", icon: Activity, needsProject: true, needsData: "scenes" },
    ],
  },
  {
    key: "producer",
    label: "Producer — Ship the screenplay",
    items: [
      { to: "/pitch/$projectId", label: "Pitch Deck", desc: "Logline, synopsis, treatment, pitch email.", icon: Sparkles, needsProject: true, feature: "pitch", needsData: "script" },
      { to: "/tableread/$projectId", label: "Table Read", desc: "Hear it read aloud with AI voices.", icon: Mic, needsProject: true, feature: "table_read", needsData: "characters", experimental: true },
      { to: "/storyboard/$projectId", label: "Shot Wall", desc: "Visualize scenes as storyboards.", icon: ImageIcon, needsProject: true, feature: "storyboard", needsData: "scenes", experimental: true },
      { to: "/writers-room/$projectId", label: "Writers' Room", desc: "Invite collaborators, notes, sessions.", icon: UsersRound, needsProject: true, feature: "writers_room", experimental: true },
    ],
  },
  {
    key: "studio",
    label: "Studio",
    items: [
      { to: "/dashboard", label: "Studio Lobby", desc: "Your home base.", icon: Home },
      { to: "/projects", label: "Script Vault", desc: "All your projects.", icon: FolderKanban },
      { to: "/settings", label: "Studio Settings", desc: "Preferences and account.", icon: Settings },
      { to: "/pricing", label: "Pricing", desc: "Plans and billing.", icon: CreditCard, setupRequires: "billing" },
    ],
  },
];

export function StudioMenu() {
  const [open, setOpen] = useState(false);
  const projectId = useCurrentProjectId();
  const { data: onboarding } = useOnboarding();
  const isGuided = onboarding?.preferred_mode === "guided";
  const currentPath = useRouterState({ select: (r) => r.location.pathname });
  const { tier, loading: subLoading } = useSubscription();
  const stripeReady = isStripeConfigured();
  const { data: counts } = useProjectReadiness(projectId);
  const ctx = {
    tier,
    stripeReady,
    isGuided,
    projectId,
    counts: counts ?? null,
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" aria-label="Open Studio Menu" className="gap-1.5">
          <Menu className="h-4 w-4" />
          <span className="hidden sm:inline text-sm">Studio Menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[340px] sm:w-[380px] p-0 overflow-y-auto">
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-border/40">
          <SheetTitle className="font-display">Studio Menu</SheetTitle>
          <p className="text-xs text-muted-foreground">The page is the product. Everything else is here.</p>
          {!subLoading && (
            <div className="flex items-center gap-2 pt-1">
              <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                {TIER_LABEL[tier]} plan
              </Badge>
              {!stripeReady && (
                <Badge variant="secondary" className="text-[10px]">Billing: setup required</Badge>
              )}
            </div>
          )}
        </SheetHeader>
        <div className="p-3 space-y-4">
          {GROUPS.map((group) => {
            const items = group.items.filter((it) => {
              if (it.guidedOnly && !isGuided) return false;
              return true;
            });
            if (items.length === 0) return null;
            return (
              <div key={group.key}>
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/80 font-semibold px-2 mb-1.5">
                  {group.label}
                </div>
                <div className="space-y-0.5">
                  {items.map((it) => {
                    const Icon = it.icon;
                    // One source of truth for gating — same function the destination
                    // route uses via RouteReadinessGate.
                    const gate = resolveMenuGate(
                      {
                        to: it.to as string,
                        needsProject: it.needsProject,
                        guidedOnly: it.guidedOnly,
                        feature: it.feature,
                        experimental: it.experimental,
                        setupRequires: it.setupRequires,
                        needsData: it.needsData,
                      },
                      ctx,
                    );
                    const href = projectId
                      ? (it.to as string).replace("$projectId", projectId)
                      : (it.to as string);
                    const active = currentPath === href;
                    const dimmed = gate.blockedBy === "pick_project" || gate.blockedBy === "needs_data";

                    const inner = (
                      <div className={`flex items-start gap-3 rounded-md px-2.5 py-2 transition-colors ${
                        active
                          ? "bg-primary/10 text-foreground"
                          : dimmed
                          ? "opacity-60"
                          : "hover:bg-secondary text-foreground/90"
                      }`}
                      >
                        <div className="mt-0.5 shrink-0 w-7 h-7 rounded-md bg-muted/60 text-foreground flex items-center justify-center">
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-medium truncate">{it.label}</span>
                            <StateBadges
                              locked={gate.locked}
                              requiredTier={gate.requiredTier}
                              experimental={gate.experimental}
                              setupRequired={gate.setupRequired}
                              missingProject={gate.missingProject}
                              needsData={gate.needsData ?? undefined}
                            />
                          </div>
                          <div className="text-[11px] text-muted-foreground leading-snug line-clamp-2">
                            {it.desc}
                          </div>
                        </div>
                      </div>
                    );

                    const handleClick = () => {
                      emitMenuClick({
                        label: it.label,
                        to: String(it.to),
                        tier,
                        locked: gate.locked,
                        required_tier: gate.requiredTier,
                        experimental: gate.experimental,
                        setup_required: gate.setupRequired,
                        missing_project: gate.missingProject,
                        needs_data: gate.needsData,
                      });
                      setOpen(false);
                    };

                    const ariaLabel =
                      gate.blockedBy === "pick_project"
                        ? `${it.label} — pick a project first`
                        : gate.blockedBy === "tier"
                          ? `${it.label} — upgrade to ${gate.requiredTierLabel ?? "unlock"}`
                          : undefined;

                    return (
                      <Link
                        key={it.label}
                        to={gate.targetTo as any}
                        params={gate.targetParams as any}
                        onClick={handleClick}
                        aria-label={ariaLabel}
                      >
                        {inner}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// small icon for external consumers if needed
export { BookOpen as StudioMenuIcon };
