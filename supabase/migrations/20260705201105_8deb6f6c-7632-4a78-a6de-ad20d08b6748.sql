-- 1) usage_counters table
CREATE TABLE public.usage_counters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  environment text NOT NULL DEFAULT 'sandbox',
  period_start date NOT NULL,
  feature text NOT NULL,
  count_used integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, environment, period_start, feature)
);

CREATE INDEX idx_usage_counters_lookup
  ON public.usage_counters (user_id, environment, period_start, feature);

GRANT SELECT ON public.usage_counters TO authenticated;
GRANT ALL ON public.usage_counters TO service_role;

ALTER TABLE public.usage_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own usage"
  ON public.usage_counters FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages usage"
  ON public.usage_counters FOR ALL
  USING (auth.role() = 'service_role');

CREATE TRIGGER update_usage_counters_updated_at
  BEFORE UPDATE ON public.usage_counters
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Tier + feature limits helper (kept in SQL so DB and app agree)
CREATE OR REPLACE FUNCTION public.usage_limit_for(_tier text, _feature text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE _feature
    WHEN 'ai_assists' THEN
      CASE _tier WHEN 'studio' THEN 1000 WHEN 'pro' THEN 500 WHEN 'creator' THEN 100 ELSE 5 END
    WHEN 'storyboard_panels' THEN
      CASE _tier WHEN 'studio' THEN 500 WHEN 'pro' THEN 100 WHEN 'creator' THEN 25 ELSE 0 END
    WHEN 'tableread_minutes' THEN
      CASE _tier WHEN 'studio' THEN 600 WHEN 'pro' THEN 180 WHEN 'creator' THEN 30 ELSE 0 END
    ELSE 0
  END;
$$;

-- 3) Atomic check-and-consume
-- Returns the new count_used on success; raises `USAGE_LIMIT: ...` otherwise.
-- SECURITY DEFINER so it can read/write bypassing RLS, but callers are
-- always identified via auth.uid() so users cannot spend someone else's quota.
CREATE OR REPLACE FUNCTION public.consume_usage(
  _feature text,
  _amount integer,
  _environment text DEFAULT 'live'
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_period date := date_trunc('month', now() AT TIME ZONE 'UTC')::date;
  v_tier text := public.current_subscription_tier(v_uid, _environment);
  v_limit integer := public.usage_limit_for(v_tier, _feature);
  v_new integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'USAGE_LIMIT: not authenticated';
  END IF;
  IF _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'USAGE_LIMIT: invalid amount';
  END IF;

  INSERT INTO public.usage_counters (user_id, environment, period_start, feature, count_used)
  VALUES (v_uid, _environment, v_period, _feature, _amount)
  ON CONFLICT (user_id, environment, period_start, feature)
  DO UPDATE SET count_used = public.usage_counters.count_used + EXCLUDED.count_used,
                updated_at = now()
  RETURNING count_used INTO v_new;

  IF v_new > v_limit THEN
    -- Roll back the increment so counters never exceed the cap.
    UPDATE public.usage_counters
       SET count_used = GREATEST(0, count_used - _amount),
           updated_at = now()
     WHERE user_id = v_uid
       AND environment = _environment
       AND period_start = v_period
       AND feature = _feature;
    RAISE EXCEPTION 'USAGE_LIMIT: % monthly cap reached on the % plan (used %/%).',
      _feature, v_tier, v_new - _amount, v_limit;
  END IF;

  RETURN v_new;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.consume_usage(text, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_usage(text, integer, text) TO authenticated, service_role;

-- 4) Snapshot for a settings/usage widget
CREATE OR REPLACE FUNCTION public.get_usage_snapshot(_environment text DEFAULT 'live')
RETURNS TABLE (feature text, used integer, monthly_limit integer, tier text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
         v_tier AS tier
  FROM unnest(ARRAY['ai_assists','storyboard_panels','tableread_minutes']) AS f;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_usage_snapshot(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_usage_snapshot(text) TO authenticated, service_role;

-- 5) current_subscription_tier is called with authenticated role now.
GRANT EXECUTE ON FUNCTION public.current_subscription_tier(uuid, text) TO authenticated, service_role;