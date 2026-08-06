# Inventory Module Redesign — One Dynamic Page

Today `/admin/inventory` is a single physical-only table (products + stock movements). It will become one page whose entire content switches with the product type, using the existing global Product Type Scope so the tab choice is shared with Products/Orders.

## Shared shell

- Tabs at the top: Physical | Digital | Service | Subscription (no "All" — inventory is always type-specific). Bound to the existing global type scope, so switching is instant, no reload, and the URL keeps `?ptype=`.
- Below the tabs: a KPI strip + a searchable, mobile-first card/table list, both rendered from the type-specific data set. Only fields that exist for the selected type are rendered — no placeholder or empty cards.
- One React Query key per type, so switching tabs fetches only that type's data.

## Physical

KPIs: Total stock units, Stock value (cost x qty), Low stock count, Out of stock count.

Per product row: Cost price, Selling price, Profit/unit, Stock, Status badge (In stock / Low / Out).

Sections: product list + Stock Movements log.

Actions: Adjust Stock (existing dialog, extended with reason presets: Purchase/Restock, Damage/Loss, Admin Correction), View movement history for one product, Export inventory (CSV).

Stock Movements log columns: Date & time, Product, Order ID (link when present), Movement type, Quantity (+/-), Before → After, Reason, Updated by. Movement types shown: Order Confirmed, Order Cancelled, Return Received, Exchange Completed, Purchase Added, Manual Adjustment, Damage/Lost, Admin Correction.

## Digital

No stock anywhere. Per product: Total sales (paid order items), Total downloads, Remaining downloads (or "Unlimited"), License type, File version, File size, Last download, Delivery status (instant/manual).

KPIs: Products, Total sales, Total downloads, Active entitlements.

Actions: Update file (opens the product's digital step), Change download limit (writes back to the product's digital rules), View download history (per-product log drawer).

## Service

No stock. Per product: Active orders, Pending orders, Completed orders, Daily/weekly capacity, Available slots today, Booking status (open/paused), Average completion time.

KPIs: Services, Active orders, Pending orders, Paused bookings.

Actions: Update capacity, Pause booking, Resume booking.

## Subscription

No stock. Per product: Active subscribers, Trial users, Expired, Cancelled, Renewal rate, Next-renewal count (next 30 days), Monthly revenue, Billing cycle.

KPIs: Active subscribers, Trials, MRR, Renewals due (30d).

Actions: View subscribers (drawer, links to the Subscriptions module), Manage plans (opens the product editor), Export subscribers (CSV).

## Technical notes

- New server functions in a dedicated `src/lib/inventory.functions.ts`: `inventoryPhysical`, `inventoryDigital`, `inventoryService`, `inventorySubscription`, plus `updateServiceCapacity`, `setBookingStatus`, `updateDigitalDownloadLimit`. All auth-gated and store-scoped like the existing ones. Existing `listInventory` / `listStockMovements` / `adjustStock` stay and are reused for Physical.
- Data sources already present: `products` (+`meta`), `stock_movements`, `order_items`/`orders`, `digital_entitlements`, `digital_downloads`, `digital_licenses`, `store_subscriptions`, service order tables.
- Two small schema additions:
  1. `stock_movements`: add nullable `qty_before` / `qty_after`, written by `adjustStock` and the order/return paths, so the log can show Before → After for new movements (older rows show "—").
  2. Service capacity and booking pause are stored in `products.meta.service` (`capacity_per_day`, `capacity_per_week`, `booking_paused`) — no new table needed.
- "Updated by" comes from the existing `stock_movements.created_by`, resolved to the owner/staff name; system-generated rows show "System".
- Page split into `src/components/admin/inventory/PhysicalInventory.tsx`, `DigitalInventory.tsx`, `ServiceInventory.tsx`, `SubscriptionInventory.tsx`, with `src/routes/_authenticated/admin/inventory.tsx` as the tab shell. The existing FeatureGate on the route stays.
