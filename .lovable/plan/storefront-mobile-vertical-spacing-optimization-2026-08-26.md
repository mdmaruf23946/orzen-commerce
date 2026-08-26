# Storefront Mobile Vertical Spacing Optimization

## Goal
Tighten the mobile storefront layout (320px–480px) so the header, search bar, banner, category cards, and featured-products section sit closer together without breaking desktop spacing.

## Changes

### 1. Header + Search Bar (`src/routes/store/$slug/route.tsx`)
- Remove the top padding/margin above the mobile search band so it attaches directly beneath the logo/cart row.
- Reduce the mobile search band’s vertical padding to `py-1` (or `py-1.5` if touch targets need it) and keep only a subtle hairline separator.
- Keep the text-only `HeaderCategoryBar` inside the sticky frame; reduce its vertical padding to `py-1` on mobile so the whole sticky header is compact.

### 2. Banner Spacing (`src/routes/store/$slug/route.tsx` + `src/routes/store/$slug/index.tsx`)
- Reduce `<main>` top padding on mobile from `pt-4` to `pt-0` or `pt-1` so the banner starts right under the sticky header.
- Ensure the banner carousel has no top margin and only a small bottom margin (`mb-2`) on mobile.

### 3. Category Cards Alignment (`src/routes/store/$slug/index.tsx`)
- Reduce the vertical gap between homepage blocks on mobile: change the root flex gap from `gap-8` to `gap-3`/`gap-4` below `sm` breakpoint.
- Keep `CategoryStrip` with no extra top margin so it connects smoothly under the banner.

### 4. Featured Products Header (`src/routes/store/$slug/index.tsx`)
- Reduce top spacing of the "Featured Products" section on mobile to `mt-3`/`mt-4`.
- Keep the section title and product grid compact; preserve desktop spacing.

## Verification
- Preview the storefront on the mobile viewport (404×720 or similar).
- Confirm the search bar sits flush under the header, banner flush under search, categories flush under banner, and featured header close to categories.
- Confirm desktop layout remains unchanged.
