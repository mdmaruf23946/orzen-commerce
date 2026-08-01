# Remove Digital & Hybrid Store Modes — Physical Only

The admin panel currently supports three store modes (Physical, Digital, Hybrid) with a switcher, a separate digital storefront design, digital admin pages and a customer downloads area. This changes the product to a single mode: **Physical store only**. Everything digital-specific is deleted.

The product form keeps its product type selector (Physical / Digital / Service / Subscription) as a plain label field — it no longer changes any behaviour, storefront layout, checkout flow or admin navigation.

## What gets removed

### Store Admin panel
- Store Mode switcher card in Store Settings and the mode selector field
- "Digital Dashboard" page and its sidebar entry
- "Digital Orders" page and its sidebar entry
- Mode-based sidebar filtering (couriers, delivery zones, shipping stay always visible)
- Digital tab inside the product add/edit dialog (file uploads, license keys, download limits, expiry, delivery mode, digital category)

### Winner Admin
- "Digital Categories" page (global digital catalog) and its nav entry
- Global digital settings (license system toggle, max file size)

### Storefront
- Digital marketplace homepage and digital product cards — every store uses the standard physical homepage
- Digital info panel on the product page (version, files, formats, changelog, download info); shipping, warranty and trust badges always show
- "Downloads" tab in the customer account and the My Downloads / Downloads panel
- Digital-only checkout path — checkout always collects address, delivery zone and shipping charge

### Backend logic
- Digital fulfilment on order confirmation and on order placement (entitlements, unlocking, download emails)
- Signed download URLs, download counters and download event logging
- Digital knowledge context in the AI Sales Agent — it goes back to physical store context only
- Digital purchase / download email templates and digital wording in legal templates

## Database changes (all dropped)

Tables removed: `product_files`, `order_downloads`, `download_events`, `license_keys`, `product_bundle_items`, `platform_digital_categories`, `platform_digital_settings`, `store_digital_category_prefs`.

Columns removed: `stores.store_mode`, `products.digital`, `products.digital_category`, `orders.is_digital` (verified before dropping).

Function removed: `get_digital_public_settings()`.

Kept: `products.product_type` — the selector stays in the product form, so the column stays as a simple label.

The private `digital-files` storage bucket is emptied and removed.

## Technical notes

- Files deleted: `src/lib/digital.ts`, `src/lib/digital.functions.ts`, `src/lib/digital.server.ts`, `src/lib/store-mode.ts`, `src/lib/store-mode.functions.ts`, `src/components/admin/StoreModeSwitcher.tsx`, `src/components/admin/product-form/DigitalTab.tsx`, `src/components/storefront/digital/*`, `src/components/storefront/MyDownloads.tsx`, `src/components/storefront/DownloadsPanel.tsx`, `src/routes/_authenticated/admin/digital-dashboard.tsx`, `src/routes/_authenticated/admin/digital-orders.tsx`, `src/routes/_authenticated/owner/digital-categories.tsx`.
- Files edited to drop digital branches: admin `route.tsx` and `settings.tsx`, `ProductDialog.tsx` (keep the type selector, remove the Digital tab), store `index.tsx`, `checkout.tsx`, `product.$productId.tsx`, `account.tsx`, `storefront.functions.ts` (remove digital columns from selects, digital-only shipping bypass, digital category RPCs), `admin.functions.ts`, `ai-agent.server.ts`, `emails.server.ts`, `legal-templates.server.ts`.
- Order pricing keeps its server-side calculation; the `allDigital` zero-shipping branch is removed so delivery is always charged by zone.
- Order flow: courier/parcel drafting on confirm no longer has a digital skip path.
- Migration order: drop dependent tables first (`download_events`, `order_downloads`, `license_keys`, `product_bundle_items`, `product_files`, `store_digital_category_prefs`), then the platform tables, then columns and the function.
- Storefront types are regenerated after the migration, then the code cleanup lands so the build stays green.

## Order of work

1. Migration: drop digital tables, columns, function; remove the storage bucket.
2. Delete digital routes, components and libraries; strip digital branches from the shared files.
3. Verify: storefront homepage, product page, checkout, account, admin sidebar, product dialog and Winner Admin all render with no digital remnants.
