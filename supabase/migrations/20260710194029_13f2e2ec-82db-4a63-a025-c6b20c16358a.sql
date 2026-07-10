REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_usage_snapshot(text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_usage_snapshot(text) TO authenticated, service_role;