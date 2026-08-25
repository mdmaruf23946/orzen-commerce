CREATE TABLE IF NOT EXISTS public.platform_footer (
  id text PRIMARY KEY DEFAULT 'global',
  description text,
  contact jsonb NOT NULL DEFAULT '{}'::jsonb,
  socials jsonb NOT NULL DEFAULT '[]'::jsonb,
  columns jsonb NOT NULL DEFAULT '[]'::jsonb,
  bottom_note text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.platform_footer TO anon;
GRANT SELECT ON public.platform_footer TO authenticated;
GRANT ALL ON public.platform_footer TO service_role;

ALTER TABLE public.platform_footer ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "footer readable by everyone" ON public.platform_footer;
CREATE POLICY "footer readable by everyone" ON public.platform_footer
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "owner manages footer" ON public.platform_footer;
CREATE POLICY "owner manages footer" ON public.platform_footer
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

INSERT INTO public.platform_footer (id, description, contact, socials, columns, bottom_note)
VALUES (
  'global',
  'An all-in-one eCommerce SaaS built for Bangladesh — store builder, AI sales agent, couriers, analytics and payments in one platform.',
  '{"email":"support@orzen.top","phone":"","address":"Dhaka, Bangladesh"}'::jsonb,
  '[{"platform":"facebook","url":"#"},{"platform":"linkedin","url":"#"},{"platform":"youtube","url":"#"},{"platform":"email","url":"mailto:support@orzen.top"}]'::jsonb,
  '[{"title":"Product","links":[{"label":"Features","href":"#features"},{"label":"AI","href":"#ai"}]},{"title":"Company","links":[{"label":"Blog","href":"#"},{"label":"Support","href":"#contact"},{"label":"Contact","href":"#contact"}]},{"title":"Legal","links":[{"label":"Privacy Policy","href":"/privacy-policy"},{"label":"Terms","href":"/terms"},{"label":"Refund Policy","href":"/refund-policy"}]}]'::jsonb,
  'Made with care in Dhaka.'
) ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_platform_footer()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT jsonb_build_object(
    'description', description,
    'contact', contact,
    'socials', socials,
    'columns', columns,
    'bottom_note', bottom_note
  ) FROM public.platform_footer WHERE id = 'global' LIMIT 1;
$$;

-- Security: hide internal cost/margin columns from public storefront readers
REVOKE SELECT ON public.products FROM anon;
GRANT SELECT (
  id, store_id, category_id, name, slug, description, price, old_price, stock, status,
  primary_image_url, gallery, created_at, updated_at, warranty, return_policy, shipping_info,
  sku, is_featured, meta, brand, product_code, short_description, features, specifications,
  variants, video_url, delivery_charge, delivery_time_days, rating, total_sold,
  related_product_ids, product_type
) ON public.products TO anon;