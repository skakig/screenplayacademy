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
  ChevronRight,
  FolderOpen,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useOnboarding } from "@/hooks/use-onboarding";
import { useSubscription } from "@/hooks/useSubscription";
import { TIER_LABEL, type Feature, type Tier } from "@/lib/entitlements";
import { isStripeConfigured } from "@/lib/stripe";
import { supabase } from "@/integrations/supabase/client";
import { MENU_MANIFEST, type MenuItemManifest } from "./studioMenuManifest";
import { useProjectReadiness } from "@/lib/readiness/useProjectReadiness";
import { resolveMenuGate, type MenuGateContext } from "@/lib/readiness/menuGate";
import { useCurrentProjectId } from "@/lib/readiness/useMenuGate";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useRecentProjects, recordRecentProject } from "@/hooks/useRecentProjects";

/**
 * Icon name → lucide component. MENU_MANIFEST stores `iconName` as a string so
 * it stays React/SSR-free; this map is the sole place we resolve those names.
 */
const ICON_MAP: Record<string, LucideIcon> = {
  FileText,
  Compass,
  LayoutGrid,
  Users,
  GitBranch,
  Activity,
  ImageIcon,
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
};

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
  needs_data: MenuItemManifest["needsData"] | null;
  context: "no_project" | "with_project";
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
  needsData?: MenuItemManifest["needsData"];
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

/**
 * Decide whether a group should collapse to a single "Pick a project" CTA.
 * Per plan: collapse ONLY when every visible item in the group is blocked by
 * `pick_project`. Tier-locked or setup-required items keep their own rows so
 * users can still see (and click through to) the upgrade / setup path.
 */
export function shouldCollapseAsPickProject(
  items: MenuItemManifest[],
  ctx: MenuGateContext,
): boolean {
  if (items.length < 2) return false;
  return items.every((it) => resolveMenuGate(it, ctx).blockedBy === "pick_project");
}

