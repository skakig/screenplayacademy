
CREATE OR REPLACE FUNCTION public.get_project_member_identities(_project_id uuid, _user_ids uuid[])
RETURNS TABLE(user_id uuid, display_name text, avatar_url text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'IDENTITY: authentication required'; END IF;
  IF NOT public.is_project_member(_project_id) THEN
    RAISE EXCEPTION 'IDENTITY: not a project member';
  END IF;
  RETURN QUERY
  SELECT p.id AS user_id,
         COALESCE(NULLIF(btrim(p.full_name), ''), 'Unknown writer') AS display_name,
         p.avatar_url
    FROM public.profiles p
   WHERE p.id = ANY(_user_ids)
     AND (
       p.id = auth.uid()
       OR EXISTS (SELECT 1 FROM public.projects pr WHERE pr.id = _project_id AND pr.user_id = p.id)
       OR EXISTS (SELECT 1 FROM public.project_members m WHERE m.project_id = _project_id AND m.user_id = p.id AND m.status = 'active')
     );
END $$;
REVOKE ALL ON FUNCTION public.get_project_member_identities(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_project_member_identities(uuid, uuid[]) TO authenticated, service_role;
