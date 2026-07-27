
UPDATE public.platform_branding
SET assets = (
  SELECT jsonb_object_agg(
    k,
    CASE
      WHEN v ? 'url' AND v->>'url' LIKE 'https://%/storage/v1/object/public/store-assets/%'
      THEN jsonb_set(v, '{url}', to_jsonb('/api/img/' || split_part(v->>'url', '/storage/v1/object/public/store-assets/', 2)))
      ELSE v
    END
  )
  FROM jsonb_each(assets) AS e(k, v)
),
updated_at = now()
WHERE id = 'global' AND assets <> '{}'::jsonb;
