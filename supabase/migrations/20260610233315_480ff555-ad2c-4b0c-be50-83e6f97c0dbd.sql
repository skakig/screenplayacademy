CREATE TABLE public.draft_takes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  block_count INTEGER NOT NULL DEFAULT 0,
  word_count INTEGER NOT NULL DEFAULT 0,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_draft_takes_project_captured ON public.draft_takes (project_id, captured_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.draft_takes TO authenticated;
GRANT ALL ON public.draft_takes TO service_role;

ALTER TABLE public.draft_takes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view their project takes"
  ON public.draft_takes FOR SELECT
  USING (auth.uid() = user_id AND public.owns_project(project_id));

CREATE POLICY "Owners can insert their project takes"
  ON public.draft_takes FOR INSERT
  WITH CHECK (auth.uid() = user_id AND public.owns_project(project_id));

CREATE POLICY "Owners can update their project takes"
  ON public.draft_takes FOR UPDATE
  USING (auth.uid() = user_id AND public.owns_project(project_id))
  WITH CHECK (auth.uid() = user_id AND public.owns_project(project_id));

CREATE POLICY "Owners can delete their project takes"
  ON public.draft_takes FOR DELETE
  USING (auth.uid() = user_id AND public.owns_project(project_id));

CREATE TRIGGER update_draft_takes_updated_at
  BEFORE UPDATE ON public.draft_takes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();