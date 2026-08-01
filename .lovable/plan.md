## Goal

Add Product Type tabs to the existing Category Management page (`/admin/categories`) so categories are organised by type, without redesigning the page or touching other modules.

## Verified current state

- `categories` already has a `product_type` column (text, not null) — no migration needed for the column itself.
- `upsertCategory` already accepts `product_type`, but its validator only allows `"both" | "physical" | "digital"`, so Service and Subscription would be rejected today.
- Existing rows carry legacy values (`both` / `physical`), so tab filtering must treat legacy values as Physical.
- The page currently has **no** search box and shows no product counts; both are additions.
- Product counts can be derived from the existing `listMyProducts` server function (no new API).

## Plan

### 1. Tabs
Add a horizontal, scrollable tab row at the top: All / Physical / Digital / Service / Subscription. Default = Physical. Purely client state, no reload, with a soft fade/slide transition on the list.

### 2. Filtering
- Physical tab matches `product_type` of `physical` or `both` or empty (legacy rows).
- Digital / Service / Subscription match their exact value.
- All shows everything.
- Parent/child nesting stays as it is; a subcategory shows under its parent when both are in the current filter, otherwise it renders as an indented orphan (existing behaviour).

### 3. Add / Edit
- Same single "Add category" button. New categories are saved with the active tab's type automatically (on the All tab, default to `physical`).
- The dialog keeps its current fields: name, image, parent, description, display order, status. No Product Type picker.
- Editing keeps the record's existing `product_type` untouched.
- Parent dropdown only lists main categories of the same product type.

### 4. Search
Add a small search input next to the tabs. Filters by name/description within the active tab only.

### 5. List row
Keep the existing row layout, add a "N products" count chip next to the name (from `listMyProducts`, matched on `category_id`). Image, name, parent indent, status toggle, edit, delete all unchanged. Drag-to-reorder stays and reorders within the visible list.

### 6. Empty state
When a tab has no matches: "No categories found." plus an Add category button.

## Technical notes

- Files touched: `src/routes/_authenticated/admin/categories.tsx` (tabs, search, counts, filtering, dialog type assignment) and one small validator widening in `src/lib/admin.functions.ts` (`product_type` enum → adds `service`, `subscription`).
- No database migration, no schema change, no change to request/response shapes — existing callers keep working.
- Mobile: tabs scroll horizontally, search full-width below on small screens.
