DROP POLICY IF EXISTS "Guided steps: owner all" ON public.project_guided_steps;
CREATE POLICY "Guided steps: own rows in own project"
  ON public.project_guided_steps
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id AND public.owns_project(project_id))
  WITH CHECK (auth.uid() = user_id AND public.owns_project(project_id));