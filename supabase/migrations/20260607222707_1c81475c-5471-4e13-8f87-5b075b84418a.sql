
CREATE POLICY "storyboards owner all" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'storyboards' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'storyboards' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "table-reads owner all" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'table-reads' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'table-reads' AND auth.uid()::text = (storage.foldername(name))[1]);
