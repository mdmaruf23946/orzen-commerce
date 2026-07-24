## Goal
Rebuild `src/routes/store/$slug/product.$productId.tsx` as a premium, mobile+desktop-optimized PDP. No changes to the Product Add form or DB schema — only surface fields that already exist (`brand`, `sku`, `category_id`, `features`, `specifications`, `video_url`, `warranty`, `return_policy`, `meta`, `gallery`, `old_price`, `stock`).

## Data changes (minimal, backend-only)
Extend existing server functions in `src/lib/storefront.functions.ts`:
- `getProduct`: also return `brand, sku, category_id, features, specifications, video_url, warranty, meta, return_policy`.
- New `listRelatedProducts({ storeId, categoryId, excludeId, limit: 8 })` — reuses the products table, filtered by same category, active status; falls back to newest if fewer than 6.
- Store fetch already returns logo/name; reuse for the Store Information card.

No DB migrations, no new tables, no schema changes.

## Page structure (single route, split into small local components)
Layout:
```text
Desktop (lg+):                        Mobile:
┌──────────┬───────────────┐          ┌──────────────┐
│ Gallery  │ Info + Buy Box│          │ Gallery      │
│ + Video  │ (sticky)      │          │ Info         │
├──────────┴───────────────┤          │ Highlights   │
│ Tabs: Description /      │          │ Tabs / Accord│
│ Features / Specs /       │          │ Reviews      │
│ Package / Delivery /     │          │ Related      │
│ Warranty                 │          │ Recently Vwd │
├──────────────────────────┤          │ Store card   │
│ Reviews                  │          │ Trust badges │
│ Related products (grid)  │          │ Share        │
│ Recently viewed          │          └──────────────┘
│ You may also like        │          + Sticky bottom bar
│ Store info + Trust + Shr │            (Price | Cart | Buy)
└──────────────────────────┘
```

### Sections (all conditional — hidden if data missing)
1. **Gallery** — thumbnail rail + main image with hover/click zoom (CSS transform, no library). If `video_url` present and matches YouTube/Facebook, append a video slide with lazy `<iframe loading="lazy">`.
2. **Info block** — name, price, discount %, old price strike, stock badge, brand, category link, SKU. Short highlights read from `meta.highlights` (array) if present; otherwise omitted.
3. **Description** — reuse existing sanitized rich-text renderer.
4. **Key Features** — render `features` (array of strings) as bullet list; hidden if empty.
5. **Technical Specifications** — render `specifications` (object) as 2-col key/value table; hidden if empty.
6. **Package Includes** — from `meta.package_includes` (array) if present.
7. **Delivery & Return** — pulled from store `delivery` JSON (already in store) + product `return_policy`.
8. **Warranty** — `warranty` field if present.
9. **Customer Reviews (UI shell)** — no reviews table exists; render average rating placeholder (uses `meta.rating` if present, else "No reviews yet"), rating breakdown bars, empty state, and a **Write a Review** button that opens a "coming soon" toast. This keeps the section without new DB work.
10. **Related Products** — `listRelatedProducts` grid (2 cols mobile, 4 desktop), min 6, lazy-loaded images.
11. **Recently Viewed** — localStorage-backed (`recent:{slug}` key), push current product on mount, render horizontal scroll rail.
12. **You May Also Like** — reuse existing `listBestSellingProducts` server fn (already present) as lightweight AI-style recommendation.
13. **Frequently Bought Together** — omitted (marked optional in request; would need new data).
14. **Share Product** — Facebook / Messenger / WhatsApp / Telegram share URLs + Copy Link (uses `navigator.clipboard`).
15. **Store Information** — logo + name + Visit Store button linking to `/store/$slug`.
16. **Trust badges** — Secure Checkout, COD (if store gateway includes cod), Fast Delivery, Easy Return, Original Product — static icons + labels.
17. **Sticky bottom bar (mobile)** — fixed bar with price, Add to Cart, Buy Now; only visible on `<lg` and when main Buy Box scrolled out of view (IntersectionObserver).
18. **Sticky Buy Box (desktop)** — right column uses `position: sticky; top: 80px` so Buy Now / Add to Cart stay visible.

## New helper files
- `src/lib/recently-viewed.ts` — read/write recent product IDs per store in localStorage (max 12).
- `src/components/storefront/pdp/` (co-located small components):
  - `ProductGallery.tsx` (images + zoom + video slide)
  - `BuyBox.tsx` (qty, add/buy, sticky wrapper)
  - `InfoTabs.tsx` (Description/Features/Specs/Package/Delivery/Warranty — accordion on mobile, tabs on desktop)
  - `ReviewsBlock.tsx` (rating breakdown UI shell)
  - `RelatedRail.tsx` (reused for Related, Recently Viewed, You May Also Like)
  - `ShareBar.tsx`, `TrustBadges.tsx`, `StoreCard.tsx`, `StickyMobileBar.tsx`

## Performance
- All rails/images use `loading="lazy"` and `decoding="async"`.
- Related/recently-viewed/best-sellers queries run in `useQuery` (not blocking loader) so PDP first paint stays fast.
- IntersectionObserver defers mounting Reviews/Related sections until near-viewport.
- No new heavy dependencies; zoom via CSS `transform` on hover/tap.
- Sanitized description already handled.

## Out of scope
- No Product Add form changes.
- No new DB tables (reviews section is a UI shell only).
- No Frequently Bought Together (needs data we don't have).
- No new routes.

## Verification
- Playwright: load a real product page at 375px and 1280px viewports, screenshot to confirm gallery, sticky bars, and all conditional sections render without HTML tags leaking.
- `tsgo` typecheck.
