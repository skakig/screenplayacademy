import { Link } from "@tanstack/react-router";
import { FileText, Users, LayoutGrid } from "lucide-react";

export function ProjectNav({ projectId, title }: { projectId: string; title?: string }) {
  const items = [
    { to: "/editor/$projectId", label: "Editor", icon: FileText },
    { to: "/scenes/$projectId", label: "Scenes", icon: LayoutGrid },
    { to: "/characters/$projectId", label: "Characters", icon: Users },
  ] as const;
  return (
    <div className="border-b border-border/60 bg-card/30 backdrop-blur">
      <div className="max-w-[1600px] mx-auto px-4 h-12 flex items-center gap-4">
        {title && <span className="font-display text-sm font-semibold text-foreground/90 truncate max-w-[220px]">{title}</span>}
        <div className="h-4 w-px bg-border" />
        <nav className="flex items-center gap-1 text-sm">
          {items.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              params={{ projectId }}
              className="px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary flex items-center gap-1.5"
              activeProps={{ className: "px-3 py-1.5 rounded-md bg-secondary text-primary flex items-center gap-1.5" }}
            >
              <Icon className="h-3.5 w-3.5" />{label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
