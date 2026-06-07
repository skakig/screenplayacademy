import { Link, useNavigate } from "@tanstack/react-router";
import { Film, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border/60 bg-card/40 backdrop-blur sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2 group">
            <Film className="h-5 w-5 text-primary group-hover:scale-110 transition" />
            <span className="font-bold tracking-tight">SceneSmith<span className="text-primary"> AI</span></span>
          </Link>
          <nav className="hidden md:flex items-center gap-1 text-sm">
            <Link to="/dashboard" className="px-3 py-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground" activeProps={{ className: "px-3 py-1.5 rounded-md bg-secondary text-foreground" }}>Dashboard</Link>
          </nav>
          <Button variant="ghost" size="sm" onClick={signOut}><LogOut className="h-4 w-4 mr-1.5" />Sign out</Button>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
