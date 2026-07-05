CREATE OR REPLACE FUNCTION public.has_active_subscription(
  user_uuid uuid,
  check_env text DEFAULT 'live'::text
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = user_uuid
      AND environment = check_env
      AND (
        -- active / trialing / past_due retain access while Paddle retries payment
        (status IN ('active', 'trialing', 'past_due')
          AND (current_period_end IS NULL OR current_period_end > now()))
        -- canceled subs keep access until the paid period ends (grace)
        OR (status = 'canceled' AND current_period_end > now())
      )
  );
$function$;

-- Tier-aware helper: returns the current active tier ('free' | 'creator' | 'pro' | 'studio')
-- Uses the most recent active row's price_id.
CREATE OR REPLACE FUNCTION public.current_subscription_tier(
  user_uuid uuid,
  check_env text DEFAULT 'live'::text
)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT CASE
      WHEN price_id = 'studio_monthly'  THEN 'studio'
      WHEN price_id = 'pro_monthly'     THEN 'pro'
      WHEN price_id = 'creator_monthly' THEN 'creator'
      ELSE 'free'
    END
    FROM public.subscriptions
    WHERE user_id = user_uuid
      AND environment = check_env
      AND (
        (status IN ('active','trialing','past_due')
          AND (current_period_end IS NULL OR current_period_end > now()))
        OR (status = 'canceled' AND current_period_end > now())
      )
    ORDER BY created_at DESC
    LIMIT 1),
    'free'
  );
$function$;