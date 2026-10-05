DROP POLICY IF EXISTS "voice_audio_owner_select" ON storage.objects;
CREATE POLICY "voice_audio_owner_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'voice-audio' AND public.is_store_owner(((storage.foldername(name))[1])::uuid));