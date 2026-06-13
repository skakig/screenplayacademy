
-- Suggestions table for Writers' Room (Pass 5)
CREATE TABLE public.suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  scene_id uuid REFERENCES public.scenes(id) ON DELETE CASCADE,
  script_block_id uuid REFERENCES public.script_blocks(id) ON DELETE CASCADE,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'human'
    CHECK (source IN ('human','ai','import_diagnostic','script_brain','table_read')),
  suggestion_type text NOT NULL
    CHECK (suggestion_type IN (
      'replace_block_text','insert_block_after','delete_block','change_block_type',
      'rewrite_scene','character_note','structure_note','continuity_fix','pitch_deck_note'
    )),
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','accepted','rejected','archived')),
  title text,
  rationale text,
  before jsonb,
  after jsonb NOT NULL,
  accepted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_at timestamptz,
  rejected_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  rejected_at timestamptz,
  applied_to_canonical boolean NOT NULL DEFAULT false,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX suggestions_project_id_idx ON public.suggestions(project_id);
CREATE INDEX suggestions_scene_id_idx ON public.suggestions(scene_id);
CREATE INDEX suggestions_script_block_id_idx ON public.suggestions(script_block_id);
CREATE INDEX suggestions_author_id_idx ON public.suggestions(author_id);
CREATE INDEX suggestions_source_idx ON public.suggestions(source);
CREATE INDEX suggestions_status_idx ON public.suggestions(status);
CREATE INDEX suggestions_suggestion_type_idx ON public.suggestions(suggestion_type);
CREATE INDEX suggestions_created_at_idx ON public.suggestions(created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.suggestions TO authenticated;
GRANT ALL ON public.suggestions TO service_role;

ALTER TABLE public.suggestions ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER suggestions_updated_at
BEFORE UPDATE ON public.suggestions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Permission helpers (security definer, mirror Pass 3/4 style) -----------

CREATE OR REPLACE FUNCTION public.can_view_suggestions(_project_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_project_member(_project_id);
$$;

CREATE OR REPLACE FUNCTION public.can_create_suggestion(_project_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = _project_id AND p.user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.project_members m
    WHERE m.project_id = _project_id
      AND m.user_id = auth.uid()
      AND m.status = 'active'
      AND m.role IN ('co_writer','editor','producer','commenter','assistant')
  );
$$;

CREATE OR REPLACE FUNCTION public.can_accept_suggestion(_project_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = _project_id AND p.user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.project_members m
    WHERE m.project_id = _project_id
      AND m.user_id = auth.uid()
      AND m.status = 'active'
      AND m.role IN ('co_writer','editor')
  );
$$;

CREATE OR REPLACE FUNCTION public.can_reject_suggestion(_project_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = _project_id AND p.user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.project_members m
    WHERE m.project_id = _project_id
      AND m.user_id = auth.uid()
      AND m.status = 'active'
      AND m.role IN ('co_writer','editor','producer')
  );
$$;

CREATE OR REPLACE FUNCTION public.can_archive_suggestion(_project_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = _project_id AND p.user_id = auth.uid()
  );
$$;

-- RLS policies ----------------------------------------------------------

CREATE POLICY "View suggestions if project member"
ON public.suggestions FOR SELECT TO authenticated
USING (public.can_view_suggestions(project_id));

CREATE POLICY "Create suggestions as self with allowed role"
ON public.suggestions FOR INSERT TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND status = 'open'
  AND public.can_create_suggestion(project_id)
);

-- Update covers accept, reject, archive, and author self-reject of own open suggestion.
CREATE POLICY "Update suggestions per role"
ON public.suggestions FOR UPDATE TO authenticated
USING (
  public.can_accept_suggestion(project_id)
  OR public.can_reject_suggestion(project_id)
  OR public.can_archive_suggestion(project_id)
  OR (author_id = auth.uid() AND status = 'open')
)
WITH CHECK (
  public.can_accept_suggestion(project_id)
  OR public.can_reject_suggestion(project_id)
  OR public.can_archive_suggestion(project_id)
  OR (author_id = auth.uid() AND status = 'open')
);
