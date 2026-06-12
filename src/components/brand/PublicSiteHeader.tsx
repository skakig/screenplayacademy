import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { SceneSmithLogo } from "@/components/brand/SceneSmithLogo";

export function PublicSiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="transition-opacity hover:opacity-90" aria-label="SceneSmith Studio home">
          <SceneSmithLogo iconClassName="h-10 w-10" wordmarkClassName="hidden sm:block" />
        </Link>
        <nav className="flex items-center gap-2 text-sm">
          <Link
            to="/pricing"
            className="px-3 py-2 text-muted-foreground transition-colors hover:text-foreground"
          >
            Pricing
          </Link>
          <Link to="/auth">
            <Button variant="ghost" size="sm">
              Sign in
            </Button>
          </Link>
          <Link to="/auth">
            <Button size="sm">Start Writing</Button>
          </Link>
        </nav>
      </div>
    </header>
  );
}
