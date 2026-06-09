import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Save, User as UserIcon, Languages } from "lucide-react";
import { toast } from "sonner";
import { ModeSettings } from "@/components/settings/ModeSettings";
import {
  SUPPORTED_LANGUAGES,
  LANGUAGE_LABEL,
  type LanguageCode,
} from "@/lib/language/types";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — SceneSmith AI" }] }),
  component: Settings,
});

function Settings() {
  const qc = useQueryClient();
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
  const [known, setKnown] = useState<LanguageCode[]>(["en"]);
  const [uiLang, setUiLang] = useState<LanguageCode>("en");
  const [savingLang, setSavingLang] = useState(false);

  useEffect(() => { if (profile?.full_name) setName(profile.full_name); }, [profile?.full_name]);
  useEffect(() => {
    if (!profile) return;
    const raw = (profile as any).preferred_languages as string[] | undefined;
    if (raw && raw.length) {
      setKnown(raw.filter((l): l is LanguageCode => (SUPPORTED_LANGUAGES as readonly string[]).includes(l)));
    }
    const ui = (profile as any).ui_language as string | undefined;
    if (ui && (SUPPORTED_LANGUAGES as readonly string[]).includes(ui)) {
      setUiLang(ui as LanguageCode);
    }
  }, [profile]);

  const save = async () => {
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("profiles").update({ full_name: name }).eq("id", u.user!.id);
    setSaving(false);
    if (error) toast.error(error.message); else toast.success("Saved");
  };

  const toggleKnown = (code: LanguageCode) => {
    setKnown((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  };

  const saveLanguages = async () => {
    setSavingLang(true);
    const { data: u } = await supabase.auth.getUser();
    const next = known.length ? known : (["en"] as LanguageCode[]);
    const { error } = await supabase
      .from("profiles")
      .update({ preferred_languages: next, ui_language: uiLang })
      .eq("id", u.user!.id);
    setSavingLang(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Languages saved");
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["profile-languages"] });
    }
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

        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center">
              <Languages className="h-5 w-5 text-primary" />
            </div>
            <h2 className="font-semibold">Languages</h2>
          </div>
          <div>
            <Label>Languages I know</Label>
            <p className="text-xs text-muted-foreground mt-1 mb-2">
              Pick every language you can read or write. SceneSmith uses this to silently accept cognates and warn about false friends.
            </p>
            <div className="flex flex-wrap gap-2">
              {SUPPORTED_LANGUAGES.map((code) => {
                const active = known.includes(code);
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => toggleKnown(code)}
                    className={
                      "inline-flex items-center rounded-full border px-3 py-1 text-sm transition " +
                      (active
                        ? "border-primary/50 bg-primary/10 text-foreground"
                        : "border-border/50 bg-transparent text-muted-foreground hover:bg-muted/40")
                    }
                  >
                    {LANGUAGE_LABEL[code]}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <Label>Interface language</Label>
            <select
              value={uiLang}
              onChange={(e) => setUiLang(e.target.value as LanguageCode)}
              className="mt-1 block w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm"
            >
              {SUPPORTED_LANGUAGES.map((code) => (
                <option key={code} value={code}>{LANGUAGE_LABEL[code]}</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              UI translations roll out gradually — your choice is remembered now and applied as locales ship.
            </p>
          </div>
          <Button onClick={saveLanguages} disabled={savingLang}>
            <Save className="h-4 w-4 mr-2" />{savingLang ? "Saving..." : "Save languages"}
          </Button>
        </Card>

        <ModeSettings />


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

