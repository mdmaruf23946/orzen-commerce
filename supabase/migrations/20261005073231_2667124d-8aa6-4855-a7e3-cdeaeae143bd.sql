ALTER TABLE public.voice_automation_settings
  ADD COLUMN IF NOT EXISTS tts_template text,
  ADD COLUMN IF NOT EXISTS confirm_text text,
  ADD COLUMN IF NOT EXISTS cancel_text text,
  ADD COLUMN IF NOT EXISTS main_audio_url text,
  ADD COLUMN IF NOT EXISTS confirm_audio_url text,
  ADD COLUMN IF NOT EXISTS cancel_audio_url text,
  ADD COLUMN IF NOT EXISTS press2_action text NOT NULL DEFAULT 'cancel',
  ADD COLUMN IF NOT EXISTS sms_on_confirm boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS retry_on_no_answer boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS retry_on_no_keypress boolean NOT NULL DEFAULT true;
ALTER TABLE public.voice_automation_settings DROP CONSTRAINT IF EXISTS voice_automation_press2_check;
ALTER TABLE public.voice_automation_settings ADD CONSTRAINT voice_automation_press2_check CHECK (press2_action IN ('cancel','forward'));
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS voice_verification text;
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_voice_verification_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_voice_verification_check CHECK (voice_verification IS NULL OR voice_verification IN ('verified','cancelled','needs_agent','unanswered'));
CREATE INDEX IF NOT EXISTS orders_store_voice_verification_idx ON public.orders (store_id, voice_verification) WHERE voice_verification IS NOT NULL;
DROP POLICY IF EXISTS "voice_audio_owner_insert" ON storage.objects;
DROP POLICY IF EXISTS "voice_audio_owner_delete" ON storage.objects;
DROP POLICY IF EXISTS "voice_audio_owner_update" ON storage.objects;
CREATE POLICY "voice_audio_owner_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'voice-audio' AND public.is_store_owner(((storage.foldername(name))[1])::uuid) AND lower(name) LIKE '%.mp3');
CREATE POLICY "voice_audio_owner_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'voice-audio' AND public.is_store_owner(((storage.foldername(name))[1])::uuid));
CREATE POLICY "voice_audio_owner_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'voice-audio' AND public.is_store_owner(((storage.foldername(name))[1])::uuid));