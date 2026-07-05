import { Link, useRouterState } from "@tanstack/react-router";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
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
  type LucideIcon,
} from "lucide-react";
import { useState, type ComponentProps } from "react";
import { useOnboarding } from "@/hooks/use-onboarding";

type Item = {
  to: ComponentProps<typeof Link>["to"];
  label: string;
  desc: string;
  icon: LucideIcon;
  needsProject?: boolean;
  guidedOnly?: boolean;
};

const GROUPS: { key: string; label: string; items: Item[] }[] = [
  {
    key: "write",
    label: "Write",
    items: [
      { to: "/editor/$projectId", label: "Writer's Desk", desc: "The page. Where the screenplay lives.", icon: FileText, needsProject: true },
      { to: "/first-screenplay/$projectId", label: "Guided Path", desc: "Step-by-step from idea to draft.", icon: Compass, needsProject: true, guidedOnly: true },
    ],
  },
  {
    key: "plan",
    label: "Plan",
    items: [
      { to: "/scenes/$projectId", label: "Scene Board", desc: "See every scene on one wall.", icon: LayoutGrid, needsProject: true },
      { to: "/story-arc/$projectId", label: "Story Spine", desc: "Beats and turning points across three acts.", icon: GitBranch, needsProject: true },
      { to: "/characters/$projectId", label: "Casting Wall", desc: "Character profiles, wants, wounds.", icon: Users, needsProject: true },
    ],
  },
  {
    key: "polish",
    label: "Polish",
    items: [
      { to: "/arc-timeline/$projectId", label: "Dramatic Pulse", desc: "Tension and stakes scene-by-scene.", icon: Activity, needsProject: true },
    ],
  },
  {
    key: "produce",
    label: "Produce",
    items: [
      { to: "/storyboard/$projectId", label: "Shot Wall", desc: "Visualize scenes as storyboards.", icon: ImageIcon, needsProject: true },
      { to: "/tableread/$projectId", label: "Rehearsal Room", desc: "Hear it read with AI voices.", icon: Mic, needsProject: true },
      { to: "/pitch/$projectId", label: "Producer Room", desc: "Pitch deck, logline, synopsis.", icon: Sparkles, needsProject: true },
      { to: "/writers-room/$projectId", label: "Writers' Room", desc: "Collaborate live with your team.", icon: UsersRound, needsProject: true },
    ],
  },
  {
    key: "studio",
    label: "Studio",
    items: [
      { to: "/dashboard", label: "Studio Lobby", desc: "Your home base.", icon: Home },
      { to: "/projects", label: "Script Vault", desc: "All your projects.", icon: FolderKanban },
      { to: "/academy", label: "Screenplay School", desc: "Learn the craft.", icon: GraduationCap },
    ],
  },
  {
    key: "settings",
    label: "Settings",
    items: [
      { to: "/settings", label: "Studio Settings", desc: "Preferences and account.", icon: Settings },
      { to: "/pricing", label: "Pricing", desc: "Plans and billing.", icon: CreditCard },
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

export function StudioMenu() {
  const [open, setOpen] = useState(false);
  const projectId = useProjectId();
  const { data: onboarding } = useOnboarding();
  const isGuided = onboarding?.preferred_mode === "guided";
  const currentPath = useRouterState({ select: (r) => r.location.pathname });

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
        </SheetHeader>
        <div className="p-3 space-y-4">
          {GROUPS.map((group) => {
            const items = group.items.filter((it) => {
              if (it.needsProject && !projectId) return false;
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
                    const params = it.needsProject ? { projectId: projectId! } : undefined;
                    const href = typeof it.to === "string" && projectId
                      ? it.to.replace("$projectId", projectId)
                      : (it.to as string);
                    const active = currentPath === href;
                    return (
                      <Link
                        key={it.label}
                        to={it.to as any}
                        params={params as any}
                        onClick={() => setOpen(false)}
                        className={`flex items-start gap-3 rounded-md px-2.5 py-2 transition-colors ${
                          active
                            ? "bg-primary/10 text-foreground"
                            : "hover:bg-secondary text-foreground/90"
                        }`}
                      >
                        <div className="mt-0.5 shrink-0 w-7 h-7 rounded-md bg-muted/60 text-foreground flex items-center justify-center">
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{it.label}</div>
                          <div className="text-[11px] text-muted-foreground leading-snug line-clamp-2">
                            {it.desc}
                          </div>
                        </div>
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
