CREATE TABLE public.service_checkout_settings (
  store_id uuid PRIMARY KEY REFERENCES public.stores(id) ON DELETE CASCADE,
  customer_fields jsonb NOT NULL DEFAULT '{"company":true,"website":true,"business_name":false,"country":true,"language":false}'::jsonb,
  payment_methods jsonb NOT NULL DEFAULT '[]'::jsonb,
  default_payment_method text,
  payment_mode text NOT NULL DEFAULT 'full',
  min_advance_percent integer NOT NULL DEFAULT 50,
  terms jsonb NOT NULL DEFAULT '{"terms":true,"refund":true,"service":true,"privacy":true}'::jsonb,
  upload_max_mb integer NOT NULL DEFAULT 10,
  upload_max_files integer NOT NULL DEFAULT 5,
  upload_allowed_types text[] NOT NULL DEFAULT ARRAY['jpg','jpeg','png','webp','pdf','zip','doc','docx','xls','xlsx','mp4'],
  auto_confirm boolean NOT NULL DEFAULT false,
  auto_invoice boolean NOT NULL DEFAULT true,
  notify_email boolean NOT NULL DEFAULT true,
  notify_sms boolean NOT NULL DEFAULT false,
  notify_whatsapp boolean NOT NULL DEFAULT false,
  thank_you_message text,
  staff_notes text,
  order_tags text[] NOT NULL DEFAULT '{}',
  communication_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT service_payment_mode_chk CHECK (payment_mode IN ('full','advance','advance_required'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_checkout_settings TO authenticated;
GRANT ALL ON public.service_checkout_settings TO service_role;
ALTER TABLE public.service_checkout_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage their service checkout settings" ON public.service_checkout_settings
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.owner_user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.owner_user_id = auth.uid()));

CREATE TABLE public.service_intake_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  label text NOT NULL,
  field_key text NOT NULL,
  field_type text NOT NULL DEFAULT 'short_text',
  options text[] NOT NULL DEFAULT '{}',
  placeholder text,
  help_text text,
  is_required boolean NOT NULL DEFAULT false,
  is_visible boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, field_key),
  CONSTRAINT service_intake_type_chk CHECK (field_type IN ('short_text','long_text','dropdown','radio','checkbox','date','url','number','file','files'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_intake_fields TO authenticated;
GRANT ALL ON public.service_intake_fields TO service_role;
ALTER TABLE public.service_intake_fields ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage their service intake fields" ON public.service_intake_fields
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.owner_user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.owner_user_id = auth.uid()));

CREATE TABLE public.service_order_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  upload_token text,
  path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  size_bytes bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX service_order_files_order_idx ON public.service_order_files(order_id);
CREATE INDEX service_order_files_token_idx ON public.service_order_files(upload_token);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_order_files TO authenticated;
GRANT ALL ON public.service_order_files TO service_role;
ALTER TABLE public.service_order_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read their service order files" ON public.service_order_files
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.owner_user_id = auth.uid()));