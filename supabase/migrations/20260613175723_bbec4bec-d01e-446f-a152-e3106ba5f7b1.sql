
REVOKE EXECUTE ON FUNCTION public.is_project_member(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.project_role(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_edit_project(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_project_member(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.project_role(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_edit_project(UUID) TO authenticated, service_role;
