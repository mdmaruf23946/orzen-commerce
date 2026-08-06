ALTER TABLE public.store_return_settings
  ADD COLUMN IF NOT EXISTS return_shipping_mode text NOT NULL DEFAULT 'customer',
  ADD COLUMN IF NOT EXISTS return_split_customer numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS return_split_store numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS replacement_shipping_mode text NOT NULL DEFAULT 'store',
  ADD COLUMN IF NOT EXISTS replacement_split_customer numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS replacement_split_store numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS exchange_rules jsonb NOT NULL DEFAULT '{"same_variant":true,"different_variant":true,"different_product":true,"higher_price":true,"lower_price":true,"equal_price":true}'::jsonb,
  ADD COLUMN IF NOT EXISTS replacement_source text NOT NULL DEFAULT 'cart',
  ADD COLUMN IF NOT EXISTS customer_pays_difference boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS refund_direction text NOT NULL DEFAULT 'refund_bank',
  ADD COLUMN IF NOT EXISTS require_admin_approval boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS require_photo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS require_courier_tracking boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS exchange_window_days integer NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS auto_workflow jsonb NOT NULL DEFAULT '{"return_courier":false,"replacement_order":false,"reserve_stock":false,"update_inventory":true,"notify_customer":true,"sync_tracking":false}'::jsonb;

ALTER TABLE public.returns
  ADD COLUMN IF NOT EXISTS use_global_settings boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.get_public_return_settings(_store_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'enabled', COALESCE(s.enabled, true),
    'eligibility_days', COALESCE(s.eligibility_days, 7),
    'exchange_window_days', COALESCE(s.exchange_window_days, 7),
    'allow_return', COALESCE(s.allow_return, true),
    'allow_exchange_same', COALESCE(s.allow_exchange_same, true),
    'allow_exchange_other', COALESCE(s.allow_exchange_other, true),
    'return_shipping_payer', COALESCE(s.return_shipping_payer, 'customer'),
    'return_shipping_charge', COALESCE(s.return_shipping_charge, 0),
    'replacement_shipping_payer', COALESCE(s.replacement_shipping_payer, 'store'),
    'replacement_shipping_charge', COALESCE(s.replacement_shipping_charge, 0),
    'return_shipping_mode', COALESCE(s.return_shipping_mode, 'customer'),
    'return_split_customer', COALESCE(s.return_split_customer, 0),
    'return_split_store', COALESCE(s.return_split_store, 0),
    'replacement_shipping_mode', COALESCE(s.replacement_shipping_mode, 'store'),
    'replacement_split_customer', COALESCE(s.replacement_split_customer, 0),
    'replacement_split_store', COALESCE(s.replacement_split_store, 0),
    'restocking_fee_type', COALESCE(s.restocking_fee_type, 'none'),
    'restocking_fee_value', COALESCE(s.restocking_fee_value, 0),
    'exchange_rules', COALESCE(s.exchange_rules, '{"same_variant":true,"different_variant":true,"different_product":true,"higher_price":true,"lower_price":true,"equal_price":true}'::jsonb),
    'replacement_source', COALESCE(s.replacement_source, 'cart'),
    'customer_pays_difference', COALESCE(s.customer_pays_difference, true),
    'refund_direction', COALESCE(s.refund_direction, 'refund_bank'),
    'refund_methods', COALESCE(s.refund_methods, ARRAY[]::text[]),
    'require_photo', COALESCE(s.require_photo, false),
    'policy_note', s.policy_note
  )
  FROM public.stores st
  LEFT JOIN public.store_return_settings s ON s.store_id = st.id
  WHERE st.id = _store_id AND st.status = 'active'
  LIMIT 1;
$function$;