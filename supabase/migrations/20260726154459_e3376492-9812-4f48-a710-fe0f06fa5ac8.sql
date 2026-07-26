INSERT INTO public.courier_providers (code, name, description, brand_color, sort_order, is_active)
VALUES
  ('ecourier', 'eCourier', 'Nationwide COD & express', '#00A651', 50, true),
  ('sa_paribahan', 'S.A. Paribahan', 'Trusted nationwide parcel service', '#1F4E9C', 60, true),
  ('sundarban', 'Sundarban Courier', 'Legacy nationwide network', '#B45309', 70, true)
ON CONFLICT (code) DO NOTHING;