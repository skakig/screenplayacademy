
-- 1. Admin role infrastructure
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read own roles" ON public.user_roles;
CREATE POLICY "read own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- 2. Extend usage limits with ai_tokens + tts_characters
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
    WHEN 'ai_tokens' THEN
      CASE _tier WHEN 'studio' THEN 8000000 WHEN 'pro' THEN 2500000 WHEN 'creator' THEN 500000 ELSE 20000 END
    WHEN 'tts_characters' THEN
      CASE _tier WHEN 'studio' THEN 750000 WHEN 'pro' THEN 150000 WHEN 'creator' THEN 25000 ELSE 0 END
    ELSE 0
  END;
$$;

-- 3. Expand snapshot to return the new counters too
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
  FROM unnest(ARRAY['ai_assists','storyboard_panels','tableread_minutes','ai_tokens','tts_characters']) AS f;
END;
$$;
