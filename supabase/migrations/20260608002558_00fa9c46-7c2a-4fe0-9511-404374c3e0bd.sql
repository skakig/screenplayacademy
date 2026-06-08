CREATE TABLE public.guided_step_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  user_id UUID NOT NULL,
  step_key TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  content TEXT NOT NULL,
  label TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX guided_step_versions_lookup_idx
  ON public.guided_step_versions (project_id, step_key, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.guided_step_versions TO authenticated;
GRANT ALL ON public.guided_step_versions TO service_role;

ALTER TABLE public.guided_step_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Step versions: owner all"
  ON public.guided_step_versions
  FOR ALL
  USING (public.owns_project(project_id))
  WITH CHECK (public.owns_project(project_id));
