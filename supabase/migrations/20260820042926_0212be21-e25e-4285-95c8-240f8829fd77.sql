CREATE TABLE public.whatsapp_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL UNIQUE REFERENCES public.stores(id) ON DELETE CASCADE,
  phone_number_id text,
  waba_id text,
  phone_number text,
  display_name text,
  quality_rating text,
  access_token_encrypted text,
  app_secret_encrypted text,
  verify_token text NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  status text NOT NULL DEFAULT 'not_connected',
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  ai_auto_reply boolean NOT NULL DEFAULT true,
  human_takeover boolean NOT NULL DEFAULT true,
  conversation_history boolean NOT NULL DEFAULT true,
  order_detection boolean NOT NULL DEFAULT true,
  product_recommendation boolean NOT NULL DEFAULT true,
  faq_reply boolean NOT NULL DEFAULT true,
  connected_at timestamptz,
  last_verified_at timestamptz,
  last_error text,
  delivery_failures integer NOT NULL DEFAULT 0,
  last_webhook_at timestamptz,
  last_webhook_type text,
  last_webhook_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_whatsapp_integrations_phone_number_id ON public.whatsapp_integrations(phone_number_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_integrations TO authenticated;
GRANT ALL ON public.whatsapp_integrations TO service_role;
ALTER TABLE public.whatsapp_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wa_integrations_owner_all" ON public.whatsapp_integrations
  FOR ALL TO authenticated
  USING (public.is_store_owner(store_id))
  WITH CHECK (public.is_store_owner(store_id));
CREATE TRIGGER trg_whatsapp_integrations_updated_at
  BEFORE UPDATE ON public.whatsapp_integrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.whatsapp_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  template_id text,
  name text NOT NULL,
  language text NOT NULL DEFAULT 'en',
  category text,
  status text NOT NULL DEFAULT 'PENDING',
  body_preview text,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, name, language)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_templates TO authenticated;
GRANT ALL ON public.whatsapp_templates TO service_role;
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wa_templates_owner_all" ON public.whatsapp_templates
  FOR ALL TO authenticated
  USING (public.is_store_owner(store_id))
  WITH CHECK (public.is_store_owner(store_id));
CREATE TRIGGER trg_whatsapp_templates_updated_at
  BEFORE UPDATE ON public.whatsapp_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.whatsapp_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE,
  phone_number_id text,
  event_type text NOT NULL,
  external_id text,
  payload jsonb,
  error text,
  received_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_wa_webhook_events_store ON public.whatsapp_webhook_events(store_id, received_at DESC);
CREATE UNIQUE INDEX idx_wa_webhook_events_ext ON public.whatsapp_webhook_events(external_id) WHERE external_id IS NOT NULL;
GRANT SELECT ON public.whatsapp_webhook_events TO authenticated;
GRANT ALL ON public.whatsapp_webhook_events TO service_role;
ALTER TABLE public.whatsapp_webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wa_webhook_events_owner_read" ON public.whatsapp_webhook_events
  FOR SELECT TO authenticated
  USING (store_id IS NOT NULL AND public.is_store_owner(store_id));