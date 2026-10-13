CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.orzen_call_post(_store uuid, _event text, _flag text, _data jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE c record; body text;
BEGIN
  SELECT account_info, encrypted_token INTO c FROM public.voice_provider_connections
   WHERE store_id = _store AND provider = 'orzen_call' AND status = 'connected';
  IF NOT FOUND OR coalesce(c.account_info->>'webhook_url','') = '' OR coalesce((c.account_info->>_flag)::boolean, true) = false THEN RETURN; END IF;
  body := jsonb_build_object('event', _event, 'store_id', _store, 'sent_at', now(), 'data', _data)::text;
  PERFORM net.http_post(
    url := c.account_info->>'webhook_url',
    body := body::jsonb,
    headers := jsonb_build_object('Content-Type','application/json','X-Orzen-Event',_event,
      'X-Orzen-Signature', encode(extensions.hmac(body, coalesce(c.encrypted_token,''), 'sha256'),'hex')),
    timeout_milliseconds := 8000);
EXCEPTION WHEN others THEN RETURN; -- never block orders/products
END $$;
REVOKE ALL ON FUNCTION public.orzen_call_post(uuid,text,text,jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.tg_orzen_call_order() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF coalesce(NEW.is_test,false) THEN RETURN NULL; END IF;
  PERFORM public.orzen_call_post(NEW.store_id, 'order.created', 'auto_orders', jsonb_build_object(
    'order_id', NEW.id, 'invoice_no', NEW.invoice_no, 'status', NEW.status,
    'customer_name', NEW.customer_name, 'phone', NEW.phone, 'address', NEW.address, 'area', NEW.area,
    'payment_method', NEW.payment_method, 'delivery_amount', NEW.delivery_amount,
    'discount_amount', NEW.discount_amount, 'total', NEW.subtotal, 'notes', NEW.notes, 'created_at', NEW.created_at,
    'items', coalesce((SELECT jsonb_agg(to_jsonb(oi) - 'store_id') FROM public.order_items oi WHERE oi.order_id = NEW.id), '[]'::jsonb)));
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS t_orzen_call_order ON public.orders;
CREATE CONSTRAINT TRIGGER t_orzen_call_order AFTER INSERT ON public.orders
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.tg_orzen_call_order();

CREATE OR REPLACE FUNCTION public.tg_orzen_call_product() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.name, NEW.price, NEW.old_price, NEW.description, NEW.short_description, NEW.status, NEW.stock, NEW.variants, NEW.primary_image_url)
     IS NOT DISTINCT FROM (OLD.name, OLD.price, OLD.old_price, OLD.description, OLD.short_description, OLD.status, OLD.stock, OLD.variants, OLD.primary_image_url) THEN
    RETURN NULL;
  END IF;
  PERFORM public.orzen_call_post(NEW.store_id, 'products.sync', 'auto_products', jsonb_build_object(
    'action', lower(TG_OP), 'products', jsonb_build_array(jsonb_build_object(
      'id', NEW.id, 'name', NEW.name, 'sku', NEW.sku, 'price', NEW.price, 'old_price', NEW.old_price,
      'stock', NEW.stock, 'status', NEW.status, 'short_description', NEW.short_description,
      'description', left(coalesce(NEW.description,''), 4000), 'variants', NEW.variants,
      'image', NEW.primary_image_url, 'slug', NEW.slug))));
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS t_orzen_call_product ON public.products;
CREATE TRIGGER t_orzen_call_product AFTER INSERT OR UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.tg_orzen_call_product();