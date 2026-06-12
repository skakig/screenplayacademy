import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut, LayoutDashboard, FolderKanban, Settings, Sparkles, GraduationCap } from "lucide-react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { GuidedReturnBanner } from "@/components/guided/GuidedReturnBanner";

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };
  const nav = [
    { to: "/dashboard" as const, label: "Studio Lobby", icon: LayoutDashboard },
    { to: "/projects" as const, label: "Script Vault", icon: FolderKanban },
    { to: "/academy" as const, label: "Screenplay School", icon: GraduationCap },
    { to: "/pricing" as const, label: "Pricing", icon: Sparkles },
    { to: "/settings" as const, label: "Studio Settings", icon: Settings },
  ];
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border/60 bg-card/40 backdrop-blur sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/dashboard" aria-label="SceneSmith Studio — Studio Lobby">
            <BrandLogo size="sm" asLink={false} />
          </Link>
          <nav className="hidden md:flex items-center gap-1 text-sm">
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className="px-3 py-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center gap-1.5"
                activeProps={{ className: "px-3 py-1.5 rounded-md bg-secondary text-foreground flex items-center gap-1.5" }}
              >
                <n.icon className="h-3.5 w-3.5" />
                {n.label}
              </Link>
            ))}
          </nav>
          {/* Mobile compact nav: icon-only links */}
          <nav className="flex md:hidden items-center gap-0.5">
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                aria-label={n.label}
                className="p-2 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground"
                activeProps={{ className: "p-2 rounded-md bg-secondary text-foreground" }}
              >
                <n.icon className="h-4 w-4" />
              </Link>
            ))}
          </nav>
          <Button variant="ghost" size="sm" onClick={signOut}><LogOut className="h-4 w-4 mr-1.5" />Sign out</Button>
        </div>
      </header>
      <GuidedReturnBanner />
      <main className="flex-1">{children}</main>
    </div>
  );
}
