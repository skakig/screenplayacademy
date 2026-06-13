
-- 1) Fix scene_assignments INSERT policy self-join bug
DROP POLICY IF EXISTS scene_assignments_insert_managers ON public.scene_assignments;

CREATE POLICY scene_assignments_insert_managers
  ON public.scene_assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.can_manage_scene_assignments(project_id)
    AND assigned_by = auth.uid()
    AND (
      EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = scene_assignments.project_id
          AND p.user_id = scene_assignments.assignee_id
      )
      OR EXISTS (
        SELECT 1 FROM public.project_members m
        WHERE m.project_id = scene_assignments.project_id
          AND m.user_id = scene_assignments.assignee_id
          AND m.status = 'active'
      )
    )
  );

-- 2) Lock down SECURITY DEFINER helpers — authenticated callers only.
DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM PUBLIC, anon',
                   fn.nspname, fn.proname, fn.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated, service_role',
                   fn.nspname, fn.proname, fn.args);
  END LOOP;
END$$;

-- 3) Allow invitees to delete their own invite record (matched by email).
DROP POLICY IF EXISTS "invites: invitee delete own" ON public.project_invites;
CREATE POLICY "invites: invitee delete own"
  ON public.project_invites
  FOR DELETE
  TO authenticated
  USING (
    lower(email) = lower(COALESCE((auth.jwt() ->> 'email'), ''))
  );

-- 4) Remove live_scene_sessions from the Realtime publication.
--    The app uses broadcast + presence channels (not postgres_changes) for
--    live collaboration, so publishing this table only leaks session metadata
--    to non-members subscribed to the global postgres_changes stream.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'live_scene_sessions'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.live_scene_sessions';
  END IF;
END$$;
