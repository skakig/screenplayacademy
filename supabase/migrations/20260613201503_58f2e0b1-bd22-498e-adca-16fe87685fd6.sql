CREATE OR REPLACE FUNCTION public.accept_project_invite(_token text)
RETURNS TABLE(project_id uuid, status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_hash text;
  v_invite public.project_invites%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN QUERY SELECT NULL::uuid, 'unauthenticated'::text;
    RETURN;
  END IF;

  v_hash := encode(extensions.digest(_token, 'sha256'), 'hex');

  SELECT * INTO v_invite FROM public.project_invites
    WHERE token_hash = v_hash
    LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::uuid, 'invalid'::text;
    RETURN;
  END IF;

  IF v_invite.status <> 'pending' THEN
    RETURN QUERY SELECT v_invite.project_id, v_invite.status;
    RETURN;
  END IF;

  IF v_invite.expires_at IS NOT NULL AND v_invite.expires_at < now() THEN
    UPDATE public.project_invites SET status = 'expired' WHERE id = v_invite.id;
    RETURN QUERY SELECT v_invite.project_id, 'expired'::text;
    RETURN;
  END IF;

  IF lower(v_invite.email) <> v_email OR v_email = '' THEN
    RETURN QUERY SELECT v_invite.project_id, 'email_mismatch'::text;
    RETURN;
  END IF;

  INSERT INTO public.project_members
    (project_id, user_id, role, status, invited_by, joined_at)
  VALUES
    (v_invite.project_id, v_uid, v_invite.role, 'active', v_invite.invited_by, now())
  ON CONFLICT (project_id, user_id) DO UPDATE
    SET role = EXCLUDED.role,
        status = 'active',
        joined_at = COALESCE(public.project_members.joined_at, now());

  UPDATE public.project_invites
     SET status = 'accepted',
         accepted_by = v_uid,
         accepted_at = now()
   WHERE id = v_invite.id;

  RETURN QUERY SELECT v_invite.project_id, 'accepted'::text;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.accept_project_invite(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_project_invite(text) TO authenticated;