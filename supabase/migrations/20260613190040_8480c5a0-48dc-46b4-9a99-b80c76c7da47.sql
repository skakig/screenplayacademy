CREATE OR REPLACE FUNCTION public.update_my_project_last_seen(_project_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.project_members
     SET last_seen_at = now()
   WHERE project_id = _project_id
     AND user_id = auth.uid()
     AND status = 'active';
$$;

GRANT EXECUTE ON FUNCTION public.update_my_project_last_seen(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.update_my_project_last_seen(uuid) FROM anon;