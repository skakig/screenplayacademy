import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Save, User as UserIcon, Languages, CreditCard, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { ModeSettings } from "@/components/settings/ModeSettings";
import { useSubscription } from "@/hooks/useSubscription";
import { TIER_LABEL } from "@/lib/entitlements";
import { createCustomerPortalSession } from "@/lib/customerPortal.functions";
import {
  SUPPORTED_LANGUAGES,
  LANGUAGE_LABEL,
  type LanguageCode,
} from "@/lib/language/types";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — SceneSmith AI" }] }),
  component: Settings,
});

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function PlanCard() {
  const openPortal = useServerFn(createCustomerPortalSession);
  const { loading, subscription, tier, isActive, isPastDue, isCanceledInGrace } = useSubscription();
  const [busy, setBusy] = useState(false);

  const handlePortal = async () => {
    setBusy(true);
    try {
      const { getStripeEnvironment } = await import("@/lib/stripe");
      const result = await openPortal({
        data: { environment: getStripeEnvironment(), returnUrl: window.location.href },
      });
      if ("error" in result) throw new Error(result.error);
      window.open(result.url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open billing portal");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center gap-3 mb-1">
        <div className="h-10 w-10 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center">
          <CreditCard className="h-5 w-5 text-primary" />
        </div>
        <h2 className="font-semibold">Plan &amp; billing</h2>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Current plan:</span>
        <Badge variant={tier === "free" ? "outline" : "default"} className="capitalize">
          {loading ? "…" : TIER_LABEL[tier]}
        </Badge>
        {isPastDue && (
          <Badge variant="destructive">Payment failed</Badge>
        )}
        {isCanceledInGrace && (
          <Badge variant="outline" className="border-orange-400 text-orange-600">
            Ends {formatDate(subscription?.current_period_end)}
          </Badge>
        )}
      </div>

      {isActive && subscription && !isCanceledInGrace && (
        <p className="text-xs text-muted-foreground">
          {subscription.cancel_at_period_end
            ? `Scheduled to cancel on ${formatDate(subscription.current_period_end)}.`
            : `Renews on ${formatDate(subscription.current_period_end)}.`}
        </p>
      )}
      {!isActive && !loading && (
        <p className="text-xs text-muted-foreground">
          You're on the Free plan (1 project, editor only). Upgrade to unlock more projects, Script Brain, Pitch Deck, Table Read, Storyboard, and Writers' Room.
        </p>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        {isActive ? (
          <Button variant="outline" size="sm" onClick={handlePortal} disabled={busy}>
            <ExternalLink className="h-4 w-4 mr-2" />
            {busy ? "Opening…" : "Manage subscription"}
          </Button>
        ) : (
          <Button asChild size="sm">
            <a href="/pricing">See plans</a>
          </Button>
        )}
      </div>
    </Card>
  );
}

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
          <p className="text-muted-foreground">Your account &amp; plan.</p>
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

        <PlanCard />

        <Card className="p-6 space-y-3 border-destructive/30">
          <h2 className="font-semibold text-destructive">Danger zone</h2>
          <p className="text-xs text-muted-foreground">Account deletion is permanent and removes all your projects.</p>
          <Button variant="outline" size="sm" onClick={() => toast.info("Contact support to delete your account.")}>Delete account</Button>
        </Card>
      </div>
    </AppShell>
  );
}
