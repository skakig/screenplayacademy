
CREATE POLICY "Users read own voice previews"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'voice-previews' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users write own voice previews"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'voice-previews' AND auth.uid()::text = (storage.foldername(name))[1]);
