
-- Advertisement Management System
CREATE TABLE public.ad_settings (
  id text PRIMARY KEY DEFAULT 'global' CHECK (id = 'global'),
  enabled boolean NOT NULL DEFAULT false,
  provider text NOT NULL DEFAULT 'adsterra',
  show_on_plans text[] NOT NULL DEFAULT ARRAY['free']::text[],
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

CREATE TABLE public.ad_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  provider text NOT NULL DEFAULT 'adsterra',
  code text NOT NULL DEFAULT '',
  format text NOT NULL DEFAULT 'responsive',
  is_active boolean NOT NULL DEFAULT true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- GRANTs: only owner (via server functions) writes; reads happen through RPC
GRANT SELECT ON public.ad_settings TO authenticated;
GRANT ALL ON public.ad_settings TO service_role;
GRANT SELECT ON public.ad_slots TO authenticated;
GRANT ALL ON public.ad_slots TO service_role;

ALTER TABLE public.ad_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_slots ENABLE ROW LEVEL SECURITY;

-- Owner-only management via has_role
CREATE POLICY "Owners manage ad_settings"
  ON public.ad_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Owners manage ad_slots"
  ON public.ad_slots FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'owner'));

-- Authenticated store admins may SELECT (needed only if they read directly).
-- Public data path is the RPC below, so keep SELECT restricted to owner:
-- (No additional select policy — non-owners get [] from RPC.)

-- Update trigger
CREATE TRIGGER trg_ad_slots_touch BEFORE UPDATE ON public.ad_slots
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
CREATE TRIGGER trg_ad_settings_touch BEFORE UPDATE ON public.ad_settings
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- Seed singleton
INSERT INTO public.ad_settings (id) VALUES ('global') ON CONFLICT DO NOTHING;

-- RPC: returns active ads for the caller's store, gated by plan and schedule.
CREATE OR REPLACE FUNCTION public.get_my_active_ads()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s record;
  tier text;
  result jsonb;
BEGIN
  SELECT * INTO s FROM public.ad_settings WHERE id = 'global';
  IF s IS NULL OR NOT s.enabled THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT COALESCE(sp.plan_tier, 'free') INTO tier
    FROM public.stores st
    LEFT JOIN public.subscription_packages sp ON sp.id = st.package_id
   WHERE st.owner_user_id = auth.uid()
   LIMIT 1;

  IF tier IS NULL OR NOT (tier = ANY(s.show_on_plans)) THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'slot_key', slot_key, 'code', code, 'format', format
  )), '[]'::jsonb)
    INTO result
    FROM public.ad_slots
   WHERE is_active = true
     AND (starts_at IS NULL OR starts_at <= now())
     AND (ends_at IS NULL OR ends_at > now());

  RETURN result;
END $$;

GRANT EXECUTE ON FUNCTION public.get_my_active_ads() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_my_active_ads() FROM anon, public;
