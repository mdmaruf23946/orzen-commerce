
CREATE TABLE public.seo_change_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN ('product','category','store','page')),
  entity_id text NOT NULL,
  previous_hash text,
  current_hash text NOT NULL,
  changed_fields text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review','optimized','ignored')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, entity_type, entity_id)
);
CREATE INDEX seo_change_tracking_store_status ON public.seo_change_tracking(store_id, status);

CREATE TABLE public.seo_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN ('product','category','store','page')),
  entity_id text NOT NULL,
  content_hash text,
  proposed_title text,
  proposed_description text,
  proposed_keywords text,
  reason text,
  source text NOT NULL DEFAULT 'ai_auto' CHECK (source IN ('ai_auto','manual_audit')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','applied')),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid
);
CREATE INDEX seo_recommendations_store_status ON public.seo_recommendations(store_id, status);
CREATE INDEX seo_recommendations_entity ON public.seo_recommendations(store_id, entity_type, entity_id);

CREATE TABLE public.seo_history_rollback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN ('product','category','store','page')),
  entity_id text NOT NULL,
  metadata_before jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata_after jsonb NOT NULL DEFAULT '{}'::jsonb,
  change_source text NOT NULL DEFAULT 'manual_edit' CHECK (change_source IN ('ai_apply','manual_edit','rollback')),
  applied_by uuid,
  rolled_back_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX seo_history_entity ON public.seo_history_rollback(store_id, entity_type, entity_id, created_at DESC);

GRANT SELECT, UPDATE ON public.seo_change_tracking TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.seo_recommendations TO authenticated;
GRANT SELECT ON public.seo_history_rollback TO authenticated;
GRANT ALL ON public.seo_change_tracking, public.seo_recommendations, public.seo_history_rollback TO service_role;

ALTER TABLE public.seo_change_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_history_rollback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "store members read change tracking" ON public.seo_change_tracking FOR SELECT TO authenticated USING (public.has_store_access(store_id));
CREATE POLICY "store members update change tracking" ON public.seo_change_tracking FOR UPDATE TO authenticated USING (public.has_store_access(store_id)) WITH CHECK (public.has_store_access(store_id));
CREATE POLICY "store members read recommendations" ON public.seo_recommendations FOR SELECT TO authenticated USING (public.has_store_access(store_id));
CREATE POLICY "store members insert recommendations" ON public.seo_recommendations FOR INSERT TO authenticated WITH CHECK (public.has_store_access(store_id));
CREATE POLICY "store members update recommendations" ON public.seo_recommendations FOR UPDATE TO authenticated USING (public.has_store_access(store_id)) WITH CHECK (public.has_store_access(store_id));
CREATE POLICY "store members read seo history" ON public.seo_history_rollback FOR SELECT TO authenticated USING (public.has_store_access(store_id));

-- Semantic hash: only text/price fields that matter for search. Design/layout/stock/views are ignored => zero AI calls.
CREATE OR REPLACE FUNCTION public.seo_semantic_hash(_parts text[])
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public, extensions AS $$
  SELECT encode(extensions.digest(array_to_string(
    ARRAY(SELECT lower(regexp_replace(regexp_replace(coalesce(p,''), '<[^>]*>', ' ', 'g'), '\s+', ' ', 'g')) FROM unnest(_parts) p), '|'), 'sha256'), 'hex')
$$;

