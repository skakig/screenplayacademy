import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Lock, Wrench, FolderKanban, Sparkles } from "lucide-react";
import { useRouteGate, useCurrentProjectId } from "@/lib/readiness/useMenuGate";

/**
 * Enforce Studio Menu gating at the destination route. If the gate says the
 * user is blocked by tier / setup / missing project / missing data, this
 * component renders a standardized empty state with the same CTA the menu
 * would send them to. Otherwise it renders `children` untouched.
 *
 * Usage — wrap the body of a data-dependent route:
 *
 *   <RouteReadinessGate to="/pitch/$projectId">
 *     <Pitch />
 *   </RouteReadinessGate>
 */
export function RouteReadinessGate({
  to,
  children,
  projectId,
  fallback,
}: {
  to: string;
  children: ReactNode;
  /** Override the router-derived projectId (rare). */
  projectId?: string | null;
  /** Optional custom fallback when blocked. Defaults to the standard card. */
  fallback?: (gate: NonNullable<ReturnType<typeof useRouteGate>>) => ReactNode;
}) {
  const routerProjectId = useCurrentProjectId();
  const gate = useRouteGate(to, projectId);
  const activeProjectId = projectId ?? routerProjectId;

  // Unknown route in manifest — never gate.
  if (!gate) return <>{children}</>;

  if (gate.isLoading) {
    return (
      <AppShell>
        <div className="max-w-2xl mx-auto px-4 py-16 flex items-center justify-center text-muted-foreground gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking access…
        </div>
      </AppShell>
    );
  }

  if (gate.blockedBy === "none") return <>{children}</>;
  if (fallback) return <>{fallback(gate)}</>;

  const Icon =
    gate.blockedBy === "tier"
      ? Lock
      : gate.blockedBy === "setup"
        ? Wrench
        : gate.blockedBy === "pick_project"
          ? FolderKanban
          : Sparkles;

  const fixLinkProps: Record<string, unknown> = { to: gate.fixTo };
  if (gate.fixTo.includes("$projectId") && activeProjectId) {
    fixLinkProps.params = { projectId: activeProjectId };
  }

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-4 py-16">
        <Card className="p-10 text-center border-dashed">
          <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-muted flex items-center justify-center">
            <Icon className="h-5 w-5 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-display font-semibold mb-2">
            {gate.label}
          </h1>
          <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
            {gate.reasonLabel}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button asChild>
              <Link {...(fixLinkProps as any)}>{gate.fixLabel}</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/dashboard">Back to Studio Lobby</Link>
            </Button>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
