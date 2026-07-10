import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { GuidedReturnBanner } from "@/components/guided/GuidedReturnBanner";
import { StudioMenu } from "@/components/StudioMenu";
import { BuyCreditsDialog } from "@/components/credits/BuyCreditsDialog";
import { useCreditsUpsell } from "@/hooks/useCreditsUpsell";

type Props = {
  children: ReactNode;
  /** When true, hide the app chrome (header + guided banner). Used by Focus Mode. */
  focus?: boolean;
  /** Optional page title rendered in the header (e.g. project title). */
  title?: string;
  /** Extra header content: mode toggle, save indicator, presence, etc. */
  headerExtras?: ReactNode;
};

export function AppShell({ children, focus = false, title, headerExtras }: Props) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { open: creditsOpen, focus: creditsFocus, closeDialog } = useCreditsUpsell();
  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const creditsDialog = (
    <BuyCreditsDialog
      open={creditsOpen}
      onOpenChange={(o) => (o ? null : closeDialog())}
      focus={creditsFocus ?? undefined}
    />
  );

  if (focus) {
    return (
      <div className="min-h-screen flex flex-col">
        <main className="flex-1">{children}</main>
        {creditsDialog}
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border/60 bg-card/40 backdrop-blur sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto px-4 h-14 flex items-center gap-3">
          <Link to="/dashboard" aria-label="SceneSmith Studio — Studio Lobby" className="shrink-0">
            <BrandLogo size="sm" asLink={false} />
          </Link>
          {title && (
            <>
              <span className="h-4 w-px bg-border/70 hidden sm:block" />
              <span className="font-display text-sm font-semibold text-foreground/90 truncate max-w-[280px] hidden sm:block">
                {title}
              </span>
            </>
          )}
          <div className="ml-auto flex items-center gap-2">
            {headerExtras}
            <StudioMenu />
            <Button variant="ghost" size="sm" onClick={signOut} className="gap-1.5">
              <LogOut className="h-4 w-4" />
              <span className="hidden md:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>
      <GuidedReturnBanner />
      <main className="flex-1">{children}</main>
    </div>
  );
}
