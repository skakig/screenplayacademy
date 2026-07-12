
CREATE POLICY "world_entities_project_member_select" ON public.world_entities
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.project_world_usage pwu
    WHERE pwu.entity_id = world_entities.id
      AND public.is_project_member(pwu.project_id)
  )
);

CREATE POLICY "world_entity_relationships_project_member_select" ON public.world_entity_relationships
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.project_world_usage pwu
    WHERE public.is_project_member(pwu.project_id)
      AND (pwu.entity_id = world_entity_relationships.from_entity_id
        OR pwu.entity_id = world_entity_relationships.to_entity_id)
  )
);

CREATE POLICY "world_entity_links_project_member_select" ON public.world_entity_links
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.project_world_usage pwu
    WHERE pwu.entity_id = world_entity_links.entity_id
      AND public.is_project_member(pwu.project_id)
  )
);
