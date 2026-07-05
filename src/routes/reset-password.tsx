import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { BrandLogo } from "@/components/brand/BrandLogo";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Reset password — SceneSmith Studio" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  // Supabase attaches the recovery session automatically when the user lands
  // here from the email link (hash contains an access_token + type=recovery).
  // We wait for that session before enabling the form so we don't accidentally
  // update the password on the wrong account.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password updated. Welcome back.");
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden">
      <div className="absolute inset-0 -z-10" style={{ background: "var(--gradient-cinematic)" }} />
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <BrandLogo size="md" asLink={false} />
        </div>
        <Card className="p-6 border-border/60 backdrop-blur-sm">
          <h1 className="font-display text-2xl font-semibold mb-1">Set a new password</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Choose something you'll remember — you'll be signed in right after.
          </p>

          {!ready ? (
            <p className="text-sm text-muted-foreground">
              Confirming your reset link…
            </p>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              <div>
                <Label htmlFor="new-pw">New password</Label>
                <Input id="new-pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required />
              </div>
              <div>
                <Label htmlFor="confirm-pw">Confirm password</Label>
                <Input id="confirm-pw" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} minLength={6} required />
              </div>
              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? "Saving…" : "Update password"}
              </Button>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
