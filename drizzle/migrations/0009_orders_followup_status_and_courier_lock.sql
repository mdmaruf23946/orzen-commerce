ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS followup_status text;
DO $$ BEGIN
  ALTER TABLE public.orders ADD CONSTRAINT orders_followup_status_chk
    CHECK (followup_status IS NULL OR followup_status IN ('incomplete','no_response','on_hold'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS status_source text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS status_changed_at timestamptz;
CREATE INDEX IF NOT EXISTS orders_store_followup_idx ON public.orders(store_id, followup_status) WHERE followup_status IS NOT NULL;

CREATE OR REPLACE FUNCTION public.order_courier_locked(_order uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.courier_parcels p
    WHERE p.order_id = _order
      AND p.status IN ('pickup_completed','in_transit','delivered','partial_delivered','returned','hold')
  );
$$;
GRANT EXECUTE ON FUNCTION public.order_courier_locked(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.tg_orders_status_rules()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status <> 'pending' THEN NEW.followup_status := NULL; END IF;
  IF NEW.status IS DISTINCT FROM OLD.status OR NEW.followup_status IS DISTINCT FROM OLD.followup_status THEN
    NEW.status_changed_at := now();
  END IF;
  IF coalesce(auth.role(), '') = 'authenticated'
     AND NEW.courier_last_synced_at IS NOT DISTINCT FROM OLD.courier_last_synced_at
     AND public.order_courier_locked(OLD.id)
     AND (NEW.status IS DISTINCT FROM OLD.status
       OR NEW.followup_status IS DISTINCT FROM OLD.followup_status
       OR NEW.customer_name IS DISTINCT FROM OLD.customer_name
       OR NEW.phone IS DISTINCT FROM OLD.phone
       OR NEW.address IS DISTINCT FROM OLD.address
       OR NEW.area IS DISTINCT FROM OLD.area
       OR NEW.subtotal IS DISTINCT FROM OLD.subtotal
       OR NEW.delivery_amount IS DISTINCT FROM OLD.delivery_amount) THEN
    RAISE EXCEPTION 'ORDER_LOCKED: কুরিয়ার অর্ডারটি গ্রহণ করেছে, এখন আর পরিবর্তন করা যাবে না';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS t_orders_status_rules ON public.orders;
CREATE TRIGGER t_orders_status_rules BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.tg_orders_status_rules();

CREATE OR REPLACE FUNCTION public.tg_order_items_courier_lock()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF coalesce(auth.role(), '') = 'authenticated'
     AND public.order_courier_locked(coalesce(NEW.order_id, OLD.order_id)) THEN
    RAISE EXCEPTION 'ORDER_LOCKED: কুরিয়ার অর্ডারটি গ্রহণ করেছে, পণ্য পরিবর্তন করা যাবে না';
  END IF;
  RETURN coalesce(NEW, OLD);
END $$;
DROP TRIGGER IF EXISTS t_order_items_courier_lock ON public.order_items;
CREATE TRIGGER t_order_items_courier_lock BEFORE INSERT OR UPDATE OR DELETE ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.tg_order_items_courier_lock();