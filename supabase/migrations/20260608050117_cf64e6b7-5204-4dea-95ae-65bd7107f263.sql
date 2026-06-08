
DROP POLICY IF EXISTS "Coach recs: owner all" ON public.coach_recommendations;
CREATE POLICY "Coach recs: owner all" ON public.coach_recommendations
  FOR ALL
  USING (owns_project(project_id) AND auth.uid() = user_id)
  WITH CHECK (owns_project(project_id) AND auth.uid() = user_id);

DROP POLICY IF EXISTS "Step versions: owner all" ON public.guided_step_versions;
CREATE POLICY "Step versions: owner all" ON public.guided_step_versions
  FOR ALL
  USING (owns_project(project_id) AND auth.uid() = user_id)
  WITH CHECK (owns_project(project_id) AND auth.uid() = user_id);
