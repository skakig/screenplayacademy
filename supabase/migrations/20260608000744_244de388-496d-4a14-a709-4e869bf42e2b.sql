
-- user_onboarding
CREATE TABLE public.user_onboarding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  writer_experience_level text,
  preferred_mode text NOT NULL DEFAULT 'studio',
  coaching_level text NOT NULL DEFAULT 'gentle',
  app_walkthrough_completed boolean NOT NULL DEFAULT false,
  first_project_created boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_onboarding TO authenticated;
GRANT ALL ON public.user_onboarding TO service_role;
ALTER TABLE public.user_onboarding ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Onboarding: own all" ON public.user_onboarding FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_user_onboarding_updated BEFORE UPDATE ON public.user_onboarding FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- academy_modules
CREATE TABLE public.academy_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  order_index integer NOT NULL DEFAULT 0,
  estimated_minutes integer NOT NULL DEFAULT 10,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.academy_modules TO authenticated;
GRANT ALL ON public.academy_modules TO service_role;
ALTER TABLE public.academy_modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Modules: read all authenticated" ON public.academy_modules FOR SELECT TO authenticated USING (true);

-- academy_lessons
CREATE TABLE public.academy_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES public.academy_modules(id) ON DELETE CASCADE,
  title text NOT NULL,
  slug text NOT NULL,
  concept text,
  why_it_matters text,
  example text,
  task_prompt text,
  ai_button_label text,
  order_index integer NOT NULL DEFAULT 0,
  estimated_minutes integer NOT NULL DEFAULT 5,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (module_id, slug)
);
GRANT SELECT ON public.academy_lessons TO authenticated;
GRANT ALL ON public.academy_lessons TO service_role;
ALTER TABLE public.academy_lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lessons: read all authenticated" ON public.academy_lessons FOR SELECT TO authenticated USING (true);

-- user_lesson_progress
CREATE TABLE public.user_lesson_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  lesson_id uuid NOT NULL REFERENCES public.academy_lessons(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'not_started',
  user_output text,
  saved_output_id uuid,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, lesson_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_lesson_progress TO authenticated;
GRANT ALL ON public.user_lesson_progress TO service_role;
ALTER TABLE public.user_lesson_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lesson progress: own all" ON public.user_lesson_progress FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_user_lesson_progress_updated BEFORE UPDATE ON public.user_lesson_progress FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- project_guided_steps
CREATE TABLE public.project_guided_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  user_id uuid NOT NULL,
  step_key text NOT NULL,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'locked',
  output_type text,
  output_reference_id uuid,
  user_output text,
  order_index integer NOT NULL DEFAULT 0,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, step_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_guided_steps TO authenticated;
GRANT ALL ON public.project_guided_steps TO service_role;
ALTER TABLE public.project_guided_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Guided steps: owner all" ON public.project_guided_steps FOR ALL USING (public.owns_project(project_id)) WITH CHECK (public.owns_project(project_id));
CREATE TRIGGER trg_project_guided_steps_updated BEFORE UPDATE ON public.project_guided_steps FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed modules
INSERT INTO public.academy_modules (title, slug, description, order_index, estimated_minutes) VALUES
  ('Start Here', 'start-here', 'Get your bearings and learn how SceneSmith helps you write.', 1, 10),
  ('Screenplay Foundations', 'foundations', 'Format, structure, and the language of screenplays.', 2, 30),
  ('Story Architecture', 'story-architecture', 'Loglines, theme, arcs, and the shape of a feature.', 3, 45),
  ('Character Creation', 'character-creation', 'Wants, needs, wounds, lies, and TMH moral pressure.', 4, 40),
  ('Scene Craft', 'scene-craft', 'Scene purpose, turn, conflict, and visual writing.', 5, 35),
  ('Dialogue', 'dialogue', 'Voice, subtext, silence, and rhythm.', 6, 25),
  ('Rewriting', 'rewriting', 'Diagnose weak scenes and tighten your draft.', 7, 30),
  ('Pitching', 'pitching', 'Loglines, synopses, comparables, and the pitch package.', 8, 25);

-- Seed starter lessons in Start Here + Foundations
INSERT INTO public.academy_lessons (module_id, title, slug, concept, why_it_matters, example, task_prompt, ai_button_label, order_index, estimated_minutes)
SELECT m.id, x.title, x.slug, x.concept, x.why_it_matters, x.example, x.task_prompt, x.ai_button_label, x.order_index, x.estimated_minutes
FROM (VALUES
  ('start-here', 'Welcome to SceneSmith', 'welcome', 'SceneSmith is both a professional screenplay editor and a school for writing your first screenplay.', 'Knowing the two modes helps you choose how much guidance you want as you write.', 'Beginners often pick Guided Mode. Veterans head straight to Studio Mode.', 'Pick the mode you want to start in. You can switch anytime from Settings.', NULL, 1, 5),
  ('start-here', 'The Three Layers of a Screenplay', 'three-layers', 'Every screenplay has three layers: the script on the page, the story arc, and the character arc.', 'Most writing software only helps the page. SceneSmith helps all three so your story stays alive.', 'A scene can look right on the page but be flat because nothing changes for the character.', 'Write one sentence about what changes in your favourite movie scene.', NULL, 2, 5),
  ('foundations', 'Create Your Logline', 'logline', 'A logline is a one-sentence summary of your story. It usually names a protagonist, goal, obstacle, stakes, and hook.', 'A clear logline tells you what your story is really about before you write dozens of pages.', 'When a disgraced detective discovers a murder tied to his own buried lie, he must expose the truth before the killer turns his secret into the next crime scene.', 'Write your rough idea in one messy paragraph. We will sharpen it together.', 'Generate 5 logline options', 1, 10)
) AS x(module_slug, title, slug, concept, why_it_matters, example, task_prompt, ai_button_label, order_index, estimated_minutes)
JOIN public.academy_modules m ON m.slug = x.module_slug;
