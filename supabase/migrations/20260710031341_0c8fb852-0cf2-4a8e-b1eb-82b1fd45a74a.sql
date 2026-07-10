
CREATE TABLE IF NOT EXISTS public.usage_credit_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  environment text NOT NULL CHECK (environment IN ('sandbox','live')),
  feature text NOT NULL CHECK (feature IN ('ai_tokens','tts_characters')),
  amount_granted integer NOT NULL CHECK (amount_granted > 0),
  amount_consumed integer NOT NULL DEFAULT 0 CHECK (amount_consumed >= 0),
  stripe_session_id text UNIQUE,
  price_id text,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS usage_credit_grants_user_feat_idx
  ON public.usage_credit_grants (user_id, environment, feature, created_at);

GRANT SELECT ON public.usage_credit_grants TO authenticated;
GRANT ALL ON public.usage_credit_grants TO service_role;

ALTER TABLE public.usage_credit_grants ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='usage_credit_grants' AND policyname='Users read own grants') THEN
    CREATE POLICY "Users read own grants" ON public.usage_credit_grants
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DROP TRIGGER IF EXISTS update_usage_credit_grants_updated_at ON public.usage_credit_grants;
CREATE TRIGGER update_usage_credit_grants_updated_at
  BEFORE UPDATE ON public.usage_credit_grants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.consume_usage(_feature text, _amount integer, _environment text DEFAULT 'live'::text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_period date := date_trunc('month', now() AT TIME ZONE 'UTC')::date;
  v_tier text := public.current_subscription_tier(v_uid, _environment);
  v_limit integer := public.usage_limit_for(v_tier, _feature);
  v_new integer;
  v_overflow integer;
  v_credit_feature text;
  v_grant record;
  v_take integer;
  v_remaining integer;
  v_ai_credit_avail integer;
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

  IF v_new <= v_limit THEN
    RETURN v_new;
  END IF;

  v_overflow := v_new - GREATEST(v_limit, v_new - _amount);

  IF _feature = 'ai_assists' THEN
    SELECT COALESCE(SUM(amount_granted - amount_consumed), 0) INTO v_ai_credit_avail
      FROM public.usage_credit_grants
     WHERE user_id = v_uid AND environment = _environment
       AND feature = 'ai_tokens'
       AND (expires_at IS NULL OR expires_at > now())
       AND amount_consumed < amount_granted;
    IF v_ai_credit_avail > 0 THEN
      RETURN v_new;
    END IF;
    v_credit_feature := NULL;
  ELSIF _feature IN ('ai_tokens', 'tts_characters') THEN
    v_credit_feature := _feature;
  ELSE
    v_credit_feature := NULL;
  END IF;

  IF v_credit_feature IS NOT NULL THEN
    v_remaining := v_overflow;
    FOR v_grant IN
      SELECT id, amount_granted, amount_consumed
        FROM public.usage_credit_grants
       WHERE user_id = v_uid AND environment = _environment
         AND feature = v_credit_feature
         AND (expires_at IS NULL OR expires_at > now())
         AND amount_consumed < amount_granted
       ORDER BY created_at ASC
       FOR UPDATE
    LOOP
      EXIT WHEN v_remaining <= 0;
      v_take := LEAST(v_remaining, v_grant.amount_granted - v_grant.amount_consumed);
      UPDATE public.usage_credit_grants
         SET amount_consumed = amount_consumed + v_take,
             updated_at = now()
       WHERE id = v_grant.id;
      v_remaining := v_remaining - v_take;
    END LOOP;
    IF v_remaining <= 0 THEN
      RETURN v_new;
    END IF;
  END IF;

  UPDATE public.usage_counters
     SET count_used = GREATEST(0, count_used - _amount),
         updated_at = now()
   WHERE user_id = v_uid
     AND environment = _environment
     AND period_start = v_period
     AND feature = _feature;
  RAISE EXCEPTION 'USAGE_LIMIT: % monthly cap reached on the % plan (used %/%). Buy credits to continue.',
    _feature, v_tier, v_new - _amount, v_limit;
END;
$function$;
