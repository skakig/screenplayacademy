
-- Tighten arena_entries SELECT so blind rounds cannot leak identities via direct
-- table reads. Replaces the broad member-visibility policy with a state-aware helper.

CREATE OR REPLACE FUNCTION public.has_arena_entry_read_access(
  _session_id uuid,
  _project_id uuid,
  _author_id uuid,
  _status public.arena_entry_status
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- Must be a member of the project.
    public.is_project_member(_project_id)
    AND (
      -- Author always sees their own row.
      _author_id = auth.uid()
      -- Otherwise entries are only ever visible once submitted, and never during
      -- an active writing round (running).
      OR (
        _status = 'submitted'
        AND EXISTS (
          SELECT 1 FROM public.arena_sessions s
          WHERE s.id = _session_id
            AND s.status IN ('voting','complete','archived')
            -- During blind voting, non-authors cannot read the row at all;
            -- they must use get_arena_voting_entries (which nulls author_id).
            AND NOT (s.status = 'voting' AND s.entry_reveal = 'blind_until_results')
        )
      )
    );
$$;

REVOKE ALL ON FUNCTION public.has_arena_entry_read_access(uuid, uuid, uuid, public.arena_entry_status) FROM public;
GRANT EXECUTE ON FUNCTION public.has_arena_entry_read_access(uuid, uuid, uuid, public.arena_entry_status) TO authenticated, service_role;

DROP POLICY IF EXISTS "arena_entries_select_members" ON public.arena_entries;

CREATE POLICY "arena_entries_select_scoped" ON public.arena_entries
  FOR SELECT TO authenticated
  USING (
    public.has_arena_entry_read_access(session_id, project_id, author_id, status)
  );
