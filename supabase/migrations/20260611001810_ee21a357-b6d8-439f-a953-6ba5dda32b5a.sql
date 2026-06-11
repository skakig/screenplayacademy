
CREATE TABLE public.draft_take_comparisons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL,
  left_take_id uuid NOT NULL REFERENCES public.draft_takes(id) ON DELETE CASCADE,
  right_take_id uuid NOT NULL REFERENCES public.draft_takes(id) ON DELETE CASCADE,
  saved_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.draft_take_comparisons TO authenticated;
GRANT ALL ON public.draft_take_comparisons TO service_role;

ALTER TABLE public.draft_take_comparisons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own comparisons"
  ON public.draft_take_comparisons FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own comparisons"
  ON public.draft_take_comparisons FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own comparisons"
  ON public.draft_take_comparisons FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comparisons"
  ON public.draft_take_comparisons FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_dtc_project ON public.draft_take_comparisons(project_id, saved_at DESC);

CREATE TRIGGER update_dtc_updated_at
  BEFORE UPDATE ON public.draft_take_comparisons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