CREATE OR REPLACE FUNCTION public.seo_track_change(_store uuid, _type text, _id text, _hash text, _fields text[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.seo_change_tracking(store_id, entity_type, entity_id, previous_hash, current_hash, changed_fields)
  VALUES (_store, _type, _id, NULL, _hash, _fields)
  ON CONFLICT (store_id, entity_type, entity_id) DO UPDATE
    SET previous_hash = seo_change_tracking.current_hash,
        current_hash = EXCLUDED.current_hash,
        changed_fields = EXCLUDED.changed_fields,
        status = 'pending_review',
        updated_at = now()
    WHERE seo_change_tracking.current_hash IS DISTINCT FROM EXCLUDED.current_hash;
END $$;

CREATE OR REPLACE FUNCTION public.seo_snapshot(_store uuid, _type text, _id text, _before jsonb, _after jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _src text := coalesce(nullif(current_setting('app.seo_change_source', true), ''), 'manual_edit');
BEGIN
  IF _src NOT IN ('ai_apply','manual_edit','rollback') THEN _src := 'manual_edit'; END IF;
  INSERT INTO public.seo_history_rollback(store_id, entity_type, entity_id, metadata_before, metadata_after, change_source, applied_by)
  VALUES (_store, _type, _id, coalesce(_before,'{}'::jsonb), coalesce(_after,'{}'::jsonb), _src, auth.uid());
END $$;

CREATE OR REPLACE FUNCTION public.tg_seo_products()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE h text; f text[] := '{}';
BEGIN
  h := public.seo_semantic_hash(ARRAY[NEW.name, NEW.short_description, NEW.description, NEW.price::text, NEW.old_price::text, NEW.brand, NEW.category_id::text]);
  IF TG_OP = 'UPDATE' THEN
    IF NEW.name IS DISTINCT FROM OLD.name THEN f := f || 'name'; END IF;
    IF NEW.description IS DISTINCT FROM OLD.description OR NEW.short_description IS DISTINCT FROM OLD.short_description THEN f := f || 'description'; END IF;
    IF NEW.price IS DISTINCT FROM OLD.price OR NEW.old_price IS DISTINCT FROM OLD.old_price THEN f := f || 'price'; END IF;
    IF NEW.brand IS DISTINCT FROM OLD.brand OR NEW.category_id IS DISTINCT FROM OLD.category_id THEN f := f || 'category'; END IF;
    IF coalesce(OLD.meta->'seo','{}'::jsonb) IS DISTINCT FROM coalesce(NEW.meta->'seo','{}'::jsonb) THEN
      PERFORM public.seo_snapshot(NEW.store_id, 'product', NEW.id::text, OLD.meta->'seo', NEW.meta->'seo');
    END IF;
  ELSE
    f := ARRAY['created'];
  END IF;
  PERFORM public.seo_track_change(NEW.store_id, 'product', NEW.id::text, h, f);
  RETURN NEW;
END $$;
CREATE TRIGGER t_seo_products AFTER INSERT OR UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.tg_seo_products();

CREATE OR REPLACE FUNCTION public.tg_seo_categories()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.seo_track_change(NEW.store_id, 'category', NEW.id::text,
    public.seo_semantic_hash(ARRAY[NEW.name, NEW.description]),
    CASE WHEN TG_OP = 'INSERT' THEN ARRAY['created'] ELSE ARRAY['name/description'] END);
  RETURN NEW;
END $$;
CREATE TRIGGER t_seo_categories AFTER INSERT OR UPDATE OF name, description ON public.categories FOR EACH ROW EXECUTE FUNCTION public.tg_seo_categories();

CREATE OR REPLACE FUNCTION public.tg_seo_stores()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.seo_track_change(NEW.id, 'store', NEW.id::text,
    public.seo_semantic_hash(ARRAY[NEW.name, NEW.description]),
    CASE WHEN TG_OP = 'INSERT' THEN ARRAY['created'] ELSE ARRAY['name/description'] END);
  IF TG_OP = 'UPDATE' AND coalesce(OLD.seo,'{}'::jsonb) IS DISTINCT FROM coalesce(NEW.seo,'{}'::jsonb) THEN
    PERFORM public.seo_snapshot(NEW.id, 'store', NEW.id::text, OLD.seo, NEW.seo);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER t_seo_stores AFTER INSERT OR UPDATE OF name, description, seo ON public.stores FOR EACH ROW EXECUTE FUNCTION public.tg_seo_stores();

-- One-click rollback: restores metadata_before; the restore itself is logged as a 'rollback' snapshot.
CREATE OR REPLACE FUNCTION public.seo_rollback(_snapshot uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.seo_history_rollback;
BEGIN
  SELECT * INTO s FROM public.seo_history_rollback WHERE id = _snapshot;
  IF s.id IS NULL THEN RAISE EXCEPTION 'Snapshot not found'; END IF;
  IF NOT (public.is_store_owner(s.store_id) OR public.staff_can(s.store_id, 'seo', 'edit')) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  PERFORM set_config('app.seo_change_source', 'rollback', true);
  IF s.entity_type = 'product' THEN
    UPDATE public.products SET meta = jsonb_set(coalesce(meta,'{}'::jsonb), '{seo}', s.metadata_before)
      WHERE id = s.entity_id::uuid AND store_id = s.store_id;
  ELSIF s.entity_type = 'store' THEN
    UPDATE public.stores SET seo = s.metadata_before WHERE id = s.store_id;
  ELSE
    RAISE EXCEPTION 'Rollback not supported for %', s.entity_type;
  END IF;
  UPDATE public.seo_history_rollback SET rolled_back_at = now() WHERE id = s.id;
  PERFORM set_config('app.seo_change_source', '', true);
END $$;
REVOKE EXECUTE ON FUNCTION public.seo_rollback(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seo_rollback(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.seo_track_change(uuid,text,text,text,text[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.seo_snapshot(uuid,text,text,jsonb,jsonb) FROM PUBLIC, anon, authenticated;

-- Baseline existing content so only future real changes are flagged (no AI backlog cost).
INSERT INTO public.seo_change_tracking(store_id, entity_type, entity_id, current_hash, status)
SELECT store_id, 'product', id::text, public.seo_semantic_hash(ARRAY[name, short_description, description, price::text, old_price::text, brand, category_id::text]), 'optimized' FROM public.products
ON CONFLICT DO NOTHING;
INSERT INTO public.seo_change_tracking(store_id, entity_type, entity_id, current_hash, status)
SELECT store_id, 'category', id::text, public.seo_semantic_hash(ARRAY[name, description]), 'optimized' FROM public.categories
ON CONFLICT DO NOTHING;
INSERT INTO public.seo_change_tracking(store_id, entity_type, entity_id, current_hash, status)
SELECT id, 'store', id::text, public.seo_semantic_hash(ARRAY[name, description]), 'optimized' FROM public.stores
ON CONFLICT DO NOTHING;
