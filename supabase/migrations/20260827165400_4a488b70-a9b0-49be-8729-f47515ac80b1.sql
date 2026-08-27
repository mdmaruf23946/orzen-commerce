CREATE TABLE public.product_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 100),
  email text CHECK (email IS NULL OR char_length(email) <= 255),
  phone text CHECK (phone IS NULL OR char_length(phone) <= 30),
  comment text NOT NULL CHECK (char_length(trim(comment)) BETWEEN 1 AND 2000),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX product_reviews_product_idx ON public.product_reviews (product_id, status, created_at DESC);
CREATE INDEX product_reviews_store_idx ON public.product_reviews (store_id, status, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_reviews TO authenticated;
GRANT ALL ON public.product_reviews TO service_role;

ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store team can manage product reviews"
ON public.product_reviews FOR ALL TO authenticated
USING (public.has_store_access(store_id))
WITH CHECK (public.has_store_access(store_id));

CREATE TRIGGER product_reviews_updated_at
BEFORE UPDATE ON public.product_reviews
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.submit_product_review(
  _store_id uuid,
  _product_id uuid,
  _rating smallint,
  _name text,
  _comment text,
  _email text DEFAULT NULL,
  _phone text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ok boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = _product_id AND p.store_id = _store_id AND p.status <> 'draft'
  ) INTO _ok;

  IF NOT _ok THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Product not found');
  END IF;

  IF _rating IS NULL OR _rating < 1 OR _rating > 5 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid rating');
  END IF;

  IF coalesce(trim(_name), '') = '' OR coalesce(trim(_comment), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Name and comment are required');
  END IF;

  INSERT INTO public.product_reviews (store_id, product_id, rating, name, email, phone, comment)
  VALUES (
    _store_id,
    _product_id,
    _rating,
    left(trim(_name), 100),
    nullif(left(trim(coalesce(_email, '')), 255), ''),
    nullif(left(trim(coalesce(_phone, '')), 30), ''),
    left(trim(_comment), 2000)
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.submit_product_review(uuid, uuid, smallint, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_product_review(uuid, uuid, smallint, text, text, text, text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_product_reviews(_product_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'count', count(*),
    'average', coalesce(round(avg(r.rating)::numeric, 1), 0),
    'reviews', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', r.id,
          'rating', r.rating,
          'name', r.name,
          'comment', r.comment,
          'created_at', r.created_at
        ) ORDER BY r.created_at DESC
      ) FILTER (WHERE r.id IS NOT NULL),
      '[]'::jsonb
    )
  )
  FROM public.product_reviews r
  WHERE r.product_id = _product_id AND r.status = 'approved';
$$;

REVOKE ALL ON FUNCTION public.get_product_reviews(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_product_reviews(uuid) TO anon, authenticated, service_role;