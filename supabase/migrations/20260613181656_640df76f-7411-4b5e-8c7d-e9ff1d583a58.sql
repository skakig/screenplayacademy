-- Writers' Room — Pass 4: Scene Assignments & Scene Locks

----- scene_assignments -----
CREATE TABLE public.scene_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  scene_id UUID NOT NULL REFERENCES public.scenes(id) ON DELETE CASCADE,
  assignee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'assigned'
    CHECK (status IN ('assigned','in_progress','ready_for_review','approved','blocked','unassigned')),
  due_at TIMESTAMPTZ,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (scene_id, assignee_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.scene_assignments TO authenticated;
GRANT ALL ON public.scene_assignments TO service_role;

----- scene_locks -----
CREATE TABLE public.scene_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  scene_id UUID NOT NULL REFERENCES public.scenes(id) ON DELETE CASCADE,
  locked_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lock_type TEXT NOT NULL DEFAULT 'soft'
    CHECK (lock_type IN ('soft','hard','session','review')),
  reason TEXT,
  expires_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.scene_locks TO authenticated;
GRANT ALL ON public.scene_locks TO service_role;

----- Permission helpers -----
CREATE OR REPLACE FUNCTION public.can_manage_scene_assignments(_project_id uuid)
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

CREATE OR REPLACE FUNCTION public.can_claim_scene(_project_id uuid)
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

CREATE OR REPLACE FUNCTION public.can_override_scene_lock(_project_id uuid)
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
      AND m.role = 'editor'
  );
$$;

REVOKE EXECUTE ON FUNCTION public.can_manage_scene_assignments(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_claim_scene(uuid)              FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_override_scene_lock(uuid)      FROM anon;
GRANT  EXECUTE ON FUNCTION public.can_manage_scene_assignments(uuid) TO authenticated, service_role;
GRANT  EXECUTE ON FUNCTION public.can_claim_scene(uuid)              TO authenticated, service_role;
GRANT  EXECUTE ON FUNCTION public.can_override_scene_lock(uuid)      TO authenticated, service_role;

----- RLS: scene_assignments -----
ALTER TABLE public.scene_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scene_assignments_select_members"
  ON public.scene_assignments FOR SELECT
  TO authenticated
  USING (public.is_project_member(project_id));

CREATE POLICY "scene_assignments_insert_managers"
  ON public.scene_assignments FOR INSERT
  TO authenticated
  WITH CHECK (
    public.can_manage_scene_assignments(project_id)
    AND assigned_by = auth.uid()
    AND (
      EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_id AND p.user_id = assignee_id
      )
      OR EXISTS (
        SELECT 1 FROM public.project_members m
        WHERE m.project_id = project_id
          AND m.user_id = assignee_id
          AND m.status = 'active'
      )
    )
  );

CREATE POLICY "scene_assignments_update_managers"
  ON public.scene_assignments FOR UPDATE
  TO authenticated
  USING (public.can_manage_scene_assignments(project_id))
  WITH CHECK (public.can_manage_scene_assignments(project_id));

CREATE POLICY "scene_assignments_delete_managers"
  ON public.scene_assignments FOR DELETE
  TO authenticated
  USING (public.can_manage_scene_assignments(project_id));

CREATE TRIGGER update_scene_assignments_updated_at
  BEFORE UPDATE ON public.scene_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX scene_assignments_project_id_idx  ON public.scene_assignments(project_id);
CREATE INDEX scene_assignments_scene_id_idx    ON public.scene_assignments(scene_id);
CREATE INDEX scene_assignments_assignee_id_idx ON public.scene_assignments(assignee_id);
CREATE INDEX scene_assignments_status_idx      ON public.scene_assignments(status);
CREATE INDEX scene_assignments_due_at_idx      ON public.scene_assignments(due_at);

----- RLS: scene_locks -----
ALTER TABLE public.scene_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scene_locks_select_members"
  ON public.scene_locks FOR SELECT
  TO authenticated
  USING (public.is_project_member(project_id));

CREATE POLICY "scene_locks_insert_claimers"
  ON public.scene_locks FOR INSERT
  TO authenticated
  WITH CHECK (
    public.can_claim_scene(project_id)
    AND locked_by = auth.uid()
  );

CREATE POLICY "scene_locks_update_self_or_override"
  ON public.scene_locks FOR UPDATE
  TO authenticated
  USING (
    locked_by = auth.uid()
    OR public.owns_project(project_id)
    OR public.can_override_scene_lock(project_id)
  )
  WITH CHECK (
    locked_by = auth.uid()
    OR public.owns_project(project_id)
    OR public.can_override_scene_lock(project_id)
  );

-- No DELETE policy: locks are never hard-deleted, release sets released_at.

CREATE UNIQUE INDEX scene_locks_one_active_per_scene
  ON public.scene_locks (scene_id) WHERE released_at IS NULL;
CREATE INDEX scene_locks_project_id_idx   ON public.scene_locks(project_id);
CREATE INDEX scene_locks_scene_id_idx     ON public.scene_locks(scene_id);
CREATE INDEX scene_locks_locked_by_idx    ON public.scene_locks(locked_by);
CREATE INDEX scene_locks_released_at_idx  ON public.scene_locks(released_at);
CREATE INDEX scene_locks_expires_at_idx   ON public.scene_locks(expires_at);