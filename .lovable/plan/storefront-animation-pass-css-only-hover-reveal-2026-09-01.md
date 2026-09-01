# Storefront Animation Pass (CSS-only, hover + reveal)

Add tasteful, professional motion across the customer-facing store. No backend, data, or business-logic changes — presentation only.

## Motion system

Add a small set of storefront animation utilities to `src/styles.css` (tokens + keyframes), so every component uses the same timing instead of one-off values:

- Easing/duration tokens: fast (150ms), base (220ms), slow (420ms), spring-like cubic-bezier
- Keyframes: `sf-fade-up`, `sf-fade-in`, `sf-pop`, `sf-shimmer`, `sf-float`
- Utilities: `.sf-reveal` (scroll-in fade-up with stagger delay via `--i`), `.sf-press` (active scale-down), `.sf-lift` (hover raise + shadow)
- Everything wrapped in `@media (prefers-reduced-motion: reduce)` so motion is disabled for users who ask for it

## Where animation is added

1. **Product card** (`ProductCard.tsx`)
   - Hover: card lifts with softer/deeper shadow, image zooms smoothly, thin accent border glow
   - Add-to-cart / Buy now: hover fill shift, press scale-down, cart icon nudge on hover
   - Wishlist heart: pop-scale on toggle, fills with accent
   - Discount badge: subtle entrance pop; "sold out" overlay fades in
   - Mobile: on-tap press feedback (no hover dependency)
2. **Product grids and rails** (home sections, shop page, related rail): staggered fade-up as each card enters the viewport, using an IntersectionObserver-based `useReveal` hook already present in the project.
3. **Hero banners** (`HeroBanners.tsx`): crossfade + slight zoom between slides, animated dot indicators.
4. **Category cards / strips**: hover raise, image zoom, label color shift to accent.
5. **Header & search** (`SearchBar.tsx`, store header): focus ring grow on the search field, suggestions dropdown fade-slide, cart/wishlist badge pop when the count changes.
6. **Bottom nav** (`BottomNav.tsx`): active item icon pop + color transition, tap ripple/press feedback.
7. **Product details page** (`pdp/`): gallery thumbnail hover/active transitions, main image fade on change, sticky add-to-cart bar slide-up, quantity buttons press feedback.
8. **Cart / checkout**: row fade-in on add, quantity change count flash, button press states, order-success check mark pop.
9. **Drawers & modals** (`MobileDrawer.tsx`, chat launcher): slide/fade with the shared easing; AI chat launcher gets a gentle idle float and hover scale.
10. **Skeletons** (`HomeSkeleton.tsx`): shimmer sweep instead of flat pulse.

## Technical notes

- Pure CSS transitions/keyframes plus the existing `use-reveal` hook — no new animation library, so no bundle-size or SSR risk.
- Only storefront components under `src/components/storefront/**` and `src/routes/store/$slug/**` are touched, plus the new utilities block in `src/styles.css`. Merchant Panel and Winner Admin are untouched.
- All colors keep using existing `sf-*` semantic tokens, so merchant theme colors continue to drive the visuals.
- Verified afterwards with a mobile (390px) and desktop Playwright pass on a live store.
