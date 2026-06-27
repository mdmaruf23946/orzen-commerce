## Store Admin Panel — New Sections

Add 8 new admin pages without touching existing ones (Dashboard, Products, Categories, Orders, Customers, Banners, Store Settings, Subscription, Logout). Theme Customization moves color pickers out of Store Settings into its own page.

### 1. Database changes (single migration)

Extend `public.stores` with new JSONB + scalar columns (nullable, safe defaults):

- `marketing jsonb` — `{ fb_pixel_id, fb_capi_token, fb_capi_enabled, ga4_id, gtm_id, tiktok_pixel_id, enabled_map }`
- `couriers jsonb` — `{ steadfast: {api_key, secret, enabled}, pathao: {...}, redx: {...}, paperfly: {...} }` (extensible map keyed by provider slug)
- `seo jsonb` — `{ title, description, keywords, og_image_url, favicon_url }`
- `delivery jsonb` — `{ inside_city, outside_city, free_min, cod_enabled }`
- `payments_config jsonb` — `{ cod:{enabled}, bkash:{number,enabled}, nagad:{number,enabled}, rocket:{number,enabled}, bank:{name,account,branch,enabled}, instructions }`
- `notifications jsonb` — `{ whatsapp, email_enabled, sms_api_placeholder }`
- `product_defaults jsonb` — `{ warranty, return_policy, shipping_info }`
- `theme jsonb` — `{ header_color, footer_color, card_color, title_bar_color, button_color, radius }` (mirrors existing color columns plus `radius`)

Existing color columns (`header_color`, `title_bar_color`, `footer_color`, `button_color`) stay for backward compatibility; new Theme page writes both the old columns and `theme.radius`.

Add `products.warranty`, `products.return_policy`, `products.shipping_info` (text, nullable) — populated from `product_defaults` at create time, editable per product.

### 2. Server functions (`src/lib/admin.functions.ts`)

One generic settings updater per section, validated with Zod:

- `updateMarketing`, `updateCouriers`, `updateSeo`, `updateDelivery`, `updatePayments`, `updateNotifications`, `updateProductDefaults`, `updateTheme`
- Extend `getMyStore` to return the new JSONB blobs.

All reuse the existing owner-store check; no new RLS needed (already scoped to store owner).

### 3. Storefront integration (lightweight, no perf cost)

- `getStoreBySlug` returns `marketing`, `seo`, `theme`, `delivery`, `payments_config`.
- In `src/routes/store/$slug/route.tsx`:
  - Inject SEO title/description/favicon/OG image via TanStack `head()` from loader data (no extra request).
  - Conditionally append GA4 / GTM / FB Pixel / TikTok Pixel `<script>` tags only when IDs exist. Use `async` / defer. No npm packages.
  - Apply `theme.radius` as a CSS variable alongside existing color vars.
- Checkout page reads `delivery` for charges + free-shipping threshold and `payments_config` for enabled methods (replacing hardcoded bKash/Nagad logic).
- Facebook CAPI: server-side fire-and-forget `fetch` from the `checkout` server function when `fb_capi_enabled` and token present. No new dependencies.

### 4. New admin pages (under `src/routes/_authenticated/admin/`)

Each page = small form, reuses existing `Input`, `Textarea`, `Switch`, `Button`, `ImageUploader`. No new libraries.

- `marketing.tsx` — tracking IDs + per-channel enable switches.
- `couriers.tsx` — provider cards (SteadFast, Pathao, RedX, Paperfly) each with API key/secret + enable switch. Driven by a config array so adding a new provider = one entry.
- `theme.tsx` — color pickers (header, footer, card, title bar, button) + radius slider (0–16px). Live preview swatch.
- `seo.tsx` — title/description/keywords + OG image + favicon uploaders.
- `delivery.tsx` — inside/outside charge, free-min, COD toggle.
- `payments.tsx` — per-method enable + numbers/bank fields + instructions textarea.
- `notifications.tsx` — WhatsApp number, email toggle, SMS placeholder (disabled input + "coming soon").
- `product-defaults.tsx` — warranty/return/shipping textareas. Products form prefills from these on "New product".

### 5. Sidebar (`src/routes/_authenticated/admin/route.tsx`)

Append new links in this order, grouped after existing ones, before Subscription:

```
Marketing · Couriers · Theme · SEO · Delivery · Payments · Notifications · Product Defaults
```

Remove the "Theme colors" block from `settings.tsx` (moved to Theme page). All other Store Settings fields stay.

### 6. Auto parcel / tracking (courier)

Phase 1 ships the credentials UI + DB only (SteadFast adapter scaffold with `createParcel(orderId)` server fn behind a "Send to courier" button on the order detail). Pathao/RedX/Paperfly slots present but disabled until keys/endpoints provided. This keeps scope tight and avoids speculative API code.

### Performance

- No new npm packages.
- Tracking scripts loaded `async`, only when configured.
- All new pages are simple forms — no charts, no animations.
- JSONB columns = one row read per store; no extra queries.
- Theme + SEO injected from the same loader that already fetches the store.

### Out of scope (ask before adding)

- Live courier webhook receivers (need public URLs + secrets per provider).
- SMS provider selection.
- Multi-currency.
