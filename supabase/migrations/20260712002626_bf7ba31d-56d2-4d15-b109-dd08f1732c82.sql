
CREATE TABLE public.character_bibles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  universe_id uuid NOT NULL REFERENCES public.story_universes(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1,
  summary text,
  source_document_ids uuid[] NOT NULL DEFAULT '{}',
  entries jsonb NOT NULL DEFAULT '[]'::jsonb,
  generated_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (universe_id, project_id, version)
);

CREATE INDEX idx_character_bibles_universe ON public.character_bibles(universe_id, project_id, version DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.character_bibles TO authenticated;
GRANT ALL ON public.character_bibles TO service_role;

ALTER TABLE public.character_bibles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "character_bibles_owner_all" ON public.character_bibles
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.story_universes u
      WHERE u.id = character_bibles.universe_id AND u.owner_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = character_bibles.project_id AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.story_universes u
      WHERE u.id = character_bibles.universe_id AND u.owner_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = character_bibles.project_id AND p.user_id = auth.uid()
    )
  );

CREATE TRIGGER trg_character_bibles_updated_at
  BEFORE UPDATE ON public.character_bibles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
