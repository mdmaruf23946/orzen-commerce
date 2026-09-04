# Storefront scroll performance: smooth, no stutter

Goal: every store page should scroll as fast and fluid as a normal fast website — no jank, no "sticking", no delayed catch-up when you flick upward on mobile.

## What is causing the stutter today

Verified in the storefront code:

1. **Every product card runs its own IntersectionObserver + entry animation.** `ProductCard` calls `useReveal()`, and each card animates `sf-reveal` → `sf-reveal-in` with a staggered delay. With 12–30+ cards this creates dozens of observers and dozens of simultaneously animating, composited elements during the exact moment you are scrolling.
2. **Blur effects on scrolling surfaces.** The sticky header uses `backdrop-blur-md`, the wishlist button on every card uses `backdrop-blur`, plus other blurred chips. Backdrop blur is re-rasterized on every scroll frame on mobile — this is the single most common cause of "stop-and-go" scrolling.
3. **Heavy hover/lift transitions on cards.** `sf-lift` and the 700ms image scale transition keep cards on their own compositor layers.
4. **Featured rail fights the page scroll.** A `setInterval` runs every 3s doing programmatic `scrollTo({behavior:"smooth"})` on the horizontal rail, plus a `window` scroll listener; smooth-scrolling a nested rail while the page is being flicked steals touch momentum.
5. **Whole catalog loaded and rendered at once.** The route loader fetches all products for the store, then paginates client-side; images have no width/height, so the layout keeps shifting as lazy images arrive, which reads as "sticking".

## The fix

**A. Kill blur on scroll surfaces (mobile first)**
- Replace the sticky header's `backdrop-blur-md` with a solid themed background (visually near-identical, no per-frame rasterization).
- Remove `backdrop-blur` from product-card wishlist buttons and other in-list chips; use a solid/translucent background instead.

**B. Make reveal animation cheap**
- Replace the per-card IntersectionObserver with a single shared observer (one observer instance reused across all cards), or drop reveal entirely on touch devices/small screens where it costs the most.
- Cards that are already in the first viewport render visible immediately (no animation on first paint).
- Disable `sf-lift` hover transform on touch devices via a `(hover: hover)` media query so touch users never get composited hover layers.

**C. Stop the featured rail from stealing touch momentum**
- Pause the auto-scroll interval whenever the page is scrolling (already partly there) and additionally while the rail is not fully visible; switch the rail auto-advance off entirely on `prefers-reduced-motion` and when the tab is hidden.
- Use `overscroll-behavior-x: contain` on the rail so horizontal drags never leak into vertical page scrolling.

**D. Reduce work per frame / layout shift**
- Add explicit aspect-ratio sizing (already square) plus `width`/`height` hints on product images so lazy image arrival doesn't reflow the list.
- Render the first batch of cards eagerly and keep the rest paginated; avoid mounting all catalog cards at once for large stores.
- Add `content-visibility: auto` with a size hint to below-the-fold product sections so the browser skips laying out off-screen content.

**E. Global scroll behaviour**
- Keep smooth `scroll-behavior` for fine pointers only (already the case) and confirm no component forces smooth scrolling on the document during touch.

## Technical notes

Files to change:
- `src/styles.css` — blur/hover/motion rules, `(hover: hover)` guards, `content-visibility` utility, reduced-motion handling.
- `src/components/storefront/ProductCard.tsx` — shared observer, no per-card blur, image size hints.
- `src/hooks/use-reveal.ts` — single shared IntersectionObserver implementation.
- `src/routes/store/$slug/route.tsx` — sticky header background without backdrop blur.
- `src/routes/store/$slug/index.tsx` — featured rail auto-scroll guards, `overscroll-behavior`, section `content-visibility`.

Out of scope: no changes to products, orders, payments, themes data, or any backend logic. Purely presentation/performance.

## Verification

Mobile-viewport Playwright run on a real store: flick-scroll the home page, record long-frame counts before/after, confirm no dropped-frame clusters, and screenshot mid-gesture to confirm nothing jumps or sticks.
