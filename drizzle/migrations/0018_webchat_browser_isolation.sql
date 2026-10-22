ALTER TABLE public.ai_conversations ADD COLUMN IF NOT EXISTS web_access_hash text;
ALTER TABLE public.ai_conversations ADD COLUMN IF NOT EXISTS web_customer_id uuid;
ALTER TABLE public.ai_conversations ADD COLUMN IF NOT EXISTS web_client jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS ai_conversations_web_customer_idx ON public.ai_conversations (store_id, web_customer_id) WHERE web_customer_id IS NOT NULL;