
# ORZEN Storefront UI/UX Redesign

Redesign the customer storefront to a modern, mobile-first SaaS look (Shopify/Apple/Stripe feel) while preserving every existing feature, route, API, and business logic. This is presentation-layer only — no schema, no server function, no cart/checkout/auth logic changes.

## Scope
All work happens inside:
- `src/routes/store/$slug/route.tsx` (layout shell: header, footer, drawer)
- `src/routes/store/$slug/index.tsx` (homepage composition)
- `src/routes/store/$slug/account.tsx` (account dashboard)
- `src/components/storefront/ProductCard.tsx`
- New: `src/components/storefront/MobileHeader.tsx`, `MobileDrawer.tsx`, `BottomNav.tsx`, `SearchBar.tsx`, `AccountShell.tsx`

Existing state hooks (`useStoreUI`, `useCustomerSession`, `cartCount`), query keys, and server functions stay untouched.

## What changes

### 1. Mobile header (route.tsx)
- Reduce height from `h-14` + stacked search row to a single compact `h-12` sticky bar with `backdrop-blur`.
- Layout: `[Hamburger] [Logo + Name — centered]  [Cart] [Profile/Login]`.
- Remove the in-header search input. Search moves to a separate compact `<SearchBar>` band directly beneath the header (still sticky-adjacent, not inside header).
- Desktop header keeps its current shape (logo left, search center, cart/profile right) with minor spacing polish only.

### 2. Search bar
- Extract to `SearchBar.tsx`: rounded-full, subtle border, search icon, wired to existing `useStoreUI().query/setQuery` — no logic change. Auto-suggest UI hook left as a TODO placeholder (no new backend).

### 3. Mobile navigation drawer (MobileDrawer.tsx)
- Replace inline mobile menu with a slide-in left drawer (backdrop + focus trap via existing shadcn `Sheet`).
- Sections in order: Home, Categories (accordion), Orders, Wishlist, Cart, Contact, Policies, Account, Logout.
- Categories: each main row shows name + product count + expand chevron. Tapping name → filters via `selectMain` and closes drawer; tapping chevron → expands subcategories inline (accordion). Reuses existing `categories`/`products` queries and `useStoreUI` filter state.
- Wishlist/Orders/Contact/Policies map to existing routes (`/account`, `/order/...`, `contact`/legal pages already in root). Any link with no existing route is skipped rather than a new route being invented.

### 4. Desktop navigation
- Keep current horizontal `MainCategoryBar` + `SubcategoryBar` in `index.tsx`. Tighten padding/typography only.

### 5. Mobile bottom nav (BottomNav.tsx)
- Fixed bottom bar (mobile only, `md:hidden`): Home, Browse (scrolls to All Products), Cart, Wishlist, Account.
- Auto-hide on scroll-down / show on scroll-up (small `useEffect` tracking `window.scrollY`).
- Add `pb-16 md:pb-0` to the store `<main>` so content isn't covered.

### 6. Homepage (index.tsx)
- Keep section order and all existing sections: Banner, MainCategoryBar, SubcategoryBar, CategoryStrip, Featured, Best Selling, All Products.
- Polish spacing, section titles, and skeleton placeholders during suspense. No data/query changes.

### 7. Product card (ProductCard.tsx)
- Cleaner spacing, equal-height layout preserved.
- Add: small star-rating placeholder row (only if `rating` field exists on product; otherwise omit — no fake data), wishlist heart button (visual only, wired to a local `localStorage` wishlist if not already present — decision below), quick-view eye button that opens the existing product page in a new visual state. Existing Add to Cart / Buy Now / discount / stock badges preserved.

### 8. Account experience (account.tsx + new AccountShell.tsx)
- Wrap account with an `AccountShell` that renders a minimal header (Back + "My account" title) and hides store banner/category strip/footer promos. Implementation: introduce a boolean context flag (or simply render a distinct layout inside `account.tsx` that does NOT rely on `StoreLayout` chrome — but since `StoreLayout` is the route layout, we instead add a `data-account` marker and conditionally hide `StoreFooter` / `AIChatLauncher` when the current path matches `/account`).
- Redesign account into: top profile card (avatar initials, name, email, membership badge, Edit button), 2x2 quick action grid (Orders, Wishlist, Addresses, Settings), then existing tab contents rendered as stacked cards instead of a sidebar+panel.
- All existing tabs (Profile, Orders, Addresses, Password) keep their current server functions and form logic verbatim; only markup/styling changes.

### 9. Animations & perf
- Use existing Tailwind animations (`animate-fade-in`, `animate-scale-in`, accordion). No new animation libs.
- Keep `loading="lazy"` on images, skeleton divs during suspense.

## Explicitly NOT doing
- No new pages (Wishlist page, Contact page, etc.) — if user later wants them we'll add separately. Nav items link to existing routes only.
- No schema changes, no new server functions.
- No changes to cart, checkout, auth, orders, AI chat, tracking scripts, duplicate protection, messenger.
- No color palette change — reuses `--store-header-bg`, `--store-btn-bg`, `--primary` theme vars.

## Technical notes
- `<Sheet>` from `@/components/ui/sheet` (shadcn) already available for drawer.
- Bottom nav scroll-hide: single `useEffect` with `passive: true` scroll listener, throttled via `requestAnimationFrame`.
- Account page hides footer by reading route with `useRouterState` inside `StoreLayout` and conditionally rendering `<StoreFooter>` / `<AIChatLauncher>` — no route restructuring.
- Wishlist: add a tiny `src/lib/wishlist.ts` mirroring `cart.ts` pattern (localStorage per slug) so the heart button and drawer/bottom-nav Wishlist entries have somewhere to point. Wishlist route: reuse Account page's future tab OR link to `/account`. Decision: heart toggles localStorage wishlist and shows a toast; nav Wishlist entries go to `/account` (Wishlist tab reserved for later). Keeps scope tight, no new route.

## Verification
- Typecheck.
- Manual visual pass at 375px and 1280px on `/store/$slug` and `/store/$slug/account`.
- Confirm cart count, category filter, search, sign-in/out, and Add-to-Cart still work.
