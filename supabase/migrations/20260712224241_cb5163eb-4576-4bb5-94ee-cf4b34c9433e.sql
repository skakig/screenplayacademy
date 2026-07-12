
CREATE TABLE public.world_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  universe_id UUID NOT NULL REFERENCES public.story_universes(id) ON DELETE CASCADE,
  entity_kind TEXT NOT NULL CHECK (entity_kind IN (
    'location','faction','artifact','rule','event','thread','timeline_entry','character','custom'
  )),
  name TEXT NOT NULL,
  normalized_key TEXT NOT NULL,
  summary TEXT,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','imported')),
  candidate_id UUID REFERENCES public.import_candidates(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (universe_id, entity_kind, normalized_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.world_entities TO authenticated;
GRANT ALL ON public.world_entities TO service_role;
ALTER TABLE public.world_entities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "world_entities_owner_all" ON public.world_entities FOR ALL
  USING (EXISTS (SELECT 1 FROM public.story_universes u WHERE u.id = universe_id AND u.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.story_universes u WHERE u.id = universe_id AND u.owner_id = auth.uid()));
CREATE INDEX idx_world_entities_universe ON public.world_entities(universe_id);
CREATE INDEX idx_world_entities_kind ON public.world_entities(universe_id, entity_kind);
CREATE TRIGGER trg_world_entities_updated BEFORE UPDATE ON public.world_entities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.world_entity_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES public.world_entities(id) ON DELETE CASCADE,
  target_table TEXT NOT NULL CHECK (target_table IN (
    'world_locations','world_factions','world_artifacts','world_rules',
    'world_events','world_threads','world_timeline_entries','characters'
  )),
  target_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (target_table, target_id),
  UNIQUE (entity_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.world_entity_links TO authenticated;
GRANT ALL ON public.world_entity_links TO service_role;
ALTER TABLE public.world_entity_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "world_entity_links_owner_all" ON public.world_entity_links FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.world_entities e
      JOIN public.story_universes u ON u.id = e.universe_id
     WHERE e.id = entity_id AND u.owner_id = auth.uid()))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.world_entities e
      JOIN public.story_universes u ON u.id = e.universe_id
     WHERE e.id = entity_id AND u.owner_id = auth.uid()));
CREATE INDEX idx_world_entity_links_entity ON public.world_entity_links(entity_id);
CREATE INDEX idx_world_entity_links_target ON public.world_entity_links(target_table, target_id);

