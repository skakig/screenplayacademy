
REVOKE EXECUTE ON FUNCTION public.accept_character_candidate(uuid, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.restore_quarantined_character(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_character_candidate(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_quarantined_character(uuid) TO authenticated;
