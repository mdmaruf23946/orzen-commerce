# Storefront UI Redesign — Premium Orange / Charcoal

Redesign the shopper-facing storefront (home, product cards, category sections, mobile bottom nav) inspired by the reference screenshots. No backend, schema, data, checkout, or Merchant Panel logic changes.

## Visual system

Add storefront tokens (used only in storefront components, no hardcoded hex in JSX):

- Accent `#FF4B1F`, dark `#111111`, bg `#FFFFFF`, secondary bg `#F7F7F7`, text `#171717`
- Consistent radius/shadow scale, tighter type ramp, orange reserved for CTAs, prices, badges, active states

These sit alongside the existing merchant theme variables so merchant-configured colors still win where they are already applied.

## Home page layout (top to bottom)

1. **Hero double-banner.** Desktop: a 2/3 main auto-rotating banner carousel next to a stacked column of two supporting banners (from the same banner list, positions 2 and 3). Mobile: main banner carousel full-bleed, supporting banners as a 2-up grid underneath. Falls back gracefully when the store has 1 or 2 banners only.
2. **Featured Categories.** Section with a pill heading, clean bordered category cards (image or letter fallback), 2–3 per row on mobile in a horizontal snap strip, 6–8 per row grid on desktop. Keeps existing select-category behavior.
3. **Featured Products.** Dark charcoal panel with a horizontal snap carousel of product cards and arrow controls on desktop, swipe on mobile — replaces the current plain grid for this section only.
4. **Category product sections.** For each main category with products, a titled row showing a limited set (up to 8/10) with a "See More" button that applies that category filter and scrolls to the results grid.
5. **Best sellers / new arrivals / all products** keep their existing sections and section-order/toggle control from the theme settings, restyled to match.

## Product card

Rebuild the card visuals: square image with soft zoom on hover, discount percentage badge in accent, wishlist heart, two-line name, price row with strikethrough compare price in muted text and current price in accent, and a full-width "Add to cart" action on the card footer. All existing cart/wishlist/link behavior is reused unchanged.

## Mobile bottom navigation

Reduce to exactly five items: Categories, WhatsApp, **Home** (center, raised circular accent button), Wishlist, Track Order.

- Categories opens the existing category drawer/strip
- WhatsApp uses the store's configured WhatsApp number (hidden gracefully / replaced with Cart if unset)
- Wishlist keeps its badge count
- Track Order links to the existing account orders view
- Cart and Account move out of the bottom bar; both remain reachable from the header
- Fixed, safe-area aware, with matching bottom padding on page content so nothing is hidden

## Technical notes

- Files touched: `src/routes/store/$slug/index.tsx`, `src/components/storefront/ProductCard.tsx`, `src/components/storefront/BottomNav.tsx`, `src/routes/store/$slug/route.tsx` (header spacing/bottom padding), plus a small `src/components/storefront/HeroBanners.tsx` and storefront tokens in `src/styles.css`.
- New UI strings go through the existing store i18n dictionaries (EN + BN).
- No changes to `storefront.functions.ts`, RLS, orders, checkout, or Merchant Panel routes.
- Verified after build with a mobile (390px) and desktop Playwright pass on a live store.
