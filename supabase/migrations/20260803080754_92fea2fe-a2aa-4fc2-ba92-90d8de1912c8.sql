-- ============ Service workflow settings (per store) ============
CREATE TABLE public.service_workflow_settings (
  store_id uuid PRIMARY KEY REFERENCES public.stores(id) ON DELETE CASCADE,
  enabled_stages text[] NOT NULL DEFAULT ARRAY['request_submitted','pending_review','confirmed','in_progress','completed','closed'],
  default_revisions int NOT NULL DEFAULT 0,
  allow_cancel boolean NOT NULL DEFAULT true,
  cancel_window_hours int NOT NULL DEFAULT 24,
  response_time text,
  support_channels jsonb NOT NULL DEFAULT '{"whatsapp":true,"messenger":false,"email":true,"phone":true,"live_chat":false}'::jsonb,
  support_whatsapp text,
  support_messenger text,
  support_email text,
  support_phone text,
  allow_reviews boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_workflow_settings TO authenticated;
GRANT ALL ON public.service_workflow_settings TO service_role;
ALTER TABLE public.service_workflow_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages service workflow settings" ON public.service_workflow_settings
  FOR ALL TO authenticated USING (public.is_store_owner(store_id)) WITH CHECK (public.is_store_owner(store_id));
CREATE TRIGGER trg_sws_touch BEFORE UPDATE ON public.service_workflow_settings
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- ============ Progress / timeline ============
CREATE TABLE public.service_order_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  stage text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sop_order ON public.service_order_progress(order_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_order_progress TO authenticated;
GRANT ALL ON public.service_order_progress TO service_role;
ALTER TABLE public.service_order_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages service progress" ON public.service_order_progress
  FOR ALL TO authenticated USING (public.is_store_owner(store_id)) WITH CHECK (public.is_store_owner(store_id));

-- ============ Meetings ============
CREATE TABLE public.service_order_meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  duration_minutes int,
  timezone text,
  platform text NOT NULL DEFAULT 'google_meet',
  meeting_link text,
  office_address text,
  passcode text,
  notes text,
  status text NOT NULL DEFAULT 'scheduled',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_som_order ON public.service_order_meetings(order_id, starts_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_order_meetings TO authenticated;
GRANT ALL ON public.service_order_meetings TO service_role;
ALTER TABLE public.service_order_meetings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages service meetings" ON public.service_order_meetings
  FOR ALL TO authenticated USING (public.is_store_owner(store_id)) WITH CHECK (public.is_store_owner(store_id));
CREATE TRIGGER trg_som_touch BEFORE UPDATE ON public.service_order_meetings
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- ============ Assignment ============
CREATE TABLE public.service_order_assignments (
  order_id uuid PRIMARY KEY REFERENCES public.orders(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  role text NOT NULL DEFAULT 'staff',
  avatar_url text,
  whatsapp text,
  messenger text,
  email text,
  phone text,
  response_time text,
  last_reply_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_order_assignments TO authenticated;
GRANT ALL ON public.service_order_assignments TO service_role;
ALTER TABLE public.service_order_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages service assignments" ON public.service_order_assignments
  FOR ALL TO authenticated USING (public.is_store_owner(store_id)) WITH CHECK (public.is_store_owner(store_id));
CREATE TRIGGER trg_soa_touch BEFORE UPDATE ON public.service_order_assignments
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- ============ Admin updates ============
CREATE TABLE public.service_order_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  status_label text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sou_order ON public.service_order_updates(order_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_order_updates TO authenticated;
GRANT ALL ON public.service_order_updates TO service_role;
ALTER TABLE public.service_order_updates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages service updates" ON public.service_order_updates
  FOR ALL TO authenticated USING (public.is_store_owner(store_id)) WITH CHECK (public.is_store_owner(store_id));

-- ============ Deliverables ============
CREATE TABLE public.service_order_deliverables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'file',
  title text NOT NULL,
  path text,
  file_name text,
  mime_type text,
  size_bytes bigint,
  secret_value text,
  external_url text,
  expires_at timestamptz,
  download_limit int,
  download_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sod_order ON public.service_order_deliverables(order_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_order_deliverables TO authenticated;
GRANT ALL ON public.service_order_deliverables TO service_role;
ALTER TABLE public.service_order_deliverables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages service deliverables" ON public.service_order_deliverables
  FOR ALL TO authenticated USING (public.is_store_owner(store_id)) WITH CHECK (public.is_store_owner(store_id));
CREATE TRIGGER trg_sod_touch BEFORE UPDATE ON public.service_order_deliverables
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- ============ Revisions ============
CREATE TABLE public.service_order_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  request_text text NOT NULL,
  status text NOT NULL DEFAULT 'requested',
  deadline_at timestamptz,
  admin_response text,
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sor_order ON public.service_order_revisions(order_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_order_revisions TO authenticated;
GRANT ALL ON public.service_order_revisions TO service_role;
ALTER TABLE public.service_order_revisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages service revisions" ON public.service_order_revisions
  FOR ALL TO authenticated USING (public.is_store_owner(store_id)) WITH CHECK (public.is_store_owner(store_id));
CREATE TRIGGER trg_sor_touch BEFORE UPDATE ON public.service_order_revisions
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- ============ Reviews ============
CREATE TABLE public.service_order_reviews (
  order_id uuid PRIMARY KEY REFERENCES public.orders(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  rating int NOT NULL,
  review_text text,
  screenshot_path text,
  recommend boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_order_reviews TO authenticated;
GRANT ALL ON public.service_order_reviews TO service_role;
ALTER TABLE public.service_order_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads service reviews" ON public.service_order_reviews
  FOR ALL TO authenticated USING (public.is_store_owner(store_id)) WITH CHECK (public.is_store_owner(store_id));
CREATE TRIGGER trg_sorv_touch BEFORE UPDATE ON public.service_order_reviews
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- ============ Extend the public order lookup ============
CREATE OR REPLACE FUNCTION public.get_public_order(_order_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _order jsonb;
  _items jsonb;
  _timeline jsonb;
BEGIN
  SELECT to_jsonb(o)
    INTO _order
    FROM (
      SELECT id, customer_name, phone, email, company, country, address, area,
             payment_method, txn_id, subtotal, delivery_amount, discount_amount,
             status, created_at, store_id, invoice_no, notes,
             payment_status, payment_gateway_name,
             order_type, confirmation_status, confirmed_at, fulfillment_meta,
             courier_name, courier_code, courier_tracking_id,
             courier_status, courier_last_synced_at
        FROM public.orders
       WHERE id = _order_id
       LIMIT 1
    ) o;

  IF _order IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'product_id', product_id,
           'name_snapshot', name_snapshot,
           'price_snapshot', price_snapshot,
           'qty', qty
         )), '[]'::jsonb)
    INTO _items
    FROM public.order_items
   WHERE order_id = _order_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'stage', stage,
           'note', note,
           'created_at', created_at
         ) ORDER BY created_at), '[]'::jsonb)
    INTO _timeline
    FROM public.order_timeline
   WHERE order_id = _order_id;

  RETURN _order || jsonb_build_object('items', _items, 'timeline', _timeline);
END $function$;

-- ============ Shopper-facing service order bundle ============
CREATE OR REPLACE FUNCTION public.get_public_service_order(_order_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _o record;
  _settings jsonb;
BEGIN
  SELECT id, store_id, order_type, status, fulfillment_meta
    INTO _o FROM public.orders WHERE id = _order_id LIMIT 1;
  IF _o.id IS NULL OR COALESCE(_o.order_type,'physical') <> 'service' THEN
    RETURN NULL;
  END IF;

  SELECT to_jsonb(w) INTO _settings
    FROM public.service_workflow_settings w WHERE w.store_id = _o.store_id;

  RETURN jsonb_build_object(
    'settings', _settings,
    'progress', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('stage', stage, 'note', note, 'created_at', created_at) ORDER BY created_at)
        FROM public.service_order_progress WHERE order_id = _order_id), '[]'::jsonb),
    'meetings', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', id, 'starts_at', starts_at, 'duration_minutes', duration_minutes,
        'timezone', timezone, 'platform', platform, 'meeting_link', meeting_link,
        'office_address', office_address, 'passcode', passcode, 'notes', notes, 'status', status
      ) ORDER BY starts_at)
        FROM public.service_order_meetings WHERE order_id = _order_id AND status <> 'cancelled'), '[]'::jsonb),
    'assignment', (
      SELECT jsonb_build_object(
        'name', name, 'role', role, 'avatar_url', avatar_url,
        'whatsapp', whatsapp, 'messenger', messenger, 'email', email, 'phone', phone,
        'response_time', response_time, 'last_reply_at', last_reply_at
      ) FROM public.service_order_assignments WHERE order_id = _order_id),
    'updates', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('status_label', status_label, 'note', note, 'created_at', created_at) ORDER BY created_at DESC)
        FROM public.service_order_updates WHERE order_id = _order_id), '[]'::jsonb),
    'deliverables', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', id, 'kind', kind, 'title', title, 'file_name', file_name,
        'size_bytes', size_bytes, 'external_url', external_url,
        'has_secret', secret_value IS NOT NULL,
        'expires_at', expires_at, 'download_limit', download_limit, 'download_count', download_count
      ) ORDER BY created_at)
        FROM public.service_order_deliverables WHERE order_id = _order_id), '[]'::jsonb),
    'revisions', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', id, 'request_text', request_text, 'status', status,
        'deadline_at', deadline_at, 'admin_response', admin_response,
        'responded_at', responded_at, 'created_at', created_at
      ) ORDER BY created_at)
        FROM public.service_order_revisions WHERE order_id = _order_id), '[]'::jsonb),
    'review', (
      SELECT jsonb_build_object('rating', rating, 'review_text', review_text, 'recommend', recommend, 'created_at', created_at)
        FROM public.service_order_reviews WHERE order_id = _order_id),
    'files', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', id, 'file_name', file_name, 'size_bytes', size_bytes) ORDER BY created_at)
        FROM public.service_order_files WHERE order_id = _order_id), '[]'::jsonb)
  );
END $function$;

REVOKE ALL ON FUNCTION public.get_public_service_order(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_service_order(uuid) TO anon, authenticated, service_role;