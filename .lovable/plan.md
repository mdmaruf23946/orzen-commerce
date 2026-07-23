## Goal

Make category clicks and search typing filter the storefront home instantly — no scroll, no reload, no URL change, no remounts. Only the product area updates.

## Scope

Single file: `src/routes/store/$slug/index.tsx` (header/search/drawer already dispatch to the shared `useStoreUI` store, so no changes needed there).

## Changes

1. **Remove all auto-scroll on filter**
   - Delete the `scrollToAll()` helper and every call site: `MainCategoryBar` onSelect, `SubcategoryBar` onSelect, `CategoryStrip` onSelect, and all three Section `onViewAll` handlers.
   - Category/sub/tile clicks call only `selectMain(id, source)` / `selectSub(id)`; "View all" handlers call `selectMain(null, null)` only.
   - Keep `id="all-products"` on the grid section (harmless anchor), just never programmatically scroll to it.

2. **Remove the search → auto-select subcategory effect**
   - Delete the `useEffect` that matches `query` against category names and calls `selectMain/selectSub`. Search must not mutate category state; it only filters the list.

3. **Hide the promo rails while a filter is active**
   - Compute `const isFiltering = !!activeMainId || !!activeSubId || query.trim().length > 0;`
   - Only render Featured, Best Selling, New Arrivals, and the two category bars (`CategoryStrip`, `SubcategoryBar` already conditional) when `!isFiltering`. `MainCategoryBar` and `BannerCarousel` stay mounted always.
   - When filtering, the page shows: header (external) → MainCategoryBar → Banner → All Products grid (filtered). No layout shift beyond the rails collapsing in place.

4. **Empty-state polish**
   - When `filtered.length === 0` and `isFiltering`, show a centered card with a `SearchX` (lucide) icon, heading "No products found.", and subtext "Try another keyword or category." Reuse existing empty state when no products exist at all.

5. **Preserve current perf characteristics**
   - Keep `useMemo` for `filtered`, `mainCategories`, `subsByParent`, `catParentMap`, `countsByMain`, `featured`, `newArrivals`.
   - No new queries, no route changes, no URL params. All filtering stays client-side against the already-loaded `products` list.

## Non-changes

- No changes to `SearchBar`, `store-ui`, data loaders, routes, or product card.
- Header/Banner/Footer/BottomNav remain mounted (they already do — they live in `store/$slug/route.tsx`).
- No URL sync — explicitly per spec ("Do not change the URL").

## Verification

- Tap a category pill → grid updates in place, window scroll position unchanged, rails hide, URL unchanged.
- Tap "All" → full grid returns, rails reappear.
- Type in search → grid filters live; category state untouched; clearing search restores rails.
- Category + search combined → intersection shown; empty state renders when nothing matches.
- `bunx tsgo --noEmit` clean.
