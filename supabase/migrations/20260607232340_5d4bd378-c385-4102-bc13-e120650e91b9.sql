
-- Story arcs (one per project)
CREATE TABLE public.story_arcs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL UNIQUE,
  arc_type text,
  structure_model text,
  central_question text,
  theme text,
  opening_state text,
  midpoint_shift text,
  darkest_moment text,
  climax_choice text,
  final_state text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.story_arcs TO authenticated;
GRANT ALL ON public.story_arcs TO service_role;
ALTER TABLE public.story_arcs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Story arcs: owner all" ON public.story_arcs FOR ALL
  USING (public.owns_project(project_id)) WITH CHECK (public.owns_project(project_id));
CREATE TRIGGER story_arcs_updated BEFORE UPDATE ON public.story_arcs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Character arcs (one per character)
CREATE TABLE public.character_arcs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  character_id uuid NOT NULL UNIQUE,
  arc_type text,
  starting_belief text,
  ending_belief text,
  core_lie text,
  truth_learned text,
  starting_tmh_level int CHECK (starting_tmh_level BETWEEN 1 AND 9),
  midpoint_tmh_level int CHECK (midpoint_tmh_level BETWEEN 1 AND 9),
  ending_tmh_level int CHECK (ending_tmh_level BETWEEN 1 AND 9),
  regression_level int CHECK (regression_level BETWEEN 1 AND 9),
  temptation text,
  moral_test text,
  climax_choice text,
  final_image text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.character_arcs TO authenticated;
GRANT ALL ON public.character_arcs TO service_role;
ALTER TABLE public.character_arcs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Character arcs: owner all" ON public.character_arcs FOR ALL
  USING (public.owns_project(project_id)) WITH CHECK (public.owns_project(project_id));
CREATE TRIGGER character_arcs_updated BEFORE UPDATE ON public.character_arcs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Scene arc beats (one per scene)
CREATE TABLE public.scene_arc_beats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  scene_id uuid NOT NULL UNIQUE,
  act text,
  sequence_name text,
  story_beat text,
  scene_purpose text,
  external_plot_change text,
  relationship_change text,
  moral_pressure text,
  theme_connection text,
  stakes_change text,
  scene_turn text,
  question_raised text,
  question_answered text,
  emotional_charge int CHECK (emotional_charge BETWEEN 1 AND 10),
  scene_strength_score int CHECK (scene_strength_score BETWEEN 0 AND 100),
  arc_status text DEFAULT 'unreviewed',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scene_arc_beats TO authenticated;
GRANT ALL ON public.scene_arc_beats TO service_role;
ALTER TABLE public.scene_arc_beats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Scene arcs: owner all" ON public.scene_arc_beats FOR ALL
  USING (public.owns_project(project_id)) WITH CHECK (public.owns_project(project_id));
CREATE TRIGGER scene_arc_beats_updated BEFORE UPDATE ON public.scene_arc_beats FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Character scene arc states (one per scene x character)
CREATE TABLE public.character_scene_arc_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  scene_id uuid NOT NULL,
  character_id uuid NOT NULL,
  goal_in_scene text,
  need_in_scene text,
  lie_believed text,
  tactic text,
  emotional_state_start text,
  emotional_state_end text,
  tmh_start_level int CHECK (tmh_start_level BETWEEN 1 AND 9),
  tmh_end_level int CHECK (tmh_end_level BETWEEN 1 AND 9),
  arc_movement text,
  cost text,
  revelation text,
  relationship_shift text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scene_id, character_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.character_scene_arc_states TO authenticated;
GRANT ALL ON public.character_scene_arc_states TO service_role;
ALTER TABLE public.character_scene_arc_states ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Char scene arc states: owner all" ON public.character_scene_arc_states FOR ALL
  USING (public.owns_project(project_id)) WITH CHECK (public.owns_project(project_id));
CREATE TRIGGER char_scene_arc_states_updated BEFORE UPDATE ON public.character_scene_arc_states FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
