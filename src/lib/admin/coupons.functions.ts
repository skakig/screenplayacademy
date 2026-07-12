import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  type StripeEnv,
  createStripeClient,
  getStripeErrorMessage,
} from "@/lib/stripe.server";

async function ensureAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

export type AdminCoupon = {
  id: string;
  name: string | null;
  percent_off: number | null;
  amount_off: number | null;
  currency: string | null;
  duration: string;
  duration_in_months: number | null;
  max_redemptions: number | null;
  times_redeemed: number;
  redeem_by: number | null;
  valid: boolean;
  created: number;
};

export type AdminPromoCode = {
  id: string;
  code: string;
  coupon_id: string;
  active: boolean;
  max_redemptions: number | null;
  times_redeemed: number;
  expires_at: number | null;
  created: number;
};

function mapCoupon(c: any): AdminCoupon {
  return {
    id: c.id,
    name: c.name ?? null,
    percent_off: c.percent_off ?? null,
    amount_off: c.amount_off ?? null,
    currency: c.currency ?? null,
    duration: c.duration,
    duration_in_months: c.duration_in_months ?? null,
    max_redemptions: c.max_redemptions ?? null,
    times_redeemed: c.times_redeemed ?? 0,
    redeem_by: c.redeem_by ?? null,
    valid: Boolean(c.valid),
    created: c.created,
  };
}
function mapPromo(p: any): AdminPromoCode {
  return {
    id: p.id,
    code: p.code,
    coupon_id: typeof p.coupon === "string" ? p.coupon : p.coupon?.id,
    active: Boolean(p.active),
    max_redemptions: p.max_redemptions ?? null,
    times_redeemed: p.times_redeemed ?? 0,
    expires_at: p.expires_at ?? null,
    created: p.created,
  };
}

export const listCoupons = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { environment: StripeEnv }) => d)
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    try {
      const stripe = createStripeClient(data.environment);
      const res = await stripe.coupons.list({ limit: 100 });
      return { coupons: res.data.map(mapCoupon) };
    } catch (e) {
      return { error: getStripeErrorMessage(e) };
    }
  });

export const createCoupon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      environment: StripeEnv;
      id?: string;
      name?: string;
      percentOff?: number;
      amountOff?: number;
      currency?: string;
      duration: "once" | "repeating" | "forever";
      durationInMonths?: number;
      maxRedemptions?: number;
      redeemBy?: number;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    try {
      const stripe = createStripeClient(data.environment);
      const params: Record<string, unknown> = { duration: data.duration };
      if (data.id) params.id = data.id;
      if (data.name) params.name = data.name;
      if (data.percentOff != null) params.percent_off = data.percentOff;
      if (data.amountOff != null) {
        params.amount_off = data.amountOff;
        params.currency = data.currency ?? "usd";
      }
      if (data.duration === "repeating" && data.durationInMonths != null) {
        params.duration_in_months = data.durationInMonths;
      }
      if (data.maxRedemptions != null) params.max_redemptions = data.maxRedemptions;
      if (data.redeemBy != null) params.redeem_by = data.redeemBy;
      const c = await stripe.coupons.create(params as any);
      return { coupon: mapCoupon(c) };
    } catch (e) {
      return { error: getStripeErrorMessage(e) };
    }
  });

export const deleteCoupon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { environment: StripeEnv; id: string }) => d)
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    try {
      const stripe = createStripeClient(data.environment);
      await stripe.coupons.del(data.id);
      return { ok: true as const };
    } catch (e) {
      return { error: getStripeErrorMessage(e) };
    }
  });

export const listPromotionCodes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { environment: StripeEnv; couponId?: string }) => d)
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    try {
      const stripe = createStripeClient(data.environment);
      const res = await stripe.promotionCodes.list({
        limit: 100,
        ...(data.couponId ? { coupon: data.couponId } : {}),
      });
      return { codes: res.data.map(mapPromo) };
    } catch (e) {
      return { error: getStripeErrorMessage(e) };
    }
  });

export const createPromotionCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      environment: StripeEnv;
      couponId: string;
      code: string;
      maxRedemptions?: number;
      expiresAt?: number;
      firstTimeTransaction?: boolean;
      minimumAmount?: number;
      minimumAmountCurrency?: string;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    try {
      const stripe = createStripeClient(data.environment);
      const params: Record<string, unknown> = {
        coupon: data.couponId,
        code: data.code,
      };
      if (data.maxRedemptions != null) params.max_redemptions = data.maxRedemptions;
      if (data.expiresAt != null) params.expires_at = data.expiresAt;
      const restrictions: Record<string, unknown> = {};
      if (data.firstTimeTransaction) restrictions.first_time_transaction = true;
      if (data.minimumAmount != null) {
        restrictions.minimum_amount = data.minimumAmount;
        restrictions.minimum_amount_currency = data.minimumAmountCurrency ?? "usd";
      }
      if (Object.keys(restrictions).length) params.restrictions = restrictions;
      const p = await stripe.promotionCodes.create(params as any);
      return { code: mapPromo(p) };
    } catch (e) {
      return { error: getStripeErrorMessage(e) };
    }
  });

export const updatePromotionCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { environment: StripeEnv; id: string; active: boolean }) => d)
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    try {
      const stripe = createStripeClient(data.environment);
      const p = await stripe.promotionCodes.update(data.id, { active: data.active });
      return { code: mapPromo(p) };
    } catch (e) {
      return { error: getStripeErrorMessage(e) };
    }
  });
