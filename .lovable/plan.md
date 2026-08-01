## Goal

Upgrade the existing Banner Management page (`/admin/banners`) with Product Type tabs, matching the Category page style. No page redesign, no new pages.

## Verified current state

- The `banners` table today has only: `id`, `store_id`, `image_url`, `link`, `position`, `campaign_type`, `created_at`. It has no title, product type, display position, category link, status, or updated timestamp.
- The page currently has no search box, no filter, no sort control and no Edit — banners can only be added and deleted.
- `addBanner` enforces a hard "Maximum 3 banners" per store; there is no update function.
- The storefront reads banners from the same table and will keep showing all of them (unchanged, as agreed).

## Plan

### 1. Database
Add to `banners`: `title`, `product_type` (default `physical`), `display_position` (default `hero`), `category_id` (optional, links to a category), `sort_order`, `is_active` (default true), `updated_at` (auto-maintained). Existing rows get sensible defaults so nothing breaks; the storefront query keeps working as-is.

### 2. Tabs
Add the same tab row as the Category page: All / Physical / Digital / Service / Subscription, default Physical, client-side only, with a soft fade/slide transition. Legacy rows with no type count as Physical.

### 3. Search + sort
Same search bar style as Categories, filtering title/link within the active tab only. A small dropdown next to it: Newest, Oldest, Active, Inactive.

### 4. Add / Edit
- One "Add banner" button in the same position. The new banner automatically takes the active tab's type (Physical when the All tab is active). No manual type picker.
- Form fields: Title, Image, Link (optional), Display Position (Hero / Secondary / Promotional / Category Banner), Related Category (optional — lists categories of the same product type), Sort Order, Status.
- Editing opens the same dialog pre-filled and keeps the banner's existing product type.

### 5. Card list
Keep the current card grid; each card shows preview image, title, display position, related category, status, sort order, last updated, plus Edit and Delete.

### 6. Limits and empty state
Cap becomes 3 banners per product type (so up to 3 Physical, 3 Digital, etc.). The Add button disables with a note when the active type is full. When a tab has no matches: "No banners found." plus an Add banner button.

## Technical notes

- Files touched: one migration, `src/lib/admin.functions.ts` (widen `addBanner` input, add `updateBanner`, count scoped per product type, return new columns), and `src/routes/_authenticated/admin/banners.tsx` (tabs, search, sort, dialog, card layout).
- No existing API is removed and no response shape is narrowed; `listMyBanners` and `deleteBanner` keep their signatures.
- Storefront, theme customization, products and categories are untouched.
- Mobile: tabs scroll horizontally, search and sort stack full-width, cards go one per row.