CREATE TABLE public.world_entity_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  universe_id UUID NOT NULL REFERENCES public.story_universes(id) ON DELETE CASCADE,
  from_entity_id UUID NOT NULL REFERENCES public.world_entities(id) ON DELETE CASCADE,
  to_entity_id UUID NOT NULL REFERENCES public.world_entities(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL CHECK (relationship_type IN (
    'located_in','member_of','ally_of','enemy_of','owns','occurred_at',
    'references','related_to','parent_of','child_of','custom'
  )),
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (from_entity_id, to_entity_id, relationship_type),
  CHECK (from_entity_id <> to_entity_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.world_entity_relationships TO authenticated;
GRANT ALL ON public.world_entity_relationships TO service_role;
ALTER TABLE public.world_entity_relationships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "world_entity_relationships_owner_all" ON public.world_entity_relationships FOR ALL
  USING (EXISTS (SELECT 1 FROM public.story_universes u WHERE u.id = universe_id AND u.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.story_universes u WHERE u.id = universe_id AND u.owner_id = auth.uid()));
CREATE INDEX idx_world_rel_from ON public.world_entity_relationships(from_entity_id);
CREATE INDEX idx_world_rel_to ON public.world_entity_relationships(to_entity_id);
CREATE INDEX idx_world_rel_universe_type ON public.world_entity_relationships(universe_id, relationship_type);
CREATE TRIGGER trg_world_entity_relationships_updated BEFORE UPDATE ON public.world_entity_relationships
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.project_world_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  entity_id UUID NOT NULL REFERENCES public.world_entities(id) ON DELETE CASCADE,
  scene_id UUID REFERENCES public.scenes(id) ON DELETE SET NULL,
  script_block_id UUID REFERENCES public.script_blocks(id) ON DELETE SET NULL,
  usage_kind TEXT NOT NULL DEFAULT 'reference' CHECK (usage_kind IN (
    'setting','mention','appearance','reference'
  )),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX project_world_usage_unique
  ON public.project_world_usage(
    project_id, entity_id,
    COALESCE(scene_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(script_block_id, '00000000-0000-0000-0000-000000000000'::uuid),
    usage_kind
  );
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_world_usage TO authenticated;
GRANT ALL ON public.project_world_usage TO service_role;
ALTER TABLE public.project_world_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "project_world_usage_member_all" ON public.project_world_usage FOR ALL
  USING (public.is_project_member(project_id))
  WITH CHECK (public.is_project_member(project_id));
CREATE INDEX idx_project_world_usage_project ON public.project_world_usage(project_id);
CREATE INDEX idx_project_world_usage_entity ON public.project_world_usage(entity_id);
CREATE INDEX idx_project_world_usage_scene ON public.project_world_usage(scene_id);
CREATE TRIGGER trg_project_world_usage_updated BEFORE UPDATE ON public.project_world_usage
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Backfill
INSERT INTO public.world_entities (id, universe_id, entity_kind, name, normalized_key, summary, source, candidate_id, metadata)
SELECT l.id, l.universe_id, 'location', l.name, l.normalized_key, l.description,
       CASE WHEN l.candidate_id IS NULL THEN 'manual' ELSE 'imported' END, l.candidate_id, l.metadata
  FROM public.world_locations l ON CONFLICT (id) DO NOTHING;
INSERT INTO public.world_entities (id, universe_id, entity_kind, name, normalized_key, summary, source, candidate_id, metadata)
SELECT f.id, f.universe_id, 'faction', f.name, f.normalized_key, f.description,
       CASE WHEN f.candidate_id IS NULL THEN 'manual' ELSE 'imported' END, f.candidate_id, f.metadata
  FROM public.world_factions f ON CONFLICT (id) DO NOTHING;
INSERT INTO public.world_entities (id, universe_id, entity_kind, name, normalized_key, summary, source, candidate_id, metadata)
SELECT a.id, a.universe_id, 'artifact', a.name, a.normalized_key, a.description,
       CASE WHEN a.candidate_id IS NULL THEN 'manual' ELSE 'imported' END, a.candidate_id, a.metadata
  FROM public.world_artifacts a ON CONFLICT (id) DO NOTHING;
INSERT INTO public.world_entities (id, universe_id, entity_kind, name, normalized_key, summary, source, candidate_id, metadata)
SELECT r.id, r.universe_id, 'rule', r.name, r.normalized_key, r.statement,
       CASE WHEN r.candidate_id IS NULL THEN 'manual' ELSE 'imported' END, r.candidate_id, r.metadata
  FROM public.world_rules r ON CONFLICT (id) DO NOTHING;
INSERT INTO public.world_entities (id, universe_id, entity_kind, name, normalized_key, summary, source, candidate_id, metadata)
SELECT ev.id, ev.universe_id, 'event', ev.name, ev.normalized_key, ev.summary,
       CASE WHEN ev.candidate_id IS NULL THEN 'manual' ELSE 'imported' END, ev.candidate_id, ev.metadata
  FROM public.world_events ev ON CONFLICT (id) DO NOTHING;
INSERT INTO public.world_entities (id, universe_id, entity_kind, name, normalized_key, summary, source, candidate_id, metadata)
SELECT t.id, t.universe_id, 'thread', t.name, t.normalized_key, t.question,
       CASE WHEN t.candidate_id IS NULL THEN 'manual' ELSE 'imported' END, t.candidate_id, t.metadata
  FROM public.world_threads t ON CONFLICT (id) DO NOTHING;

-- Timeline: normalized_key includes id fragment to guarantee uniqueness per universe.
INSERT INTO public.world_entities (id, universe_id, entity_kind, name, normalized_key, summary, source, candidate_id, metadata)
SELECT te.id, te.universe_id, 'timeline_entry', te.label,
       lower(regexp_replace(coalesce(te.label,''), '[^a-zA-Z0-9]+', ' ', 'g')) || ':' || substr(te.id::text, 1, 8),
       te.when_hint,
       CASE WHEN te.candidate_id IS NULL THEN 'manual' ELSE 'imported' END, te.candidate_id, te.metadata
  FROM public.world_timeline_entries te ON CONFLICT (id) DO NOTHING;

-- Characters: normalized_key includes character id fragment so cross-project name collisions still land.
INSERT INTO public.world_entities (id, universe_id, entity_kind, name, normalized_key, summary, source, candidate_id, metadata)
SELECT c.id, p.default_universe_id, 'character', c.name,
       lower(regexp_replace(coalesce(c.name,''), '[^a-zA-Z0-9]+', ' ', 'g')) || ':' || substr(c.id::text, 1, 8),
       NULLIF(c.story_function, ''),
       'manual', NULL, '{}'::jsonb
  FROM public.characters c
  JOIN public.projects p ON p.id = c.project_id
 WHERE c.quarantined_at IS NULL
   AND p.default_universe_id IS NOT NULL
ON CONFLICT (id) DO NOTHING;

-- Links
INSERT INTO public.world_entity_links (entity_id, target_table, target_id) SELECT id, 'world_locations', id FROM public.world_locations ON CONFLICT DO NOTHING;
INSERT INTO public.world_entity_links (entity_id, target_table, target_id) SELECT id, 'world_factions', id FROM public.world_factions ON CONFLICT DO NOTHING;
INSERT INTO public.world_entity_links (entity_id, target_table, target_id) SELECT id, 'world_artifacts', id FROM public.world_artifacts ON CONFLICT DO NOTHING;
INSERT INTO public.world_entity_links (entity_id, target_table, target_id) SELECT id, 'world_rules', id FROM public.world_rules ON CONFLICT DO NOTHING;
INSERT INTO public.world_entity_links (entity_id, target_table, target_id) SELECT id, 'world_events', id FROM public.world_events ON CONFLICT DO NOTHING;
INSERT INTO public.world_entity_links (entity_id, target_table, target_id) SELECT id, 'world_threads', id FROM public.world_threads ON CONFLICT DO NOTHING;
INSERT INTO public.world_entity_links (entity_id, target_table, target_id) SELECT id, 'world_timeline_entries', id FROM public.world_timeline_entries ON CONFLICT DO NOTHING;
INSERT INTO public.world_entity_links (entity_id, target_table, target_id)
SELECT c.id, 'characters', c.id
  FROM public.characters c JOIN public.projects p ON p.id = c.project_id
 WHERE c.quarantined_at IS NULL AND p.default_universe_id IS NOT NULL
ON CONFLICT DO NOTHING;
