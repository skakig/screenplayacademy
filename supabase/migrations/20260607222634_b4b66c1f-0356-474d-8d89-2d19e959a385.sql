
-- Stripe-ready columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS subscription_tier text NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS current_period_end timestamptz;

-- storyboard_assets
CREATE TABLE public.storyboard_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  scene_id uuid,
  prompt text NOT NULL,
  style text,
  image_url text,
  status text NOT NULL DEFAULT 'pending',
  order_index int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.storyboard_assets TO authenticated;
GRANT ALL ON public.storyboard_assets TO service_role;
ALTER TABLE public.storyboard_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Storyboard: owner all" ON public.storyboard_assets
  FOR ALL USING (public.owns_project(project_id)) WITH CHECK (public.owns_project(project_id));
CREATE TRIGGER trg_storyboard_updated BEFORE UPDATE ON public.storyboard_assets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- audio_assets
CREATE TABLE public.audio_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  scene_id uuid,
  kind text NOT NULL DEFAULT 'table_read',
  audio_url text,
  voice_map jsonb NOT NULL DEFAULT '{}'::jsonb,
  duration_seconds int,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audio_assets TO authenticated;
GRANT ALL ON public.audio_assets TO service_role;
ALTER TABLE public.audio_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Audio: owner all" ON public.audio_assets
  FOR ALL USING (public.owns_project(project_id)) WITH CHECK (public.owns_project(project_id));
CREATE TRIGGER trg_audio_updated BEFORE UPDATE ON public.audio_assets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- pitch_packages
CREATE TABLE public.pitch_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL UNIQUE,
  logline text,
  short_synopsis text,
  one_page_synopsis text,
  treatment text,
  character_bible text,
  tone_statement text,
  comparables text,
  target_audience text,
  budget_tier text,
  poster_prompt text,
  trailer_vo text,
  pitch_email text,
  generated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pitch_packages TO authenticated;
GRANT ALL ON public.pitch_packages TO service_role;
ALTER TABLE public.pitch_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Pitch: owner all" ON public.pitch_packages
  FOR ALL USING (public.owns_project(project_id)) WITH CHECK (public.owns_project(project_id));
CREATE TRIGGER trg_pitch_updated BEFORE UPDATE ON public.pitch_packages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