export function StudioMenu() {
  const [open, setOpen] = useState(false);
  const projectId = useCurrentProjectId();
  const { data: onboarding } = useOnboarding();
  const isGuided = onboarding?.preferred_mode === "guided";
  const currentPath = useRouterState({ select: (r) => r.location.pathname });
  const { tier, loading: subLoading } = useSubscription();
  const stripeReady = isStripeConfigured();
  const { isAdmin } = useIsAdmin();
  const { data: counts } = useProjectReadiness(projectId);
  const { recents } = useRecentProjects(3);
  const clickContext: "no_project" | "with_project" = projectId ? "with_project" : "no_project";

  // Record recent project whenever the router surfaces one. Validated against
  // the user's RLS-scoped projects list inside useRecentProjects.
  useEffect(() => {
    recordRecentProject(projectId);
  }, [projectId]);

  const ctx: MenuGateContext = {
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
          {/* Project context header */}
          <ProjectContextCard
            projectId={projectId}
            recents={recents}
            onNavigate={() => setOpen(false)}
          />

          {MENU_MANIFEST.map((group) => {
            const items = group.items.filter((it) => {
              if (it.guidedOnly && !isGuided) return false;
              return true;
            });
            if (items.length === 0) return null;

            // Amendment #2/#4: collapse only when EVERY item is pick_project-blocked.
            // Studio group is project-independent so it never collapses.
            const collapse = shouldCollapseAsPickProject(items, ctx);

            return (
              <div key={group.key} data-group-key={group.key} data-collapsed={collapse ? "true" : "false"}>
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/80 font-semibold px-2 mb-1.5">
                  {group.label}
                </div>
                {collapse ? (
                  <GroupCollapsedRow
                    items={items}
                    onClick={() =>
                      emitMenuClick({
                        label: `${group.label} (collapsed)`,
                        to: "/projects",
                        tier,
                        locked: false,
                        required_tier: null,
                        experimental: false,
                        setup_required: false,
                        missing_project: true,
                        needs_data: null,
                        context: clickContext,
                      })
                    }
                    onNavigate={() => setOpen(false)}
                  />
                ) : (
                  <div className="space-y-0.5">
                    {items.map((it) => (
                      <MenuItemRow
                        key={it.label}
                        item={it}
                        ctx={ctx}
                        projectId={projectId}
                        currentPath={currentPath}
                        onNavigate={() => setOpen(false)}
                        onEmit={(gate) =>
                          emitMenuClick({
                            label: it.label,
                            to: it.to,
                            tier,
                            locked: gate.locked,
                            required_tier: gate.requiredTier,
                            experimental: gate.experimental,
                            setup_required: gate.setupRequired,
                            missing_project: gate.missingProject,
                            needs_data: gate.needsData,
                            context: clickContext,
                          })
                        }
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {isAdmin && (
            <div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/80 font-semibold px-2 mb-1.5">
                Admin
              </div>
              <div className="space-y-0.5">
                <Link
                  to="/admin/coupons"
                  onClick={() => setOpen(false)}
                  className="block"
                >
                  <div className={`flex items-start gap-3 rounded-md px-2.5 py-2 transition-colors ${
                    currentPath === "/admin/coupons"
                      ? "bg-primary/10 text-foreground"
                      : "hover:bg-secondary text-foreground/90"
                  }`}>
                    <div className="mt-0.5 shrink-0 w-7 h-7 rounded-md bg-muted/60 flex items-center justify-center">
                      <CreditCard className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">Coupons & Promo Codes</div>
                      <div className="text-[11px] text-muted-foreground leading-snug">
                        Create and manage Stripe discount codes.
                      </div>
                    </div>
                  </div>
                </Link>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Project header + recents strip (no project → "Pick a project" CTA). */
function ProjectContextCard(props: {
  projectId: string | null;
  recents: ReturnType<typeof useRecentProjects>["recents"];
  onNavigate: () => void;
}) {
  const { projectId, recents, onNavigate } = props;

  if (!projectId) {
    return (
      <div
        className="rounded-lg border border-dashed border-border/60 bg-muted/30 p-3 space-y-2"
        data-testid="project-context-empty"
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 w-8 h-8 rounded-md bg-primary/10 text-primary flex items-center justify-center">
            <FolderOpen className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">Pick a project</div>
            <p className="text-[11px] text-muted-foreground leading-snug">
              Editor and Producer rooms open once a project is selected.
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Link to="/projects" onClick={onNavigate}>
            <Button size="sm" className="w-full h-8 text-xs" aria-label="Open Script Vault to pick a project">
              Open Script Vault
              <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </Link>
          {recents.length > 0 && (
            <div
              className="pt-1 space-y-0.5"
              data-testid="recent-projects"
              aria-label="Recent projects"
            >
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground/70 px-1">
                Recent
              </div>
              {recents.map((p) => (
                <Link
                  key={p.id}
                  to="/editor/$projectId"
                  params={{ projectId: p.id }}
                  onClick={onNavigate}
                  className="block rounded-md px-2 py-1.5 hover:bg-secondary text-xs truncate"
                  aria-label={`Open ${p.title || "Untitled project"}`}
                >
                  <span className="font-medium truncate">
                    {p.title || "Untitled project"}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Project selected: show current project + switch link
  const current = recents.find((r) => r.id === projectId);
  return (
    <div
      className="rounded-lg border border-border/50 bg-muted/20 p-2.5 flex items-center gap-2.5"
      data-testid="project-context-active"
    >
      <div className="w-8 h-8 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
        <FolderOpen className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[9px] uppercase tracking-wider text-muted-foreground/70">
          Current project
        </div>
        <div className="text-sm font-medium truncate">
          {current?.title || "Loading…"}
        </div>
      </div>
      <Link to="/projects" onClick={onNavigate}>
        <Button variant="ghost" size="sm" className="text-[11px] h-7 px-2">
          Switch
        </Button>
      </Link>
    </div>
  );
}

/** Collapsed group row: single CTA when every item needs a project. */
function GroupCollapsedRow(props: {
  items: MenuItemManifest[];
  onClick: () => void;
  onNavigate: () => void;
}) {
  const { items, onClick, onNavigate } = props;
  const preview = items.slice(0, 3).map((i) => i.label).join(", ");
  const remainder = items.length - 3;
  const summary =
    remainder > 0
      ? `${preview} and ${remainder} more unlock after you pick a project.`
      : `${preview} unlock after you pick a project.`;

  return (
    <Link
      to="/projects"
      onClick={() => {
        onClick();
        onNavigate();
      }}
      aria-label={`${items.length} items — pick a project to unlock`}
    >
      <div className="flex items-start gap-3 rounded-md px-2.5 py-2 border border-dashed border-border/50 hover:bg-secondary transition-colors">
        <div className="mt-0.5 shrink-0 w-7 h-7 rounded-md bg-muted/60 text-muted-foreground flex items-center justify-center">
          <Lock className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium">Pick a project to unlock</span>
            <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
              {items.length}
            </Badge>
          </div>
          <div className="text-[11px] text-muted-foreground leading-snug line-clamp-2">
            {summary}
          </div>
        </div>
      </div>
    </Link>
  );
}

/** Single expanded row (identical behavior to the previous implementation). */
function MenuItemRow(props: {
  item: MenuItemManifest;
  ctx: MenuGateContext;
  projectId: string | null;
  currentPath: string;
  onNavigate: () => void;
  onEmit: (gate: ReturnType<typeof resolveMenuGate>) => void;
}) {
  const { item, ctx, projectId, currentPath, onNavigate, onEmit } = props;
  const Icon = ICON_MAP[item.iconName] ?? FileText;
  const gate = resolveMenuGate(item, ctx);
  const href = projectId ? item.to.replace("$projectId", projectId) : item.to;
  const active = currentPath === href;
  const dimmed = gate.blockedBy === "pick_project" || gate.blockedBy === "needs_data";

  const ariaLabel =
    gate.blockedBy === "pick_project"
      ? `${item.label} — pick a project first`
      : gate.blockedBy === "tier"
        ? `${item.label} — upgrade to ${gate.requiredTierLabel ?? "unlock"}`
        : undefined;

  return (
    <Link
      to={gate.targetTo as any}
      params={gate.targetParams as any}
      onClick={() => {
        onEmit(gate);
        onNavigate();
      }}
      aria-label={ariaLabel}
    >
      <div
        className={`flex items-start gap-3 rounded-md px-2.5 py-2 transition-colors ${
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
            <span className="text-sm font-medium truncate">{item.label}</span>
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
            {item.desc}
          </div>
        </div>
      </div>
    </Link>
  );
}

// small icon for external consumers if needed
export { BookOpen as StudioMenuIcon };
