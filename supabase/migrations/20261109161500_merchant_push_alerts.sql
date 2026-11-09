-- Merchant push: human handoff, out of stock, courier delivered/returned
CREATE OR REPLACE FUNCTION public.tg_push_handoff() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE ch text;
BEGIN
  IF NEW.store_id IS NULL OR NEW.handoff_mode IS DISTINCT FROM 'human' OR OLD.handoff_mode IS NOT DISTINCT FROM 'human' THEN RETURN NEW; END IF;
  -- Merchant's own takeover needs no alert.
  IF coalesce(NEW.handoff_reason,'') IN ('admin_takeover','manual','') THEN RETURN NEW; END IF;
  IF NOT EXISTS (SELECT 1 FROM push_subscriptions WHERE store_id = NEW.store_id) THEN RETURN NEW; END IF;
  ch := CASE NEW.channel WHEN 'whatsapp' THEN 'WhatsApp' WHEN 'messenger' THEN 'Messenger' WHEN 'web' THEN 'Web Chat' WHEN 'instagram' THEN 'Instagram' ELSE coalesce(NEW.channel,'Chat') END;
  INSERT INTO push_outbox (store_id, kind, title, body, url, tag)
  VALUES (NEW.store_id, 'message', '🚨 কাস্টমারের সহায়তা প্রয়োজন · ' || ch,
    coalesce(nullif(NEW.customer_name,''),'কাস্টমার') || ' — ' ||
      CASE WHEN NEW.handoff_reason LIKE 'auto_spam:%' THEN 'AI সাময়িক বন্ধ, আপনার দেখা দরকার' ELSE left(coalesce(NEW.handoff_reason,'মানুষের সাথে কথা বলতে চান'),100) END,
    '/admin/omni-inbox', 'handoff-' || NEW.id);
  PERFORM push_wake();
  RETURN NEW;
EXCEPTION WHEN others THEN RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS t_push_handoff ON public.ai_conversations;
CREATE TRIGGER t_push_handoff AFTER UPDATE OF handoff_mode ON public.ai_conversations FOR EACH ROW EXECUTE FUNCTION public.tg_push_handoff();

CREATE OR REPLACE FUNCTION public.tg_push_out_of_stock() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.stock IS NULL OR NEW.stock > 0 OR coalesce(OLD.stock,0) <= 0 THEN RETURN NEW; END IF;
  IF NOT EXISTS (SELECT 1 FROM push_subscriptions WHERE store_id = NEW.store_id) THEN RETURN NEW; END IF;
  INSERT INTO push_outbox (store_id, kind, title, body, url, tag)
  VALUES (NEW.store_id, 'order', '📦 পণ্যের স্টক শেষ', left(coalesce(NEW.name,'একটি পণ্য'),100) || ' — এখনই স্টক আপডেট করুন', '/admin/products', 'stock-' || NEW.id);
  PERFORM push_wake();
  RETURN NEW;
EXCEPTION WHEN others THEN RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS t_push_out_of_stock ON public.products;
CREATE TRIGGER t_push_out_of_stock AFTER UPDATE OF stock ON public.products FOR EACH ROW EXECUTE FUNCTION public.tg_push_out_of_stock();

CREATE OR REPLACE FUNCTION public.tg_push_courier_status() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s text := lower(coalesce(NEW.status,'')); o record; t text; b text;
BEGIN
  IF s = lower(coalesce(OLD.status,'')) OR NEW.order_id IS NULL THEN RETURN NEW; END IF;
  IF s LIKE '%partial%' THEN t := '⚠️ আংশিক ডেলিভারি'; b := 'কিছু পণ্য ফেরত এসেছে';
  ELSIF s LIKE '%deliver%' AND s NOT LIKE '%pending%' AND s NOT LIKE '%out_for%' AND s NOT LIKE '%in_%' THEN t := '✅ পার্সেল ডেলিভারি সম্পন্ন'; b := 'কাস্টমার পার্সেল নিয়েছেন';
  ELSIF s LIKE '%return%' OR s LIKE '%cancel%' THEN t := '⚠️ পার্সেল রিটার্ন হয়েছে'; b := 'কাস্টমার পার্সেল নেননি';
  ELSE RETURN NEW; END IF;
  IF NOT EXISTS (SELECT 1 FROM push_subscriptions WHERE store_id = NEW.store_id) THEN RETURN NEW; END IF;
  SELECT customer_name, invoice_no INTO o FROM orders WHERE id = NEW.order_id;
  INSERT INTO push_outbox (store_id, kind, title, body, url, tag)
  VALUES (NEW.store_id, 'order', t || coalesce(' · #' || o.invoice_no, ''), coalesce(o.customer_name,'কাস্টমার') || ' — ' || b,
    '/admin/orders/' || NEW.order_id, 'courier-' || NEW.id || '-' || s);
  PERFORM push_wake();
  RETURN NEW;
EXCEPTION WHEN others THEN RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS t_push_courier_status ON public.courier_parcels;
CREATE TRIGGER t_push_courier_status AFTER UPDATE OF status ON public.courier_parcels FOR EACH ROW EXECUTE FUNCTION public.tg_push_courier_status();
REVOKE EXECUTE ON FUNCTION public.tg_push_handoff(), public.tg_push_out_of_stock(), public.tg_push_courier_status() FROM PUBLIC, anon, authenticated;
