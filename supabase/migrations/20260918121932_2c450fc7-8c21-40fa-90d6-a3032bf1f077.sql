CREATE TABLE IF NOT EXISTS public.rate_limit_hits (
  bucket_key text NOT NULL,
  window_start timestamptz NOT NULL,
  hits integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (bucket_key, window_start)
);

CREATE INDEX IF NOT EXISTS rate_limit_hits_window_idx ON public.rate_limit_hits (window_start);

GRANT ALL ON public.rate_limit_hits TO service_role;
ALTER TABLE public.rate_limit_hits ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.rate_limit_hit(_key text, _limit integer, _window_sec integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _win timestamptz;
  _count integer;
BEGIN
  _win := to_timestamp(floor(extract(epoch from now()) / GREATEST(_window_sec, 1)) * GREATEST(_window_sec, 1));

  INSERT INTO public.rate_limit_hits (bucket_key, window_start, hits, updated_at)
  VALUES (_key, _win, 1, now())
  ON CONFLICT (bucket_key, window_start)
  DO UPDATE SET hits = public.rate_limit_hits.hits + 1, updated_at = now()
  RETURNING hits INTO _count;

  RETURN jsonb_build_object(
    'allowed', _count <= _limit,
    'count', _count,
    'limit', _limit,
    'retry_after', GREATEST(1, CEIL(extract(epoch from (_win + make_interval(secs => _window_sec)) - now()))::int)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rate_limit_hit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rate_limit_hit(text, integer, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.rate_limit_cleanup()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.rate_limit_hits WHERE window_start < now() - interval '2 hours';
$$;

REVOKE ALL ON FUNCTION public.rate_limit_cleanup() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rate_limit_cleanup() TO service_role;