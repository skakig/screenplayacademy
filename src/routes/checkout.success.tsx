import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { BrandLogo } from "@/components/brand/BrandLogo";

export const Route = createFileRoute("/checkout/success")({
  head: () => ({
    meta: [
      { title: "Welcome to SceneSmith Studio" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CheckoutSuccess,
});

function CheckoutSuccess() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border/60 bg-background/60 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center">
          <BrandLogo size="sm" />
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-6 h-14 w-14 rounded-full bg-primary/15 ring-1 ring-primary/40 flex items-center justify-center">
            <Check className="h-7 w-7 text-primary" />
          </div>
          <p className="text-[11px] uppercase tracking-[0.32em] text-muted-foreground mb-3">
            Your studio is open
          </p>
          <h1 className="font-display text-4xl font-bold tracking-tight">
            Welcome to SceneSmith Studio.
          </h1>
          <p className="text-muted-foreground mt-3">
            Your subscription is active. Head to the Studio Lobby and pick up where your story begins.
          </p>
          <div className="mt-8 flex justify-center gap-2">
            <Link to="/dashboard">
              <Button>Open Studio Lobby</Button>
            </Link>
            <Link to="/projects">
              <Button variant="outline">Script Vault</Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
