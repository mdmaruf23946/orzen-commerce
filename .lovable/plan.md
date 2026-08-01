## Goal

Upgrade the existing Coupon & Promo Code page (`/admin/coupons`) with Product Type tabs and a slightly richer form, matching the Category and Banner pages. No redesign, no new pages.

## Verified current state

- The `coupons` table has only: `code`, `type` (percent/fixed/free_shipping), `value`, `min_order`, `usage_limit`, `used_count`, `starts_at`, `expires_at`, `active`. There is no name, product type, max discount, per-customer limit, or category/product targeting.
- The page today has no tabs, no search box and no sort control. It already has a table list with Edit and Delete and a single "New coupon" button.
- `listCoupons` / `upsertCoupon` / `deleteCoupon` exist; `upsertCoupon` validates a fixed field set, so new fields must be added to its schema.

## Plan

### 1. Database
Add to `coupons`: `name`, `product_type` (default `physical`), `max_discount`, `per_customer_limit`, `category_ids`, `product_ids`. Existing rows default to Physical so nothing breaks; checkout's `validate_coupon` keeps working unchanged.

### 2. Tabs
Same tab row as Categories/Banners: All / Physical / Digital / Service / Subscription, default Physical, client-side only with a soft fade transition. Legacy rows with no type count as Physical.

### 3. Search + sort
Search box in the same style, filtering name/code within the active tab only. A dropdown next to it: Newest, Oldest, Active, Expired.

### 4. Create / Edit
- Keep the single "New coupon" button in its current spot. A new coupon automatically takes the active tab's type (Physical when All is active) — no manual type picker.
- Form fields: Coupon Name, Code, Discount Type, Discount Value, Minimum Order (optional), Maximum Discount (optional), Usage Limit, Usage Limit Per Customer, Start Date, Expiry Date, Applicable Categories (optional), Applicable Products (optional), Status.
- Edit opens the same dialog pre-filled and keeps the coupon's existing product type.

### 5. List
Keep the current table (cards on mobile). Each row shows name, code, discount, product type badge, usage count, expiry, status, Edit, Delete.

### 6. Empty state
When a tab has no matches: "No coupons found." with a Create coupon button below it.

## Technical notes

- Files touched: one migration, `src/lib/business.functions.ts` (widen `couponSchema`, return new columns — no signature or response narrowing), and `src/routes/_authenticated/admin/coupons.tsx` (tabs, search, sort, dialog fields, badges, empty state).
- Category/product pickers read from existing product and category list functions; nothing on those pages changes.
- Checkout, orders, products, categories and banners are untouched; the coupon validation RPC is left as-is for backward compatibility.
- Mobile: tabs scroll horizontally, search and sort stack full-width, the table becomes stacked cards.
