
-- Phase 5 — ITS Knowledge Map + Writer Understanding State
-- Doctrine: docs/ITS_PfHU_Importation.md §6.9, §6.10, §Phase 5

CREATE TABLE public.series_knowledge_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  universe_id UUID NOT NULL REFERENCES public.story_universes(id) ON DELETE CASCADE,
  concept_type TEXT NOT NULL CHECK (concept_type IN (
    'character_belief','character_secret','character_wound','character_lie',
    'world_rule','world_state','relationship_state','plot_thread',
    'timeline_fact','public_vs_private','other'
  )),
  entity_kind TEXT CHECK (entity_kind IN (
    'character','world_event','world_location','world_faction',
    'world_artifact','world_rule','world_thread','none'
  )),
  entity_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
  title TEXT NOT NULL,
  explanation TEXT NOT NULL DEFAULT '',
  importance TEXT NOT NULL DEFAULT 'normal' CHECK (importance IN ('critical','high','normal','low')),
  role_relevance TEXT[] NOT NULL DEFAULT ARRAY['writer']::text[],
  current_status TEXT NOT NULL DEFAULT 'active' CHECK (current_status IN ('active','resolved','retconned','superseded')),
  normalized_key TEXT NOT NULL,
  extractor TEXT NOT NULL DEFAULT 'manual',
  extractor_version TEXT NOT NULL DEFAULT '1.0.0',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (universe_id, normalized_key)
);
CREATE INDEX idx_series_knowledge_nodes_universe ON public.series_knowledge_nodes(universe_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.series_knowledge_nodes TO authenticated;
GRANT ALL ON public.series_knowledge_nodes TO service_role;
ALTER TABLE public.series_knowledge_nodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Universe owners manage knowledge nodes"
  ON public.series_knowledge_nodes FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.story_universes u WHERE u.id = universe_id AND u.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.story_universes u WHERE u.id = universe_id AND u.owner_id = auth.uid()));
CREATE TRIGGER trg_series_knowledge_nodes_updated_at
  BEFORE UPDATE ON public.series_knowledge_nodes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Edges linking a node to its cited evidence (segments).
CREATE TABLE public.series_knowledge_node_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id UUID NOT NULL REFERENCES public.series_knowledge_nodes(id) ON DELETE CASCADE,
  evidence_id UUID REFERENCES public.import_evidence(id) ON DELETE SET NULL,
  segment_id UUID REFERENCES public.source_segments(id) ON DELETE SET NULL,
  excerpt TEXT NOT NULL DEFAULT '',
  confidence NUMERIC NOT NULL DEFAULT 0.5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (node_id, evidence_id),
  UNIQUE (node_id, segment_id)
);
CREATE INDEX idx_sk_node_evidence_node ON public.series_knowledge_node_evidence(node_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.series_knowledge_node_evidence TO authenticated;
GRANT ALL ON public.series_knowledge_node_evidence TO service_role;
ALTER TABLE public.series_knowledge_node_evidence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage node evidence"
  ON public.series_knowledge_node_evidence FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.series_knowledge_nodes n
      JOIN public.story_universes u ON u.id = n.universe_id
     WHERE n.id = node_id AND u.owner_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.series_knowledge_nodes n
      JOIN public.story_universes u ON u.id = n.universe_id
     WHERE n.id = node_id AND u.owner_id = auth.uid()
  ));

-- Prerequisite edges: understanding B requires first understanding A.
CREATE TABLE public.series_knowledge_prerequisites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id UUID NOT NULL REFERENCES public.series_knowledge_nodes(id) ON DELETE CASCADE,
  prerequisite_node_id UUID NOT NULL REFERENCES public.series_knowledge_nodes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (node_id, prerequisite_node_id),
  CHECK (node_id <> prerequisite_node_id)
);
CREATE INDEX idx_sk_prereq_node ON public.series_knowledge_prerequisites(node_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.series_knowledge_prerequisites TO authenticated;
GRANT ALL ON public.series_knowledge_prerequisites TO service_role;
ALTER TABLE public.series_knowledge_prerequisites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage node prerequisites"
  ON public.series_knowledge_prerequisites FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.series_knowledge_nodes n
      JOIN public.story_universes u ON u.id = n.universe_id
     WHERE n.id = node_id AND u.owner_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.series_knowledge_nodes n
      JOIN public.story_universes u ON u.id = n.universe_id
     WHERE n.id = node_id AND u.owner_id = auth.uid()
  ));

-- Per-writer understanding state (§6.10).
CREATE TABLE public.writer_knowledge_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  universe_id UUID NOT NULL REFERENCES public.story_universes(id) ON DELETE CASCADE,
  knowledge_node_id UUID NOT NULL REFERENCES public.series_knowledge_nodes(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'unseen' CHECK (status IN (
    'unseen','introduced','understood','uncertain','contradicted','mastered'
  )),
  evidence_of_understanding JSONB NOT NULL DEFAULT '{}'::jsonb,
  confidence NUMERIC NOT NULL DEFAULT 0.0,
  preferred_presentation TEXT NOT NULL DEFAULT 'evidence_first',
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, knowledge_node_id)
);
CREATE INDEX idx_writer_knowledge_state_user_universe
  ON public.writer_knowledge_state(user_id, universe_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.writer_knowledge_state TO authenticated;
GRANT ALL ON public.writer_knowledge_state TO service_role;
ALTER TABLE public.writer_knowledge_state ENABLE ROW LEVEL SECURITY;
-- Writers see + manage only their own state; the universe still must be theirs.
CREATE POLICY "Writers manage their own knowledge state"
  ON public.writer_knowledge_state FOR ALL TO authenticated
  USING (user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.story_universes u WHERE u.id = universe_id AND u.owner_id = auth.uid()))
  WITH CHECK (user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.story_universes u WHERE u.id = universe_id AND u.owner_id = auth.uid()));
CREATE TRIGGER trg_writer_knowledge_state_updated_at
  BEFORE UPDATE ON public.writer_knowledge_state
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
