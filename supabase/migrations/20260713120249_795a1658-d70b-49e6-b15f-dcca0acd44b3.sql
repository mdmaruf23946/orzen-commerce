-- Allow all authenticated users (store admins) to read platform payment methods
-- so the checkout page can display enabled gateways (bKash number, instructions).
-- Owner-only policy remains for write operations.
CREATE POLICY "authenticated read payment settings"
ON public.platform_payment_settings
FOR SELECT
TO authenticated
USING (true);