
-- Phase 1: Messenger Inbox schema extensions

ALTER TABLE public.ai_conversations
  ADD COLUMN IF NOT EXISTS psid_profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS unread_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_message_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_message_preview text,
  ADD COLUMN IF NOT EXISTS handoff_mode text NOT NULL DEFAULT 'ai',
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS lead_status text,
  ADD COLUMN IF NOT EXISTS total_orders integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_spent numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS first_contact_at timestamptz NOT NULL DEFAULT now();

DO $$ BEGIN
  ALTER TABLE public.ai_conversations
    ADD CONSTRAINT ai_conversations_handoff_mode_chk CHECK (handoff_mode IN ('ai','human'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.ai_conversations
    ADD CONSTRAINT ai_conversations_lead_status_chk
    CHECK (lead_status IS NULL OR lead_status IN ('interested','pending','ready','ordered','cancelled'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS ai_conversations_store_last_msg_idx
  ON public.ai_conversations (store_id, last_message_at DESC NULLS LAST);

ALTER TABLE public.ai_messages
  ADD COLUMN IF NOT EXISTS direction text NOT NULL DEFAULT 'in',
  ADD COLUMN IF NOT EXISTS message_type text NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS mid text,
  ADD COLUMN IF NOT EXISTS delivery_status text NOT NULL DEFAULT 'sent',
  ADD COLUMN IF NOT EXISTS error text,
  ADD COLUMN IF NOT EXISTS sent_by_user_id uuid;

DO $$ BEGIN
  ALTER TABLE public.ai_messages
    ADD CONSTRAINT ai_messages_direction_chk CHECK (direction IN ('in','out','system'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.ai_messages
    ADD CONSTRAINT ai_messages_delivery_chk CHECK (delivery_status IN ('sent','delivered','read','failed','pending'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS ai_messages_conv_mid_uidx
  ON public.ai_messages (conversation_id, mid) WHERE mid IS NOT NULL;

CREATE INDEX IF NOT EXISTS ai_messages_conv_created_idx
  ON public.ai_messages (conversation_id, created_at);

-- Allow store owners to update handoff/tags/lead/unread on their conversations
DROP POLICY IF EXISTS "owners update own conversations" ON public.ai_conversations;
CREATE POLICY "owners update own conversations"
  ON public.ai_conversations
  FOR UPDATE
  TO authenticated
  USING (public.is_store_owner(store_id))
  WITH CHECK (public.is_store_owner(store_id));

-- Messenger notes
CREATE TABLE IF NOT EXISTS public.messenger_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  author_user_id uuid,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messenger_notes TO authenticated;
GRANT ALL ON public.messenger_notes TO service_role;
ALTER TABLE public.messenger_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners manage messenger notes"
  ON public.messenger_notes FOR ALL TO authenticated
  USING (public.is_store_owner(store_id))
  WITH CHECK (public.is_store_owner(store_id));
CREATE INDEX IF NOT EXISTS messenger_notes_conv_idx ON public.messenger_notes (conversation_id, created_at DESC);
CREATE TRIGGER messenger_notes_touch BEFORE UPDATE ON public.messenger_notes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Saved replies
CREATE TABLE IF NOT EXISTS public.saved_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  sort integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_replies TO authenticated;
GRANT ALL ON public.saved_replies TO service_role;
ALTER TABLE public.saved_replies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners manage saved replies"
  ON public.saved_replies FOR ALL TO authenticated
  USING (public.is_store_owner(store_id))
  WITH CHECK (public.is_store_owner(store_id));
CREATE INDEX IF NOT EXISTS saved_replies_store_idx ON public.saved_replies (store_id, sort);
CREATE TRIGGER saved_replies_touch BEFORE UPDATE ON public.saved_replies
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Realtime
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_conversations;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_messages;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
