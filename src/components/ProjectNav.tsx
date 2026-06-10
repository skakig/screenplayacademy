import { Link } from "@tanstack/react-router";
import { FileText, Users, LayoutGrid, Image as ImageIcon, Mic, Sparkles, Activity, GitBranch, BookOpen } from "lucide-react";
import { useOnboarding } from "@/hooks/use-onboarding";

export function ProjectNav({ projectId, title }: { projectId: string; title?: string }) {
  const { data: onboarding } = useOnboarding();
  const isGuided = onboarding?.preferred_mode === "guided";

  const items = [
    ...(isGuided ? [{ to: "/first-screenplay/$projectId" as const, label: "Guided Path", icon: BookOpen }] : []),
    { to: "/editor/$projectId" as const, label: "Writer's Desk", icon: FileText },
    { to: "/scenes/$projectId" as const, label: "Scene Board", icon: LayoutGrid },
    { to: "/characters/$projectId" as const, label: "Casting Wall", icon: Users },
    { to: "/story-arc/$projectId" as const, label: "Story Spine", icon: GitBranch },
    { to: "/arc-timeline/$projectId" as const, label: "Dramatic Pulse", icon: Activity },
    { to: "/storyboard/$projectId" as const, label: "Shot Wall", icon: ImageIcon },
    { to: "/tableread/$projectId" as const, label: "Rehearsal Room", icon: Mic },
    { to: "/pitch/$projectId" as const, label: "Producer Room", icon: Sparkles },
  ];
  return (
    <div className="border-b border-border/60 bg-card/30 backdrop-blur">
      <div className="max-w-[1600px] mx-auto px-4 h-12 flex items-center gap-3 overflow-x-auto">
        {title && <span className="font-display text-sm font-semibold text-foreground/90 truncate max-w-[220px]">{title}</span>}
        <div className="h-4 w-px bg-border" />
        <nav className="flex items-center gap-1 text-sm">
          {items.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              params={{ projectId }}
              className="px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary flex items-center gap-1.5 whitespace-nowrap"
              activeProps={{ className: "px-3 py-1.5 rounded-md bg-secondary text-primary flex items-center gap-1.5 whitespace-nowrap" }}
            >
              <Icon className="h-3.5 w-3.5" />{label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
