ALTER TABLE public.seo_recommendations ADD COLUMN IF NOT EXISTS proposed_alt text;

CREATE OR REPLACE FUNCTION public.seo_apply_recommendation(_id uuid, _title text, _description text, _keywords text, _alt text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.seo_recommendations; cur jsonb;
BEGIN
  SELECT * INTO r FROM public.seo_recommendations WHERE id = _id;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Suggestion not found'; END IF;
  IF NOT (public.is_store_owner(r.store_id) OR public.staff_can(r.store_id, 'seo', 'edit')) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  IF r.status <> 'pending' THEN RAISE EXCEPTION 'Suggestion already reviewed'; END IF;
  IF r.entity_type <> 'product' THEN RAISE EXCEPTION 'Only product suggestions can be applied'; END IF;
  PERFORM set_config('app.seo_change_source', 'ai_apply', true);
  SELECT coalesce(meta->'seo','{}'::jsonb) INTO cur FROM public.products WHERE id = r.entity_id::uuid AND store_id = r.store_id;
  cur := cur || jsonb_strip_nulls(jsonb_build_object(
    'title', nullif(left(trim(_title),70),''),
    'description', nullif(left(trim(_description),200),''),
    'keywords', nullif(left(trim(_keywords),400),''),
    'image_alt', nullif(left(trim(_alt),200),'')));
  UPDATE public.products SET meta = jsonb_set(coalesce(meta,'{}'::jsonb), '{seo}', cur)
    WHERE id = r.entity_id::uuid AND store_id = r.store_id;
  UPDATE public.seo_recommendations SET status = 'applied', reviewed_at = now(), reviewed_by = auth.uid(),
    proposed_title = _title, proposed_description = _description, proposed_keywords = _keywords, proposed_alt = _alt
    WHERE id = _id;
  UPDATE public.seo_change_tracking SET status = 'optimized', updated_at = now()
    WHERE store_id = r.store_id AND entity_type = 'product' AND entity_id = r.entity_id;
  PERFORM set_config('app.seo_change_source', '', true);
END $$;
REVOKE EXECUTE ON FUNCTION public.seo_apply_recommendation(uuid,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seo_apply_recommendation(uuid,text,text,text,text) TO authenticated;