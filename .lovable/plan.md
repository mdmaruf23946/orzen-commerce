## Goal
Give Categories, Banners and Coupons the same page skeleton: header (title + description + primary action) → sticky filter pills → search/sort row → content. UI only; no API, data, or logic changes.

## New shared components (`src/components/admin/page/`)
1. `AdminPageHeader.tsx` — title, description, right-aligned action slot. Stacks on mobile (action full-width below header).
2. `TypeFilterTabs.tsx` — horizontally scrollable rounded pills (All / Physical / Digital / Service / Subscription), active = brand `bg-primary text-primary-foreground`, inactive = `bg-background border` with hover. Wrapper is `sticky top-0 z-20` with a background + subtle bottom border so it stays under the admin header while scrolling. Edge fade + `snap-x` on mobile, `scrollbar-none`.
3. `AdminToolbar.tsx` — search input (with icon) plus optional right-side sort `select`; stacks vertically on mobile.

All three take the tab list and active key as props, so each page keeps its own `TABS`, state and filtering code exactly as it is today.

## Per-page changes
- **categories.tsx** — replace the inline header/tabs/search block (roughly lines 130–190) with the three shared components in the new order. Keep drag & drop, visibility toggle, edit/delete, product counts, and the existing `visible` memo untouched.
- **banners.tsx** — same swap; keep the "3 banners per type" limit text and disabled Add button, card grid, status pills, edit/delete.
- **coupons.tsx** — same swap; keep sort select (Newest/Oldest/Active/Expired), desktop table + mobile cards, badges, edit/delete.

## Visual polish (all three)
- Consistent section spacing (`space-y-4 sm:space-y-5`), consistent card radius (`rounded-xl`) and soft shadow (`shadow-sm hover:shadow-md transition-shadow`).
- Keep the existing `key={tab}` fade/slide animation on the content area.
- Touch targets ≥ 40px on mobile for pills, buttons and row actions.

## Out of scope
No migrations, no server function edits, no route or permission changes; filtering behaviour and defaults (Physical active by default) stay as-is.
