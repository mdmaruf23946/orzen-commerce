-- Orders: never reachable by anonymous visitors (incl. Realtime subscriptions)
REVOKE ALL ON public.orders FROM anon;
ALTER TABLE public.orders FORCE ROW LEVEL SECURITY;

-- Products: anonymous storefront data is served only through hardened server
-- functions that never select cost_price. Remove the stale anon read policy and
-- keep anon fully revoked, plus an explicit column-level revoke on cost_price.
DROP POLICY IF EXISTS "products public read active published" ON public.products;
REVOKE ALL ON public.products FROM anon;
REVOKE SELECT (cost_price) ON public.products FROM anon;
ALTER TABLE public.products FORCE ROW LEVEL SECURITY;