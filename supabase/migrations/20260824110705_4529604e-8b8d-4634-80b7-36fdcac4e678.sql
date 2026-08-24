ALTER TABLE public.facebook_page_integrations
  ADD COLUMN IF NOT EXISTS verify_token text,
  ADD COLUMN IF NOT EXISTS last_webhook_at timestamptz,
  ADD COLUMN IF NOT EXISTS webhook_enabled boolean NOT NULL DEFAULT true;

UPDATE public.facebook_page_integrations
  SET verify_token = encode(gen_random_bytes(16), 'hex')
  WHERE verify_token IS NULL;

CREATE TABLE IF NOT EXISTS public.facebook_moderation_queue (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  comment_id text not null,
  author_id text,
  author_name text,
  message text,
  action text not null,
  reason text,
  suggestion text,
  category text,
  status text not null default 'pending',
  error text,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, comment_id, action)
);
CREATE INDEX IF NOT EXISTS facebook_moderation_queue_store_idx
  ON public.facebook_moderation_queue(store_id, status, created_at desc);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.facebook_moderation_queue TO authenticated;
GRANT ALL ON public.facebook_moderation_queue TO service_role;
ALTER TABLE public.facebook_moderation_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fb_moderation_owner_all" ON public.facebook_moderation_queue
  FOR ALL TO authenticated USING (public.is_store_owner(store_id)) WITH CHECK (public.is_store_owner(store_id));
CREATE TRIGGER fb_moderation_touch BEFORE UPDATE ON public.facebook_moderation_queue
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();