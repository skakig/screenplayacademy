import { useMemo, useState } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient, useServerFn } from "@tanstack/react-query";
import { useServerFn as useSFN } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import type { StripeEnv } from "@/lib/stripe.server";
import {
  listCoupons,
  createCoupon,
  deleteCoupon,
  listPromotionCodes,
  createPromotionCode,
  updatePromotionCode,
  type AdminCoupon,
  type AdminPromoCode,
} from "@/lib/admin/coupons.functions";

export const Route = createFileRoute("/_authenticated/admin/coupons")({
  component: AdminCouponsPage,
});

function AdminCouponsPage() {
  const { isAdmin, loading } = useIsAdmin();

  if (loading) {
    return (
      <AppShell>
        <div className="max-w-5xl mx-auto px-4 py-16 flex items-center justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Checking permissions…
        </div>
      </AppShell>
    );
  }
  if (!isAdmin) {
    return (
      <AppShell>
        <div className="max-w-2xl mx-auto px-4 py-24 text-center space-y-2">
          <h1 className="text-xl font-semibold">Not found</h1>
          <p className="text-sm text-muted-foreground">
            You don't have access to this page.
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-display">Coupons & Promo Codes</h1>
          <p className="text-sm text-muted-foreground">
            Manage Stripe coupons and promotion codes. Sandbox and Live are separate.
          </p>
        </header>
        <Tabs defaultValue="sandbox">
          <TabsList>
            <TabsTrigger value="sandbox">Sandbox (test)</TabsTrigger>
            <TabsTrigger value="live">Live</TabsTrigger>
          </TabsList>
          <TabsContent value="sandbox" className="pt-4">
            <EnvironmentPanel env="sandbox" />
          </TabsContent>
          <TabsContent value="live" className="pt-4">
            <EnvironmentPanel env="live" />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

function EnvironmentPanel({ env }: { env: StripeEnv }) {
  const qc = useQueryClient();
  const listCouponsFn = useSFN(listCoupons);
  const listPromosFn = useSFN(listPromotionCodes);
  const deleteCouponFn = useSFN(deleteCoupon);
  const updatePromoFn = useSFN(updatePromotionCode);

  const couponsQ = useQuery({
    queryKey: ["admin-coupons", env],
    queryFn: async () => {
      const res = await listCouponsFn({ data: { environment: env } });
      if ("error" in res) throw new Error(res.error);
      return res.coupons;
    },
  });
  const promosQ = useQuery({
    queryKey: ["admin-promos", env],
    queryFn: async () => {
      const res = await listPromosFn({ data: { environment: env } });
      if ("error" in res) throw new Error(res.error);
      return res.codes;
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const res = await deleteCouponFn({ data: { environment: env, id } });
      if ("error" in res) throw new Error(res.error);
    },
    onSuccess: () => {
      toast.success("Coupon deleted");
      qc.invalidateQueries({ queryKey: ["admin-coupons", env] });
      qc.invalidateQueries({ queryKey: ["admin-promos", env] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const togglePromo = useMutation({
    mutationFn: async (v: { id: string; active: boolean }) => {
      const res = await updatePromoFn({ data: { environment: env, ...v } });
      if ("error" in res) throw new Error(res.error);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-promos", env] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const couponsById = useMemo(() => {
    const m = new Map<string, AdminCoupon>();
    (couponsQ.data ?? []).forEach((c) => m.set(c.id, c));
    return m;
  }, [couponsQ.data]);

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-semibold">Coupons</h2>
            <p className="text-xs text-muted-foreground">
              Templates for a discount (percent or amount off).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => qc.invalidateQueries({ queryKey: ["admin-coupons", env] })}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <NewCouponDialog env={env} />
          </div>
        </div>
        {couponsQ.isLoading ? (
          <Loading />
        ) : couponsQ.error ? (
          <ErrorRow message={(couponsQ.error as Error).message} />
        ) : (couponsQ.data ?? []).length === 0 ? (
          <Empty text="No coupons yet." />
        ) : (
          <div className="divide-y divide-border/60">
            {(couponsQ.data ?? []).map((c) => (
              <div key={c.id} className="py-2 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium flex items-center gap-2">
                    {c.name ?? c.id}
                    <span className="text-xs text-muted-foreground">({c.id})</span>
                    {!c.valid && <Badge variant="secondary" className="text-[10px]">invalid</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {c.percent_off != null
                      ? `${c.percent_off}% off`
                      : c.amount_off != null
                        ? `${(c.amount_off / 100).toFixed(2)} ${(c.currency ?? "usd").toUpperCase()} off`
                        : ""}
                    {" · "}
                    {c.duration}
                    {c.duration === "repeating" && c.duration_in_months
                      ? ` (${c.duration_in_months} months)`
                      : ""}
                    {c.max_redemptions ? ` · max ${c.max_redemptions}` : ""}
                    {" · "}
                    {c.times_redeemed} redeemed
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={del.isPending}
                  onClick={() => {
                    if (confirm(`Delete coupon ${c.id}?`)) del.mutate(c.id);
                  }}
                  aria-label="Delete coupon"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-semibold">Promotion codes</h2>
            <p className="text-xs text-muted-foreground">
              Customer-facing codes (e.g. LAUNCH50) that apply a coupon at checkout.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => qc.invalidateQueries({ queryKey: ["admin-promos", env] })}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <NewPromoDialog env={env} coupons={couponsQ.data ?? []} />
          </div>
        </div>
        {promosQ.isLoading ? (
          <Loading />
        ) : promosQ.error ? (
          <ErrorRow message={(promosQ.error as Error).message} />
        ) : (promosQ.data ?? []).length === 0 ? (
          <Empty text="No promo codes yet." />
        ) : (
          <div className="divide-y divide-border/60">
            {(promosQ.data ?? []).map((p) => {
              const c = couponsById.get(p.coupon_id);
              return (
                <div key={p.id} className="py-2 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium flex items-center gap-2">
                      <code className="text-xs bg-muted rounded px-1.5 py-0.5">{p.code}</code>
                      <span className="text-xs text-muted-foreground">→ {p.coupon_id}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {c
                        ? c.percent_off != null
                          ? `${c.percent_off}% off`
                          : `${((c.amount_off ?? 0) / 100).toFixed(2)} ${(c.currency ?? "usd").toUpperCase()} off`
                        : "coupon missing"}
                      {p.max_redemptions ? ` · max ${p.max_redemptions}` : ""}
                      {" · "}
                      {p.times_redeemed} used
                      {p.expires_at
                        ? ` · expires ${new Date(p.expires_at * 1000).toLocaleDateString()}`
                        : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    Active
                    <Switch
                      checked={p.active}
                      disabled={togglePromo.isPending}
                      onCheckedChange={(v) => togglePromo.mutate({ id: p.id, active: v })}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

function Loading() {
  return (
    <div className="py-8 flex items-center justify-center text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading…
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return <div className="py-8 text-center text-sm text-muted-foreground">{text}</div>;
}
function ErrorRow({ message }: { message: string }) {
  return (
    <div className="py-4 text-sm text-destructive">
      {message}
    </div>
  );
}

function NewCouponDialog({ env }: { env: StripeEnv }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"percent" | "amount">("percent");
  const [percent, setPercent] = useState("20");
  const [amount, setAmount] = useState("500");
  const [currency, setCurrency] = useState("usd");
  const [duration, setDuration] = useState<"once" | "repeating" | "forever">("once");
  const [months, setMonths] = useState("3");
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const createFn = useSFN(createCoupon);

  const create = useMutation({
    mutationFn: async () => {
      const payload: Parameters<typeof createFn>[0]["data"] = {
        environment: env,
        duration,
        ...(id ? { id } : {}),
        ...(name ? { name } : {}),
        ...(kind === "percent"
          ? { percentOff: Number(percent) }
          : { amountOff: Number(amount), currency }),
        ...(duration === "repeating" ? { durationInMonths: Number(months) } : {}),
        ...(maxRedemptions ? { maxRedemptions: Number(maxRedemptions) } : {}),
      };
      const res = await createFn({ data: payload });
      if ("error" in res) throw new Error(res.error);
    },
    onSuccess: () => {
      toast.success("Coupon created");
      qc.invalidateQueries({ queryKey: ["admin-coupons", env] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-4 w-4 mr-1" />New coupon</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New coupon ({env})</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="ID (optional)"><Input value={id} onChange={(e) => setId(e.target.value)} placeholder="LAUNCH50" /></Field>
          <Field label="Name (optional)"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Launch promo" /></Field>
          <Field label="Discount">
            <div className="flex gap-2">
              <Select value={kind} onValueChange={(v) => setKind(v as any)}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">Percent</SelectItem>
                  <SelectItem value="amount">Amount</SelectItem>
                </SelectContent>
              </Select>
              {kind === "percent" ? (
                <Input type="number" value={percent} onChange={(e) => setPercent(e.target.value)} placeholder="20" />
              ) : (
                <>
                  <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="500 (cents)" />
                  <Input value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-20" />
                </>
              )}
            </div>
          </Field>
          <Field label="Duration">
            <div className="flex gap-2">
              <Select value={duration} onValueChange={(v) => setDuration(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="once">Once</SelectItem>
                  <SelectItem value="repeating">Repeating (months)</SelectItem>
                  <SelectItem value="forever">Forever</SelectItem>
                </SelectContent>
              </Select>
              {duration === "repeating" && (
                <Input type="number" value={months} onChange={(e) => setMonths(e.target.value)} className="w-24" />
              )}
            </div>
          </Field>
          <Field label="Max redemptions (optional)">
            <Input type="number" value={maxRedemptions} onChange={(e) => setMaxRedemptions(e.target.value)} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={create.isPending} onClick={() => create.mutate()}>
            {create.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewPromoDialog({ env, coupons }: { env: StripeEnv; coupons: AdminCoupon[] }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [couponId, setCouponId] = useState<string>(coupons[0]?.id ?? "");
  const [code, setCode] = useState("");
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [firstTime, setFirstTime] = useState(false);
  const createFn = useSFN(createPromotionCode);

  const create = useMutation({
    mutationFn: async () => {
      if (!couponId) throw new Error("Pick a coupon");
      if (!code) throw new Error("Code required");
      const res = await createFn({
        data: {
          environment: env,
          couponId,
          code,
          ...(maxRedemptions ? { maxRedemptions: Number(maxRedemptions) } : {}),
          ...(expiresAt ? { expiresAt: Math.floor(new Date(expiresAt).getTime() / 1000) } : {}),
          firstTimeTransaction: firstTime,
        },
      });
      if ("error" in res) throw new Error(res.error);
    },
    onSuccess: () => {
      toast.success("Promo code created");
      qc.invalidateQueries({ queryKey: ["admin-promos", env] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary" disabled={coupons.length === 0}>
          <Plus className="h-4 w-4 mr-1" />New promo code
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New promotion code ({env})</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Coupon">
            <Select value={couponId} onValueChange={setCouponId}>
              <SelectTrigger><SelectValue placeholder="Pick a coupon" /></SelectTrigger>
              <SelectContent>
                {coupons.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name ?? c.id} — {c.percent_off != null ? `${c.percent_off}%` : `${((c.amount_off ?? 0) / 100).toFixed(2)} ${(c.currency ?? "usd").toUpperCase()}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Code"><Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="LAUNCH50" /></Field>
          <Field label="Max redemptions (optional)">
            <Input type="number" value={maxRedemptions} onChange={(e) => setMaxRedemptions(e.target.value)} />
          </Field>
          <Field label="Expires (optional)">
            <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={firstTime} onCheckedChange={setFirstTime} />
            First-time customers only
          </label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={create.isPending} onClick={() => create.mutate()}>
            {create.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
