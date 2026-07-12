import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Link2, Link2Off, AlertTriangle, Globe } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { parseSceneHeading } from "@/lib/editor/manuscriptAnalyzer";
import { normalizeWorldKey } from "@/lib/world/worldGraph";
import { getSceneHeadingLinkIndex } from "@/lib/editor/sceneHeadingLinkIndex.functions";

type Props = {
  projectId: string;
  headingText: string;
};

/**
 * Compact badge shown next to a scene_heading block indicating whether the
 * parsed location is linked to a world_locations row in the project's default
 * universe. States: linked, unlinked, no-universe, empty, error.
 */
export function SceneHeadingLinkBadge({ projectId, headingText }: Props) {
  const fetchIndex = useServerFn(getSceneHeadingLinkIndex);
  const q = useQuery({
    queryKey: ["scene-heading-link-index", projectId],
    queryFn: () => fetchIndex({ data: { projectId } }),
    staleTime: 30_000,
  });

  const parsed = parseSceneHeading(headingText || "");
  const key = normalizeWorldKey(parsed.location || "");

  if (!key) return null; // empty / unparseable heading — say nothing

  let state: "loading" | "error" | "no-universe" | "linked" | "unlinked" =
    "loading";
  let match: { id: string; name: string } | null = null;

  if (q.isError) state = "error";
  else if (q.data) {
    if (!q.data.universeId) state = "no-universe";
    else {
      const m = q.data.locations.find((l) => l.normalized_key === key);
      if (m) {
        state = "linked";
        match = { id: m.id, name: m.name };
      } else {
        state = "unlinked";
      }
    }
  }

  const base =
    "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-sans leading-none whitespace-nowrap";

  const content = (() => {
    switch (state) {
      case "loading":
        return (
          <span className={`${base} border-border/50 text-muted-foreground opacity-60`}>
            <Link2 className="h-3 w-3" />
          </span>
        );
      case "error":
        return (
          <span
            className={`${base} border-destructive/40 text-destructive bg-destructive/5`}
          >
            <AlertTriangle className="h-3 w-3" />
            link error
          </span>
        );
      case "no-universe":
        return (
          <span
            className={`${base} border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/5`}
          >
            <Globe className="h-3 w-3" />
            no universe
          </span>
        );
      case "linked":
        return (
          <span
            className={`${base} border-emerald-500/40 text-emerald-700 dark:text-emerald-400 bg-emerald-500/5`}
          >
            <Link2 className="h-3 w-3" />
            <span className="truncate max-w-[9rem]">{key}</span>
          </span>
        );
      case "unlinked":
        return (
          <span
            className={`${base} border-border text-muted-foreground bg-muted/40`}
          >
            <Link2Off className="h-3 w-3" />
            unlinked
          </span>
        );
    }
  })();

  const tooltip = (() => {
    switch (state) {
      case "loading":
        return "Checking world-location link…";
      case "error":
        return `Couldn't check world-location link${q.error instanceof Error ? `: ${q.error.message}` : ""}`;
      case "no-universe":
        return "No default universe on this project — set one in World Hub to enable scene-location linking.";
      case "linked":
        return `Linked to world location "${match?.name}" (key: ${key})`;
      case "unlinked":
        return `Parsed location "${parsed.location}" (key: ${key}) is not yet linked. Run "Re-link scene locations" in World Hub.`;
    }
  })();

  const badge = (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span data-scene-link-badge className="cursor-help">
            {content}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs max-w-xs">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  // Linked state deep-links to World Hub for quick jump.
  if (state === "linked") {
    return (
      <Link
        to="/world/$projectId"
        params={{ projectId }}
        className="no-underline"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {badge}
      </Link>
    );
  }
  return badge;
}
