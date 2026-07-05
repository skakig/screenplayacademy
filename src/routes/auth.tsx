import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { BrandLogo } from "@/components/brand/BrandLogo";

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    next: typeof s.next === "string" ? s.next : "",
  }),
  head: () => ({
    meta: [
      { title: "Sign in or sign up — SceneSmith Studio" },
      { name: "description", content: "Sign in or create your SceneSmith Studio account to enter the AI-powered writer's room for screenplays, novels, worlds, comedy, and audio." },
      { property: "og:title", content: "Sign in or sign up — SceneSmith Studio" },
      { property: "og:description", content: "Enter the Studio. Sign in or create your SceneSmith Studio account to start telling your next story." },
      { property: "og:url", content: "https://scenesmithstudio.com/auth" },
      { name: "twitter:title", content: "Sign in or sign up — SceneSmith Studio" },
      { name: "twitter:description", content: "Enter the Studio. Sign in or create your SceneSmith Studio account to start telling your next story." },
    ],
    links: [
      { rel: "canonical", href: "https://scenesmithstudio.com/auth" },
    ],
  }),
  component: AuthPage,
});

// Only allow same-origin relative paths as post-auth redirect targets.
function safeNext(next: string): string {
  if (!next.startsWith("/") || next.startsWith("//")) return "/dashboard";
  return next;
}

function AuthPage() {
  // Post-auth redirect derived from ?next=… (see safeNext).
  const { next } = Route.useSearch();
  const target = safeNext(next);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled && data.user) window.location.assign(target);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${window.location.origin}${target}`, data: { full_name: fullName } },
        });
        if (error) throw error;
        toast.success("Your studio is ready. Welcome.");
        window.location.assign(target);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.assign(target);
      }
    } catch (err: any) {
      toast.error(err.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: `${window.location.origin}${target}` });
    if (result.error) { toast.error("Google sign-in failed"); setLoading(false); return; }
    if (result.redirected) return;
    window.location.assign(target);
  };

  const isSignin = mode === "signin";

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden">
      {/* Atmospheric backdrop */}
      <div className="absolute inset-0 -z-10" style={{ background: "var(--gradient-cinematic)" }} />
      <div className="absolute inset-0 -z-10 opacity-[0.08] pointer-events-none"
        style={{ backgroundImage: "radial-gradient(circle at 20% 30%, var(--primary) 0, transparent 40%), radial-gradient(circle at 80% 70%, var(--accent) 0, transparent 45%)" }} />

      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center mb-4">
            <BrandLogo size="md" asLink={false} />
          </div>
          <p className="font-script text-base text-muted-foreground italic">
            {isSignin ? "Welcome back to the studio. Your story is waiting." : "Step inside. The page is yours."}
          </p>
        </div>

        <Card className="p-6 border-border/60 backdrop-blur-sm cine-card"
          style={{ boxShadow: "var(--shadow-cinematic)" }}>
          <h1 className="font-display text-2xl font-semibold mb-1">
            {isSignin ? "Sign back in" : "Open your studio"}
          </h1>
          <p className="text-sm text-muted-foreground mb-6">
            {isSignin ? "Pick up the scene right where you left off." : "Free forever to start. No credit card. No fade-out."}
          </p>

          <Button type="button" variant="outline" className="w-full mb-4" onClick={handleGoogle} disabled={loading}>
            <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Continue with Google
          </Button>

          <div className="relative my-4 text-center">
            <span className="bg-card px-2 text-xs uppercase tracking-[0.18em] text-muted-foreground relative z-10">or with email</span>
            <div className="absolute inset-x-0 top-1/2 h-px bg-border" />
          </div>

          <form onSubmit={handleEmail} className="space-y-3">
            {mode === "signup" && (
              <div>
                <Label htmlFor="name">Writer's name</Label>
                <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Writer" />
              </div>
            )}
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                {isSignin && (
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-primary hover:underline"
                    onClick={async () => {
                      if (!email) {
                        toast.info("Enter your email above first, then tap 'Forgot password?' again.");
                        return;
                      }
                      const { error } = await supabase.auth.resetPasswordForEmail(email, {
                        redirectTo: `${window.location.origin}/reset-password`,
                      });
                      if (error) toast.error(error.message);
                      else toast.success("Check your email for the reset link.");
                    }}
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Rolling…" : isSignin ? "Enter the Studio" : "Start your Studio"}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-4">
            {isSignin ? "New to the lot?" : "Already on the call sheet?"}{" "}
            <button className="text-primary hover:underline" onClick={() => setMode(isSignin ? "signup" : "signin")}>
              {isSignin ? "Open a studio" : "Sign back in"}
            </button>
          </p>
        </Card>

        <p className="text-center text-xs text-muted-foreground/70 mt-6 font-mono uppercase tracking-[0.2em]">
          Fade in.
        </p>
      </div>
    </div>
  );
}
