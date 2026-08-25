# Showcase Mockups Management (Owner Panel → Landing Page)

Make the "প্রতিটি স্ক্রিন, একই যত্নে তৈরি" product showcase use real screenshots uploaded from the Owner Admin Panel, instead of the hand-built CSS mockups.

## 1. Owner Panel: Showcase Mockups

New page at `/owner/showcase` ("Showcase Mockups"), linked in the Owner sidebar next to Reviews & Testimonials.

For each of the five tabs — Merchant Panel, Customer Store, Owner Panel, AI Dashboard, Analytics — one card with:

- Desktop screenshot: upload / preview / replace / remove
- Mobile screenshot: upload / preview / replace / remove
- Recommended size hints (desktop ~1600×1000, mobile ~430×930)

Uploads go to the existing `store-assets` storage under `platform-showcase/…` and are served through the existing `/api/img/…` route, exactly like testimonial avatars. Images are compressed client-side before upload. A single "Save" writes all rows.

## 2. Landing page rendering

- The showcase fetches the saved images publicly (no login) and renders the active tab's desktop image inside the existing browser frame and the mobile image inside the existing phone frame, using `object-cover`/`object-top` so screenshots stay crisp and correctly cropped.
- If a tab has no uploaded image, the current built-in CSS mockup for that tab renders instead — nothing breaks and the section never looks empty.
- Tab pills, cross-fade animation, frames, and responsive behaviour stay exactly as they are today.

## Technical notes

- New table `public.platform_showcase`: `key` (tab key, primary key), `desktop_url`, `mobile_url`, timestamps. GRANT `SELECT` to `anon`/`authenticated`, full access to `service_role`; RLS on with a public read policy and an owner-only write policy via `has_role(auth.uid(),'owner')`.
- New `src/lib/showcase.functions.ts`: `getPublicShowcase` (unauthenticated read, server publishable client — safe for SSR of the public landing route) and `saveShowcase` (owner-gated, `requireSupabaseAuth`), mirroring `reviews.functions.ts`.
- `src/routes/index.tsx`: `DashboardShowcase` gains a query for showcase rows; `DesktopMock`/`MobileMock` become the fallback path when no URL exists. Existing mock components stay in place.
- New route file `src/routes/_authenticated/owner/showcase.tsx` plus a nav entry in `src/routes/_authenticated/owner/route.tsx`.
- No changes to storefronts, auth, or any merchant-side code.
