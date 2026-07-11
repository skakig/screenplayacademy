import { useRouterState } from "@tanstack/react-router";
import { useOnboarding } from "@/hooks/use-onboarding";
import { useSubscription } from "@/hooks/useSubscription";
import { isStripeConfigured } from "@/lib/stripe";
import { MENU_MANIFEST } from "@/components/studioMenuManifest";
import type { MenuItemManifest } from "@/components/studioMenuManifest";
import { useProjectReadiness } from "./useProjectReadiness";
import {
  findManifestItem,
  resolveMenuGate,
  type MenuGate,
  type MenuGateContext,
} from "./menuGate";

/** Read the deepest `projectId` param currently in the router match tree. */
export function useCurrentProjectId(): string | null {
  const matches = useRouterState({ select: (s) => s.matches });
  for (let i = matches.length - 1; i >= 0; i--) {
    const p = (matches[i].params as Record<string, unknown> | undefined)?.projectId;
    if (typeof p === "string" && p.length > 0) return p;
  }
  return null;
}

/** Shared session context (tier + stripe + onboarding + project counts). */
export function useMenuGateContext(explicitProjectId?: string | null): MenuGateContext & {
  isLoading: boolean;
} {
  const routerProjectId = useCurrentProjectId();
  const projectId = explicitProjectId ?? routerProjectId;
  const { data: onboarding } = useOnboarding();
  const { tier, loading: subLoading } = useSubscription();
  const { data: counts, isLoading: readinessLoading } = useProjectReadiness(projectId);
  return {
    tier,
    stripeReady: isStripeConfigured(),
    isGuided: onboarding?.preferred_mode === "guided",
    projectId,
    counts: counts ?? null,
    isLoading: subLoading || (Boolean(projectId) && readinessLoading),
  };
}

/**
 * Resolve gate state for an arbitrary menu item.
 * Prefer `useRouteGate(to)` when you have a route path.
 */
export function useMenuGate(
  item: MenuItemManifest,
  explicitProjectId?: string | null,
): MenuGate & { isLoading: boolean } {
  const ctx = useMenuGateContext(explicitProjectId);
  return { ...resolveMenuGate(item, ctx), isLoading: ctx.isLoading };
}

/**
 * Resolve gate state for a destination path (as declared in the manifest,
 * e.g. `/pitch/$projectId`). Returns null when the path is not in the menu.
 */
export function useRouteGate(
  to: string,
  explicitProjectId?: string | null,
): (MenuGate & { isLoading: boolean }) | null {
  const ctx = useMenuGateContext(explicitProjectId);
  const item = findManifestItem(MENU_MANIFEST, to);
  if (!item) return null;
  return { ...resolveMenuGate(item, ctx), isLoading: ctx.isLoading };
}
