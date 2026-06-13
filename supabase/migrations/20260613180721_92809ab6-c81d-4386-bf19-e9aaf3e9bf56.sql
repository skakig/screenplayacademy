-- Writers' Room — Pass 3: Comments & Review Notes
-- Create comments table, RLS policies, permission helpers, indexes.

CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  scene_id UUID REFERENCES public.scenes(id) ON DELETE CASCADE,
  script_block_id UUID REFERENCES public.script_blocks(id) ON DELETE CASCADE,
  parent_comment_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 5000),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','resolved','archived')),
  anchor_text TEXT,
  anchor_offset_start INTEGER,
  anchor_offset_end INTEGER,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.comments TO authenticated;
GRANT ALL ON public.comments TO service_role;

-- Permission helpers (security definer, no recursion into RLS-protected tables
-- since project_members is read via existing helpers' security-definer path).
CREATE OR REPLACE FUNCTION public.can_comment_on_project(_project_id uuid)
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

CREATE OR REPLACE FUNCTION public.can_resolve_project_comments(_project_id uuid)
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

REVOKE EXECUTE ON FUNCTION public.can_comment_on_project(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_resolve_project_comments(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_comment_on_project(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_resolve_project_comments(uuid) TO authenticated, service_role;

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comments_select_members"
  ON public.comments FOR SELECT
  TO authenticated
  USING (public.is_project_member(project_id));

CREATE POLICY "comments_insert_commenters"
  ON public.comments FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND public.can_comment_on_project(project_id)
  );

CREATE POLICY "comments_update_author_or_resolver"
  ON public.comments FOR UPDATE
  TO authenticated
  USING (
    author_id = auth.uid()
    OR public.can_resolve_project_comments(project_id)
  )
  WITH CHECK (
    author_id = auth.uid()
    OR public.can_resolve_project_comments(project_id)
  );

CREATE POLICY "comments_delete_owner_only"
  ON public.comments FOR DELETE
  TO authenticated
  USING (public.owns_project(project_id));

CREATE TRIGGER update_comments_updated_at
  BEFORE UPDATE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX comments_project_id_idx       ON public.comments(project_id);
CREATE INDEX comments_scene_id_idx         ON public.comments(scene_id);
CREATE INDEX comments_script_block_id_idx  ON public.comments(script_block_id);
CREATE INDEX comments_parent_comment_id_idx ON public.comments(parent_comment_id);
CREATE INDEX comments_author_id_idx        ON public.comments(author_id);
CREATE INDEX comments_status_idx           ON public.comments(status);
CREATE INDEX comments_created_at_idx       ON public.comments(created_at);
CREATE INDEX comments_project_status_idx   ON public.comments(project_id, status);