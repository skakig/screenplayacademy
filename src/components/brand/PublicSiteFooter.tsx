import { Link } from "@tanstack/react-router";
import { SceneSmithLogo } from "@/components/brand/SceneSmithLogo";

export function PublicSiteFooter() {
  return (
    <footer className="border-t border-border/60 bg-card/30">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 md:flex-row md:items-end md:justify-between">
        <div>
          <SceneSmithLogo iconClassName="h-12 w-12" />
          <p className="mt-4 max-w-md text-sm text-muted-foreground">
            Build better stories, scene by scene.
          </p>
        </div>
        <div className="flex flex-col items-start gap-3 text-sm text-muted-foreground md:items-end">
          <div className="flex gap-4">
            <Link to="/pricing" className="hover:text-foreground transition-colors">
              Pricing
            </Link>
            <Link to="/auth" className="hover:text-foreground transition-colors">
              Sign in
            </Link>
          </div>
          <span>© {new Date().getFullYear()} SceneSmith Studio</span>
        </div>
      </div>
    </footer>
  );
}
