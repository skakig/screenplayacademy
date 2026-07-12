REVOKE EXECUTE ON FUNCTION public.get_usage_snapshot(text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_usage_snapshot(text) TO authenticated, service_role;