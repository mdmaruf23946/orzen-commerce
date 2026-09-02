ALTER TABLE public.landing_pages
  ADD COLUMN IF NOT EXISTS last_visit_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_activity_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS idle_warned_at timestamptz,
  ADD COLUMN IF NOT EXISTS hosts_released_at timestamptz;

CREATE INDEX IF NOT EXISTS landing_pages_last_activity_idx
  ON public.landing_pages (last_activity_at);

ALTER TABLE public.landing_page_domains
  ADD COLUMN IF NOT EXISTS released_at timestamptz,
  ADD COLUMN IF NOT EXISTS release_reason text;

ALTER TABLE public.store_domains
  ADD COLUMN IF NOT EXISTS released_at timestamptz,
  ADD COLUMN IF NOT EXISTS release_reason text;

-- Mark a landing page as active (called from the public page / order paths).
CREATE OR REPLACE FUNCTION public.touch_landing_activity(_page_id uuid, _visit boolean DEFAULT true)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.landing_pages
     SET last_activity_at = now(),
         last_visit_at = CASE WHEN _visit THEN now() ELSE last_visit_at END,
         idle_warned_at = NULL
   WHERE id = _page_id
     AND (last_activity_at IS NULL OR last_activity_at < now() - interval '10 minutes');
$$;

REVOKE ALL ON FUNCTION public.touch_landing_activity(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.touch_landing_activity(uuid, boolean) TO anon, authenticated, service_role;