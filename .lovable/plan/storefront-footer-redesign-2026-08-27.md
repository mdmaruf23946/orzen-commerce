# Storefront Footer Redesign

## Goal
Replace the current inline store footer with a professional, trustworthy, dark-themed footer that follows the requested 4-column layout, includes payment/courier trust badges, and exposes newsletter signup.

## Current State
- `StoreFooter` is currently an inline component inside `src/routes/store/$slug/route.tsx` (lines ~700–824).
- It supports only 2–3 columns, has minimal links, no newsletter, no trust badges, and relies on `theme.footer` for contact overrides.
- Storefront copy lives in `src/lib/store-i18n/dict/common.ts` and is consumed via `useStoreT()`.
- `stores` table already has `trade_license` and contact/social columns.

## Plan

### 1. Extract & rebuild `StoreFooter`
Create `src/components/storefront/StoreFooter.tsx` and move all footer logic out of `route.tsx`.

**Layout:**
- Full-width dark footer using `bg-slate-900` / `bg-gray-950` and `text-slate-300`.
- 4-column responsive grid: `grid-cols-1 md:grid-cols-2 lg:grid-cols-4`.
- Column 1 — Brand: store logo, name, tagline/description, address with `MapPin`, social icons (Facebook, Instagram, YouTube, WhatsApp).
- Column 2 — Quick Links: About Us, Contact Us, Shop All, Track Order, Blogs.
- Column 3 — Customer Policies: Privacy Policy, Terms & Conditions, Return & Refund Policy, Shipping Policy.
- Column 4 — Newsletter & Contact: phone, email, business hours, email subscribe input + join button.

**Styling:**
- Section headings: `text-white font-semibold text-base mb-4`.
- Links: `text-slate-300 hover:text-orange-500 transition-colors`.
- Social icons: circular bordered buttons with official brand colors on hover.

### 2. Trust Badges & Payment/Courier Section
Add a full-width inner section inside the footer showing accepted methods:
- bKash, Nagad, Rocket, Visa, Mastercard, Pathao, Steadfast.
- Render clean SVG badges (static assets under `src/assets/payment-badges/` or inline SVG components).
- Hide if `theme.footer.payment_icons === false`.

### 3. Bottom Bar
- `border-t border-slate-700/50` divider.
- Copyright: `© 2026 [store.name]. All Rights Reserved.`
- Trade license line if `store.trade_license` is configured.

### 4. Newsletter Subscription
- Add a simple email input + "Join" button in Column 4.
- Create `src/lib/newsletter.functions.ts` with a public `subscribeToStoreOffers` server function that inserts into a new `public.store_newsletter_subscribers` table (email + store_id + subscribed_at), or reuse an existing subscriber table if one exists.
- Validate email with Zod and prevent duplicate inserts per store.

### 5. i18n Copy
Add new keys to `src/lib/store-i18n/dict/common.ts` (en + bn):
- `footer.aboutUs`, `footer.contactUs`, `footer.shopAll`, `footer.trackOrder`, `footer.blogs`
- `footer.customerPolicies`, `footer.privacy`, `footer.terms`, `footer.returnRefund`, `footer.shippingPolicy`
- `footer.newsletter`, `footer.subscribePlaceholder`, `footer.join`, `footer.businessHours`
- `footer.trustBadges`, `footer.copyright`, `footer.tradeLicense`

### 6. Data & Schema
- Ensure `get_public_store_by_slug` RPC returns: `trade_license`, `business_hours`, `facebook`, `instagram`, `youtube`, `whatsapp`, `tiktok`, `linkedin`, `website`, `address`, `phone`, `email`, `description`, `logo_url`, `name`.
- If `business_hours` is missing from the RPC, update the RPC select list.
- Add migration for `public.store_newsletter_subscribers` if no equivalent table exists:
  - `id uuid primary key default gen_random_uuid()`
  - `store_id uuid references public.stores(id) on delete cascade not null`
  - `email citext not null`
  - `subscribed_at timestamptz default now()`
  - Unique `(store_id, email)`
  - `GRANT SELECT, INSERT` to `authenticated` and `anon`; `GRANT ALL` to `service_role`.
  - Enable RLS; policy: `anon`/`authenticated` can insert only rows matching the current store (public stores), and authenticated store owners can select for their own store.

### 7. Route Cleanup
- Remove the old inline `StoreFooter` function from `src/routes/store/$slug/route.tsx`.
- Import and render `<StoreFooter store={store} slug={slug} />` in its place.

### 8. Verification
- Run `tsgo` to confirm types.
- Use Playwright to capture desktop and mobile screenshots of the footer on a live store route.
- Confirm 4-column layout on desktop, stacked single column on mobile, and all links/socials render correctly.

## Files to Change
- `src/components/storefront/StoreFooter.tsx` (new)
- `src/lib/store-i18n/dict/common.ts`
- `src/lib/newsletter.functions.ts` (new)
- `src/routes/store/$slug/route.tsx`
- Supabase migration for newsletter subscribers (if needed)
- Supabase RPC/RLS update for `get_public_store_by_slug` fields (if needed)
