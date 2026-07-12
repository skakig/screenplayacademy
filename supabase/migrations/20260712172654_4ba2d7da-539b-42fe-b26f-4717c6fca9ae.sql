-- Make fail-closed intent explicit on character_merges and user_roles: no
-- INSERT/UPDATE/DELETE policies for the authenticated/anon roles. Writes stay
-- restricted to the service_role path (which bypasses RLS). Add explicit deny
-- policies so any future accidental permissive policy cannot silently open
-- writes without an explicit removal of these blocks.

-- character_merges: block client writes explicitly. Reads remain via existing
-- merges_member_select policy.
DROP POLICY IF EXISTS "merges_no_client_insert" ON public.character_merges;
DROP POLICY IF EXISTS "merges_no_client_update" ON public.character_merges;
DROP POLICY IF EXISTS "merges_no_client_delete" ON public.character_merges;
CREATE POLICY "merges_no_client_insert" ON public.character_merges
  FOR INSERT TO authenticated, anon WITH CHECK (false);
CREATE POLICY "merges_no_client_update" ON public.character_merges
  FOR UPDATE TO authenticated, anon USING (false) WITH CHECK (false);
CREATE POLICY "merges_no_client_delete" ON public.character_merges
  FOR DELETE TO authenticated, anon USING (false);

-- user_roles: block client-side privilege escalation explicitly. Reads remain
-- via existing "read own roles" policy; role assignment must happen via
-- service_role (server-side admin path) only.
DROP POLICY IF EXISTS "user_roles_no_client_insert" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_no_client_update" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_no_client_delete" ON public.user_roles;
CREATE POLICY "user_roles_no_client_insert" ON public.user_roles
  FOR INSERT TO authenticated, anon WITH CHECK (false);
CREATE POLICY "user_roles_no_client_update" ON public.user_roles
  FOR UPDATE TO authenticated, anon USING (false) WITH CHECK (false);
CREATE POLICY "user_roles_no_client_delete" ON public.user_roles
  FOR DELETE TO authenticated, anon USING (false);