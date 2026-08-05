CREATE TABLE public.store_invoice_profile (
  store_id uuid PRIMARY KEY REFERENCES public.stores(id) ON DELETE CASCADE,
  business_name text,
  owner_name text,
  business_address text,
  phone text,
  email text,
  website text,
  trade_license text,
  bin_vat text,
  logo_url text,
  signature_url text,
  seal_url text,
  thank_you_message text,
  terms text,
  refund_policy text,
  show_logo boolean NOT NULL DEFAULT true,
  show_signature boolean NOT NULL DEFAULT false,
  show_seal boolean NOT NULL DEFAULT false,
  show_terms boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_invoice_profile TO authenticated;
GRANT ALL ON public.store_invoice_profile TO service_role;

ALTER TABLE public.store_invoice_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store owners manage their invoice profile"
ON public.store_invoice_profile FOR ALL
TO authenticated
USING (public.is_store_owner(store_id))
WITH CHECK (public.is_store_owner(store_id));

CREATE TRIGGER trg_store_invoice_profile_updated_at
BEFORE UPDATE ON public.store_invoice_profile
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();