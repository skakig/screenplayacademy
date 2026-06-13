
-- =========================================================================
-- 1) project_members
-- =========================================================================
CREATE TABLE public.project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'viewer'
    CHECK (role IN ('owner','co_writer','editor','producer','commenter','viewer','actor_reader','assistant')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('invited','active','suspended','left','removed')),
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  joined_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_members TO authenticated;
GRANT ALL ON public.project_members TO service_role;

ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_project_members_project ON public.project_members(project_id);
CREATE INDEX idx_project_members_user ON public.project_members(user_id);
CREATE INDEX idx_project_members_project_status ON public.project_members(project_id, status);

CREATE TRIGGER trg_project_members_updated
  BEFORE UPDATE ON public.project_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================================
-- 2) project_invites
-- =========================================================================
CREATE TABLE public.project_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer'
    CHECK (role IN ('owner','co_writer','editor','producer','commenter','viewer','actor_reader','assistant')),
  token_hash TEXT NOT NULL UNIQUE,
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','revoked','expired')),
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_invites TO authenticated;
GRANT ALL ON public.project_invites TO service_role;

ALTER TABLE public.project_invites ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_project_invites_project_status ON public.project_invites(project_id, status);
CREATE INDEX idx_project_invites_email ON public.project_invites(lower(email));

CREATE TRIGGER trg_project_invites_updated
  BEFORE UPDATE ON public.project_invites
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================================
-- 3) Membership helpers (SECURITY DEFINER, recursion-safe)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.is_project_member(_project_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = _project_id AND p.user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.project_members m
    WHERE m.project_id = _project_id
      AND m.user_id = auth.uid()
      AND m.status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.project_role(_project_id UUID)
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = _project_id AND p.user_id = auth.uid()
    ) THEN 'owner'
    ELSE (
      SELECT m.role FROM public.project_members m
      WHERE m.project_id = _project_id
        AND m.user_id = auth.uid()
        AND m.status = 'active'
      LIMIT 1
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.can_edit_project(_project_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
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

-- =========================================================================
-- 4) RLS policies (owner-centric for Pass 1)
-- =========================================================================

-- project_members
CREATE POLICY "members: owner select"
  ON public.project_members FOR SELECT
  USING (public.owns_project(project_id) OR user_id = auth.uid());

CREATE POLICY "members: owner insert"
  ON public.project_members FOR INSERT
  WITH CHECK (public.owns_project(project_id));

CREATE POLICY "members: owner update"
  ON public.project_members FOR UPDATE
  USING (public.owns_project(project_id))
  WITH CHECK (public.owns_project(project_id));

CREATE POLICY "members: owner delete"
  ON public.project_members FOR DELETE
  USING (public.owns_project(project_id));

-- project_invites
CREATE POLICY "invites: owner select"
  ON public.project_invites FOR SELECT
  USING (public.owns_project(project_id));

CREATE POLICY "invites: owner insert"
  ON public.project_invites FOR INSERT
  WITH CHECK (public.owns_project(project_id));

CREATE POLICY "invites: owner update"
  ON public.project_invites FOR UPDATE
  USING (public.owns_project(project_id))
  WITH CHECK (public.owns_project(project_id));

CREATE POLICY "invites: owner delete"
  ON public.project_invites FOR DELETE
  USING (public.owns_project(project_id));

-- =========================================================================
-- 5) Idempotent owner backfill
-- =========================================================================
INSERT INTO public.project_members (project_id, user_id, role, status, joined_at)
SELECT p.id, p.user_id, 'owner', 'active', now()
FROM public.projects p
ON CONFLICT (project_id, user_id) DO NOTHING;
