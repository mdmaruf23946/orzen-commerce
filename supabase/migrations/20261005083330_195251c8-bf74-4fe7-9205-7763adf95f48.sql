ALTER TABLE public.voice_call_queue ADD COLUMN IF NOT EXISTS cancel_reason text;
ALTER TABLE public.voice_automation_settings ALTER COLUMN business_hours_only SET DEFAULT true;
ALTER TABLE public.voice_automation_settings ALTER COLUMN hours_to SET DEFAULT '22:00';

CREATE OR REPLACE FUNCTION public.tg_cancel_voice_queue_on_order()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.voice_call_queue SET status='cancelled', cancel_reason='Order deleted'
      WHERE order_id = OLD.id AND status='queued';
    RETURN OLD;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status <> 'pending' THEN
    UPDATE public.voice_call_queue SET status='cancelled',
      cancel_reason = CASE NEW.status::text WHEN 'confirmed' THEN 'Order confirmed'
        WHEN 'cancelled' THEN 'Order cancelled' ELSE 'Status changed to ' || NEW.status::text END
      WHERE order_id = NEW.id AND status='queued';
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.tg_cancel_voice_queue_on_order() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS t_orders_cancel_voice_queue ON public.orders;
CREATE TRIGGER t_orders_cancel_voice_queue AFTER UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.tg_cancel_voice_queue_on_order();
DROP TRIGGER IF EXISTS t_orders_cancel_voice_queue_del ON public.orders;
CREATE TRIGGER t_orders_cancel_voice_queue_del BEFORE DELETE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.tg_cancel_voice_queue_on_order();