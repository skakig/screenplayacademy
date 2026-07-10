DROP FUNCTION IF EXISTS public.get_usage_snapshot(text);

CREATE OR REPLACE FUNCTION public.get_usage_snapshot(_environment text DEFAULT 'live'::text)
 RETURNS TABLE(feature text, used integer, monthly_limit integer, tier text, credits_remaining integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_period date := date_trunc('month', now() AT TIME ZONE 'UTC')::date;
  v_tier text;
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;
  v_tier := public.current_subscription_tier(v_uid, _environment);
  RETURN QUERY
  SELECT f AS feature,
         COALESCE((SELECT count_used FROM public.usage_counters u
                    WHERE u.user_id = v_uid AND u.environment = _environment
                      AND u.period_start = v_period AND u.feature = f), 0) AS used,
         public.usage_limit_for(v_tier, f) AS monthly_limit,
         v_tier AS tier,
         COALESCE((SELECT SUM(amount_granted - amount_consumed)::int
                     FROM public.usage_credit_grants g
                    WHERE g.user_id = v_uid AND g.environment = _environment
                      AND g.feature = CASE WHEN f = 'ai_assists' THEN 'ai_tokens' ELSE f END
                      AND (g.expires_at IS NULL OR g.expires_at > now())
                      AND g.amount_consumed < g.amount_granted), 0) AS credits_remaining
  FROM unnest(ARRAY['ai_assists','storyboard_panels','tableread_minutes','ai_tokens','tts_characters']) AS f;
END;
$function$;