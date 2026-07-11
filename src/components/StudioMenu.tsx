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
import {
  FEATURE_MIN_TIER,
  TIER_LABEL,
  TIER_RANK,
  type Feature,
  type Tier,
} from "@/lib/entitlements";
import { isStripeConfigured } from "@/lib/stripe";

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
function StateBadges(props: {
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
      { to: "/characters/$projectId", label: "Casting Wall", desc: "Character profiles, wants, wounds.", icon: Users, needsProject: true, needsData: "characters" },
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

function useProjectId(): string | null {
  const matches = useRouterState({ select: (s) => s.matches });
  for (let i = matches.length - 1; i >= 0; i--) {
    const p = (matches[i].params as Record<string, unknown> | undefined)?.projectId;
    if (typeof p === "string" && p.length > 0) return p;
  }
  return null;
}

function hasFeatureTier(tier: Tier, feature: Feature | undefined): boolean {
  if (!feature) return true;
  return TIER_RANK[tier] >= TIER_RANK[FEATURE_MIN_TIER[feature]];
}

export function StudioMenu() {
  const [open, setOpen] = useState(false);
  const projectId = useProjectId();
  const { data: onboarding } = useOnboarding();
  const isGuided = onboarding?.preferred_mode === "guided";
  const currentPath = useRouterState({ select: (r) => r.location.pathname });
  const { tier, loading: subLoading } = useSubscription();
  const stripeReady = isStripeConfigured();

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
                    const missingProject = Boolean(it.needsProject && !projectId);
                    const locked = !hasFeatureTier(tier, it.feature);
                    const params = it.needsProject && projectId ? { projectId } : undefined;
                    const href = typeof it.to === "string" && projectId
                      ? it.to.replace("$projectId", projectId)
                      : (it.to as string);
                    const active = currentPath === href;

                    const requiredTier = it.feature ? FEATURE_MIN_TIER[it.feature] : null;

                    const inner = (
                      <div className={`flex items-start gap-3 rounded-md px-2.5 py-2 transition-colors ${
                        active
                          ? "bg-primary/10 text-foreground"
                          : missingProject
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
                            {locked && requiredTier && (
                              <Badge variant="outline" className="text-[9px] px-1.5 py-0 gap-0.5 border-amber-500/40 text-amber-600 dark:text-amber-400">
                                <Lock className="h-2.5 w-2.5" />
                                {TIER_LABEL[requiredTier]}
                              </Badge>
                            )}
                            {it.experimental && (
                              <Badge variant="outline" className="text-[9px] px-1.5 py-0 gap-0.5 border-purple-500/40 text-purple-600 dark:text-purple-400">
                                <FlaskConical className="h-2.5 w-2.5" />
                                Beta
                              </Badge>
                            )}
                            {missingProject && (
                              <Badge variant="secondary" className="text-[9px] px-1.5 py-0">Pick a project</Badge>
                            )}
                            {!missingProject && it.needsData && (
                              <Badge variant="secondary" className="text-[9px] px-1.5 py-0">Needs {it.needsData}</Badge>
                            )}
                          </div>
                          <div className="text-[11px] text-muted-foreground leading-snug line-clamp-2">
                            {it.desc}
                          </div>
                        </div>
                      </div>
                    );

                    // Missing-project items route to /projects with a helper toast context
                    if (missingProject) {
                      return (
                        <Link
                          key={it.label}
                          to="/projects"
                          onClick={() => setOpen(false)}
                          aria-label={`${it.label} — pick a project first`}
                        >
                          {inner}
                        </Link>
                      );
                    }
                    // Locked items route to /pricing
                    if (locked) {
                      return (
                        <Link
                          key={it.label}
                          to="/pricing"
                          onClick={() => setOpen(false)}
                          aria-label={`${it.label} — upgrade to ${requiredTier ? TIER_LABEL[requiredTier] : "unlock"}`}
                        >
                          {inner}
                        </Link>
                      );
                    }
                    return (
                      <Link
                        key={it.label}
                        to={it.to as any}
                        params={params as any}
                        onClick={() => setOpen(false)}
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
