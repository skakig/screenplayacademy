import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Save, User as UserIcon } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — SceneSmith AI" }] }),
  component: Settings,
});

function Settings() {
  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle();
      return { ...data, email: u.user.email };
    },
  });
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (profile?.full_name) setName(profile.full_name); }, [profile?.full_name]);

  const save = async () => {
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("profiles").update({ full_name: name }).eq("id", u.user!.id);
    setSaving(false);
    if (error) toast.error(error.message); else toast.success("Saved");
  };

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">Your account & plan.</p>
        </div>

        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center">
              <UserIcon className="h-5 w-5 text-primary" />
            </div>
            <h2 className="font-semibold">Profile</h2>
          </div>
          <div>
            <Label>Full name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Writer" />
          </div>
          <div>
            <Label>Email</Label>
            <Input value={profile?.email ?? ""} disabled />
          </div>
          <Button onClick={save} disabled={saving}><Save className="h-4 w-4 mr-2" />{saving ? "Saving..." : "Save"}</Button>
        </Card>

        <Card className="p-6 space-y-3">
          <h2 className="font-semibold">Plan</h2>
          <p className="text-sm">Current: <span className="capitalize font-medium text-primary">{profile?.plan ?? "free"}</span></p>
          <p className="text-xs text-muted-foreground">Subscription management is coming soon.</p>
          <Button variant="outline" size="sm" onClick={() => toast.info("Billing portal coming soon.")}>Manage subscription</Button>
        </Card>

        <Card className="p-6 space-y-3 border-destructive/30">
          <h2 className="font-semibold text-destructive">Danger zone</h2>
          <p className="text-xs text-muted-foreground">Account deletion is permanent and removes all your projects.</p>
          <Button variant="outline" size="sm" onClick={() => toast.info("Contact support to delete your account.")}>Delete account</Button>
        </Card>
      </div>
    </AppShell>
  );
}
