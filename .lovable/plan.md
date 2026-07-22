
## Goal

Upgrade category navigation on the storefront home page. Desktop gets a horizontal Main Category pill bar between header and banner, plus a subcategory strip after the banner when a main category is selected. Mobile puts the tree inside the existing side drawer. All filtering is client-side — no new routes, no page reload, homepage stays mounted.

## Database (one migration)

Extend `categories` with self-referential parent:

- Add `parent_id uuid NULL REFERENCES public.categories(id) ON DELETE SET NULL`
- Add index on `(store_id, parent_id, sort_order)`
- No RLS changes (existing policies apply to all rows)

Categories with `parent_id IS NULL` = main categories. Others = subcategories.

## Admin — Categories page

`src/routes/_authenticated/admin/categories.tsx` + `src/lib/admin.functions.ts`:

- Add "Parent category" dropdown in the category dialog (options = main categories only, "— None (main category)" default).
- Update `upsertCategory` / `listMyCategories` to persist and return `parent_id`.
- List view groups subcategories visually under their parent (indent), keeps existing drag-reorder within same parent.

## Storefront data

`src/lib/storefront.functions.ts` — `listStoreCategories` already returns all categories; extend the returned shape to include `parent_id`. No new server function.

Product counts are computed client-side from the existing `products` query (already loaded). Icon category rail keeps using main categories only.

## Storefront UI — `src/routes/store/$slug/index.tsx`

State:
- `activeMainId: string | null`
- `activeSubId: string | null`
- `source: 'header' | 'icon' | null` — controls whether the subcategory strip renders
- Existing `query` from `useStoreUI` stays as-is

Derived:
- `mainCategories = categories.filter(c => !c.parent_id)`
- `subcategoriesOf(mainId) = categories.filter(c => c.parent_id === mainId)`
- `countFor(mainId)` = products whose `category_id === mainId` OR whose category's `parent_id === mainId`
- `filtered` products:
  - if `activeSubId` → `p.category_id === activeSubId`
  - else if `activeMainId` → main-or-child match
  - plus existing search filter

Layout order (unchanged sections, one new section inserted):

```
Header
MainCategoryBar   ← NEW, desktop only (hidden md:block)
Banner
SubcategoryBar    ← NEW, desktop only, renders when source==='header' && activeMainId
CategoryStrip     ← existing icon rail (unchanged)
Sections (Featured, Best Selling, All Products)
```

Components (all in the same file, matching existing style):

- `MainCategoryBar`: horizontal scrollable pill row. Items: `All (n)` + each main `Name (count)`. Active = purple bg / white text using existing `--store-btn-bg` token (falls back to `#7c3aed` when unset to match request). Click sets `activeMainId`, `activeSubId=null`, `source='header'`, scrolls to `#all-products`.
- `SubcategoryBar`: text-only pill row, appears below banner only when `source==='header'` and a main is active and it has subcategories. `All / <Sub1> / <Sub2>…`. Click sets `activeSubId`.
- Existing `CategoryStrip` (icon rail): keep as-is but change handler to set `activeMainId`, `activeSubId=null`, `source='icon'` — this deliberately hides the subcategory bar per spec.

Mobile side drawer (`src/routes/store/$slug/route.tsx` — where the current menu drawer lives; will locate and edit only the "Categories" section):

- Replace flat category list with accordion: each main = collapsible row showing `▶/▼ Name (count)`.
- Only one open at a time (`openMainId` state).
- Tap main title → sets `activeMainId`, closes drawer, scrolls to products.
- Expanded panel lists `All / <subs>` as text rows; tap → sets `activeSubId`, closes drawer, scrolls.
- No horizontal main bar on mobile (`md:hidden` on desktop bar, drawer handles mobile).

Search integration: existing search stays. When a search term matches a subcategory name exactly (case-insensitive), auto-set that sub + its parent main. Implemented as a `useEffect` on `query` change.

Scroll: use existing `scrollToAll()`. Reset `pageSize` on any filter change (existing effect extended to include `activeMainId`, `activeSubId`).

Animation: Tailwind `transition-colors duration-200` on pills, `transition-all` on accordion height via `grid-rows-[0fr]`/`[1fr]` pattern already used elsewhere. No shadows added.

## Non-goals / restrictions honoured

- No new routes, no URL/search-param changes, no reload.
- Banner, icon rail, product cards, search box untouched visually.
- Homepage still mounts once; only local state changes.
- Existing caching (`staleTime: 5min`) unchanged; no extra queries.

## Technical notes

- Category count is O(products × 1) computed via a `Map<parentId, count>` memo — one pass, no extra fetches.
- Subcategory picks products by `category_id === subId` only (no double-counting).
- Purple active pill uses `bg-[var(--store-btn-bg,#7c3aed)] text-white` so theme override still wins.
- Drawer accordion uses `aria-expanded` and keyboard-accessible buttons.
