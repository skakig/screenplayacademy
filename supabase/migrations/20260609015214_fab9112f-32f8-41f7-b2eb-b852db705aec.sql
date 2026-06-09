CREATE TABLE public.project_dictionary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  term text NOT NULL,
  normalized_term text GENERATED ALWAYS AS (lower(term)) STORED,
  category text NOT NULL DEFAULT 'custom' CHECK (category IN (
    'character','location','organization','object','fictional_term',
    'foreign_word','historical_term','slang','dialect','custom'
  )),
  language text,
  notes text,
  created_from text NOT NULL DEFAULT 'manual' CHECK (created_from IN (
    'manual','character_bible','script_detection','import','ai_suggestion'
  )),
  approved boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, normalized_term)
);

CREATE INDEX project_dictionary_project_idx ON public.project_dictionary(project_id);
CREATE INDEX project_dictionary_normalized_idx ON public.project_dictionary(project_id, normalized_term);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_dictionary TO authenticated;
GRANT ALL ON public.project_dictionary TO service_role;

ALTER TABLE public.project_dictionary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project owners can read dictionary"
  ON public.project_dictionary FOR SELECT
  TO authenticated
  USING (public.owns_project(project_id));

CREATE POLICY "Project owners can insert dictionary terms"
  ON public.project_dictionary FOR INSERT
  TO authenticated
  WITH CHECK (public.owns_project(project_id));

CREATE POLICY "Project owners can update dictionary terms"
  ON public.project_dictionary FOR UPDATE
  TO authenticated
  USING (public.owns_project(project_id))
  WITH CHECK (public.owns_project(project_id));

CREATE POLICY "Project owners can delete dictionary terms"
  ON public.project_dictionary FOR DELETE
  TO authenticated
  USING (public.owns_project(project_id));

CREATE TRIGGER update_project_dictionary_updated_at
  BEFORE UPDATE ON public.project_dictionary
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();