import { Link, useRouter } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface Props {
  error: Error;
  reset: () => void;
}

/**
 * Shared error boundary for authenticated leaf routes.
 * Replaces the generic "This page didn't load" screen with a
 * page-specific fallback that keeps the top-level chrome working.
 */
export function RouteErrorBoundary({ error, reset }: Props) {
  const router = useRouter();

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6 py-16">
      <div className="max-w-md text-center space-y-5">
        <div className="mx-auto w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
          <AlertTriangle className="h-6 w-6 text-amber-500" />
        </div>
        <h1 className="font-display text-2xl">This room didn't load</h1>
        <p className="text-sm text-muted-foreground">
          Something went wrong while opening this page. Your writing is safe —
          only this view failed to load.
        </p>
        {error?.message && (
          <p className="text-xs text-muted-foreground/70 font-mono break-words">
            {error.message.slice(0, 200)}
          </p>
        )}
        <div className="flex gap-2 justify-center">
          <Button
            onClick={() => {
              reset();
              router.invalidate();
            }}
          >
            Try again
          </Button>
          <Button asChild variant="secondary">
            <Link to="/dashboard">Back to Studio Lobby</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
