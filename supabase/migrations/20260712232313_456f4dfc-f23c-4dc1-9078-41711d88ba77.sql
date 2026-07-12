
-- Helper: can the current user edit a universe (as owner, or as an editor member
-- of any project whose default_universe_id is this universe)?
CREATE OR REPLACE FUNCTION public.can_edit_universe(_universe_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.story_universes u
     WHERE u.id = _universe_id AND u.owner_id = auth.uid()
  ) OR EXISTS (
    SELECT 1
      FROM public.projects p
     WHERE p.default_universe_id = _universe_id
       AND public.can_edit_project(p.id)
  );
$$;

REVOKE ALL ON FUNCTION public.can_edit_universe(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_edit_universe(uuid) TO authenticated, service_role;

-- world_entities: allow project editors to insert/update/delete entities in universes
-- their project uses as its default universe.
DROP POLICY IF EXISTS world_entities_project_editor_insert ON public.world_entities;
DROP POLICY IF EXISTS world_entities_project_editor_update ON public.world_entities;
DROP POLICY IF EXISTS world_entities_project_editor_delete ON public.world_entities;

CREATE POLICY world_entities_project_editor_insert
  ON public.world_entities FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_universe(universe_id));

CREATE POLICY world_entities_project_editor_update
  ON public.world_entities FOR UPDATE TO authenticated
  USING (public.can_edit_universe(universe_id))
  WITH CHECK (public.can_edit_universe(universe_id));

CREATE POLICY world_entities_project_editor_delete
  ON public.world_entities FOR DELETE TO authenticated
  USING (public.can_edit_universe(universe_id));

-- world_entity_relationships: same treatment.
DROP POLICY IF EXISTS world_entity_relationships_project_editor_insert ON public.world_entity_relationships;
DROP POLICY IF EXISTS world_entity_relationships_project_editor_update ON public.world_entity_relationships;
DROP POLICY IF EXISTS world_entity_relationships_project_editor_delete ON public.world_entity_relationships;

CREATE POLICY world_entity_relationships_project_editor_insert
  ON public.world_entity_relationships FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_universe(universe_id));

CREATE POLICY world_entity_relationships_project_editor_update
  ON public.world_entity_relationships FOR UPDATE TO authenticated
  USING (public.can_edit_universe(universe_id))
  WITH CHECK (public.can_edit_universe(universe_id));

CREATE POLICY world_entity_relationships_project_editor_delete
  ON public.world_entity_relationships FOR DELETE TO authenticated
  USING (public.can_edit_universe(universe_id));

-- world_entity_links: gate through the linked entity's universe.
DROP POLICY IF EXISTS world_entity_links_project_editor_insert ON public.world_entity_links;
DROP POLICY IF EXISTS world_entity_links_project_editor_update ON public.world_entity_links;
DROP POLICY IF EXISTS world_entity_links_project_editor_delete ON public.world_entity_links;

CREATE POLICY world_entity_links_project_editor_insert
  ON public.world_entity_links FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.world_entities e
     WHERE e.id = world_entity_links.entity_id
       AND public.can_edit_universe(e.universe_id)
  ));

CREATE POLICY world_entity_links_project_editor_update
  ON public.world_entity_links FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.world_entities e
     WHERE e.id = world_entity_links.entity_id
       AND public.can_edit_universe(e.universe_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.world_entities e
     WHERE e.id = world_entity_links.entity_id
       AND public.can_edit_universe(e.universe_id)
  ));

CREATE POLICY world_entity_links_project_editor_delete
  ON public.world_entity_links FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.world_entities e
     WHERE e.id = world_entity_links.entity_id
       AND public.can_edit_universe(e.universe_id)
  ));
