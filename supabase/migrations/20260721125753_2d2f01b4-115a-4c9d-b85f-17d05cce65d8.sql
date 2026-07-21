
ALTER TABLE public.messenger_integrations
  ADD COLUMN IF NOT EXISTS page_name text,
  ADD COLUMN IF NOT EXISTS page_picture_url text,
  ADD COLUMN IF NOT EXISTS app_id text,
  ADD COLUMN IF NOT EXISTS app_secret_encrypted text,
  ADD COLUMN IF NOT EXISTS page_access_token_encrypted text,
  ADD COLUMN IF NOT EXISTS token_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS permissions jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS last_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS delivery_failures integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_auto_reply boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS human_takeover boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS conversation_history boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS order_detection boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS product_recommendation boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS faq_reply boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.get_messenger_daily_stats(_store_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _msgs_today bigint := 0;
  _failed bigint := 0;
  _last_in timestamptz;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.stores WHERE id = _store_id AND owner_user_id = auth.uid()) THEN
    RETURN jsonb_build_object('messages_today', 0, 'failed_today', 0, 'last_incoming_at', NULL);
  END IF;

  SELECT COUNT(*)
    INTO _msgs_today
    FROM public.ai_messages m
    JOIN public.ai_conversations c ON c.id = m.conversation_id
   WHERE c.store_id = _store_id
     AND c.channel = 'messenger'
     AND m.created_at >= date_trunc('day', now());

  SELECT MAX(m.created_at)
    INTO _last_in
    FROM public.ai_messages m
    JOIN public.ai_conversations c ON c.id = m.conversation_id
   WHERE c.store_id = _store_id
     AND c.channel = 'messenger'
     AND m.role = 'user';

  SELECT COALESCE(delivery_failures, 0) INTO _failed
    FROM public.messenger_integrations WHERE store_id = _store_id;

  RETURN jsonb_build_object(
    'messages_today', _msgs_today,
    'failed_today', _failed,
    'last_incoming_at', _last_in
  );
END $$;

REVOKE ALL ON FUNCTION public.get_messenger_daily_stats(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_messenger_daily_stats(uuid) TO authenticated;
