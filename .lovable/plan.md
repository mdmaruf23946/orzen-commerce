
# Multi-Store SaaS E-commerce — MVP Plan

A mobile-first, lightweight SaaS where one Owner manages subscribers; each subscriber gets an admin panel + a public storefront at `/store/{slug}`. Backend on Lovable Cloud (Postgres + Auth + Storage). Checkout via Cash on Delivery + manual mobile-wallet payment (bKash/Nagad numbers shown to customer, customer enters transaction ID, store owner verifies).

## Scope (v1 — minimal but all 3 panels)

### 1. Owner Admin (`/owner/*`, role = `owner`)
- Dashboard: total users, total stores, active/suspended counts, total platform revenue
- Stores: list, activate, suspend, delete
- Users: list subscribers, assign/change subscription package
- Subscription Packages: CRUD (name, price, duration days, product limit)
- Banner/Notice management (platform-wide announcements)

### 2. User Admin (`/admin/*`, role = `user`, scoped to their own `store_id`)
- Dashboard: today's sales, total sales, total orders, total products
- Products: CRUD with image upload, gallery, category, stock, price/old price, status
- Orders: list + status flow (pending → confirmed → processing → delivered / cancelled)
- Customers: list (derived from orders), order history per customer
- Store Banners: up to 3 banner images
- Store Settings: logo, name, description, phone, WhatsApp, Facebook, address, primary color (hex), bKash/Nagad numbers
- Subscription: current package, expiry date, payment history (read-only in v1)

### 3. Customer Storefront (`/store/{slug}/*`, public)
- Home: Header (logo + name + cart icon) → Banner (max 3, lightweight CSS transition) → Product grid → Footer
- Product detail: gallery, name, price, stock, qty selector, Buy Now / Add to Cart
- Cart (localStorage, per-store key)
- Checkout: name, phone, address, area, payment method (COD / bKash / Nagad), txn ID if wallet → Confirm
- Footer: contact, WhatsApp, Facebook, privacy, terms, copyright
- Per-store theming via CSS variable for primary color
- Per-store SEO meta (title, description, OG) from store settings

## Technical Design

**Stack:** TanStack Start + Tailwind v4 + shadcn + Lovable Cloud (Supabase).

**Routing (TanStack file-based):**
```
src/routes/
  index.tsx                              → landing (pitch + sign up)
  auth.tsx                               → login / signup
  store/$slug/index.tsx                  → storefront home (public, SSR)
  store/$slug/product/$productId.tsx     → product detail (public, SSR)
  store/$slug/cart.tsx                   → cart
  store/$slug/checkout.tsx               → checkout
  store/$slug/order/$orderId.tsx         → order confirmation
  _authenticated/route.tsx               → integration-managed gate
  _authenticated/admin/index.tsx         → user admin dashboard
  _authenticated/admin/products.tsx      → + products.$id.tsx
  _authenticated/admin/orders.tsx
  _authenticated/admin/customers.tsx
  _authenticated/admin/banners.tsx
  _authenticated/admin/settings.tsx
  _authenticated/admin/subscription.tsx
  _authenticated/owner/index.tsx         → owner dashboard
  _authenticated/owner/stores.tsx
  _authenticated/owner/users.tsx
  _authenticated/owner/packages.tsx
```

Owner pages additionally gate on `has_role(auth.uid(),'owner')` in `beforeLoad` via a server fn; non-owners get redirected.

**Database schema (migration):**
- `app_role` enum: `owner`, `user`
- `user_roles(user_id, role)` — separate table per security rules; `has_role()` SECURITY DEFINER
- `subscription_packages(id, name, price, duration_days, product_limit, is_active)`
- `stores(id, owner_user_id, slug unique, name, description, logo_url, phone, whatsapp, facebook, address, primary_color, bkash_number, nagad_number, status [active|suspended], package_id, expires_at, created_at)`
- `categories(id, store_id, name)`
- `products(id, store_id, name, slug, description, price, old_price, stock, status, primary_image_url, gallery jsonb, category_id, created_at)`
- `banners(id, store_id, image_url, position, link)` (max 3 enforced in app)
- `orders(id, store_id, customer_name, phone, address, area, payment_method, txn_id, subtotal, status, created_at)`
- `order_items(id, order_id, product_id, name_snapshot, price_snapshot, qty)`
- `payments(id, store_id, package_id, amount, method, txn_id, status, created_at)` (subscription payments)
- `platform_banners`, `platform_notices` for owner-controlled site-wide content

**RLS + GRANTs (every public table):**
- `user_roles`: SELECT to authenticated for own row; admin via `has_role`
- `stores`: SELECT to anon WHERE `status='active'` (storefront read); INSERT/UPDATE/DELETE only owner of row or platform owner
- `products`, `banners`, `categories`: SELECT to anon WHERE store is active; writes restricted to store owner
- `orders`, `order_items`: INSERT to anon (checkout creates order); SELECT only to store owner / platform owner / by `order_id` token on confirmation page
- `subscription_packages`, `platform_*`: SELECT to anon; writes only `has_role('owner')`
- All tables: `GRANT SELECT, INSERT, UPDATE, DELETE ... TO authenticated; GRANT ALL TO service_role;` plus anon SELECT where above

**Storage buckets:** `store-logos`, `product-images`, `banners` (public read, write via authenticated owner).

**Server functions (`src/lib/*.functions.ts`):**
- Public: `getStoreBySlug`, `listStoreProducts`, `getProduct`, `listStoreBanners`, `placeOrder` (validates with Zod, inserts order + items, returns order id)
- Authenticated (`requireSupabaseAuth`): product CRUD, order status update, store settings update, banner CRUD
- Owner-only: store activate/suspend/delete, package CRUD, assign package to store

**Cart:** client-only, `localStorage[`cart:{storeSlug}`]`, simple zustand or React context.

**Theming:** storefront layout sets `style={{ '--primary': store.primary_color }}` on root container; Tailwind utility uses `var(--primary)`.

**Performance:**
- TanStack Query + loaders (`ensureQueryData`) — no client `useEffect` fetching
- `loading="lazy"` on product/banner images; `fetchpriority="high"` only on LCP banner
- No heavy slider lib — pure CSS scroll-snap for banner
- shadcn components only where useful; minimal JS

**Security:**
- Roles in `user_roles` table only (never on profiles)
- `has_role()` SECURITY DEFINER, used in RLS
- Zod validation in every server fn
- Owner gate via server fn, not client check

## Out of scope for v1 (architected to add later)
Subdomain routing, real payment gateway, courier API, SMS, Pixel/Analytics wiring, invoices, coupons, wishlist, reviews, blog, multi-language, automatic subscription billing (v1 records manual payments).

## Build order
1. Enable Lovable Cloud
2. Migration: enum, roles, has_role, all tables, RLS, GRANTs, storage buckets
3. Auth page + signup that auto-creates a `stores` row for the new user with role `user`
4. User Admin shell + products CRUD + settings
5. Storefront (home, product, cart, checkout, order confirmation)
6. Orders + customers + banners in User Admin
7. Owner Admin (stores, users, packages)
8. Polish: SEO meta per store, image lazy-loading, responsive QA at 390px
