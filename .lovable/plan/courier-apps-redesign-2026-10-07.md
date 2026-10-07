# Courier Apps redesign

Redesign "Courier Integration" as an app-based system, the same way Marketing & Targeting Apps works. Logos and name logos stay exactly as they are now.

## What the merchant will see

```text
Orders & Delivery
├── All Orders
├── Courier & Shipping
│   ├── Courier Orders      (unchanged)
│   ├── Courier Parcels     (unchanged)
│   └── Delivery Zones      (unchanged)
├── Courier Apps
│   ├── Courier Overview    (all connected couriers combined)
│   ├── Steadfast           (only when connected)
│   ├── Pathao Courier      (only when connected)
│   └── REDX                (only when connected)
└── Returns & Exchanges
```

1. **Courier Apps page** (the hub; always visible)
   - One card per courier (Steadfast, Pathao, RedX, Paperfly, eCourier, S.A. Paribahan, Sundarban).
   - Each card shows the current logo and name logo, the provider name, a Connected / Not connected badge, and a **Connect** button (or **Manage** when already connected).
   - Same card style as the Marketing & Targeting Apps page.

2. **Dynamic courier menus**
   - A courier gets its own menu item, named after it, only while it is connected (credentials saved and switched on).
   - When you disconnect it, the menu item goes away and the courier shows again as "Connect" on the hub.
   - You can connect more than one courier. Each one gets its own menu and is managed separately.

3. **Each courier's own workspace** (it holds only that courier's data)
   - **Overview:** that courier's parcels only: total, in transit, delivered, returned/cancelled, COD amount, recent parcels.
   - **Integration:** the existing connection form for that courier only (credentials, test connection, sync, default courier, disconnect). It is the same form as today, moved here.
   - No other courier's settings or parcels ever appear inside it.

4. **Courier Overview**
   - Combined summary across all connected couriers: total parcels, delivered, in transit, returned, COD, plus a per-courier breakdown row with each logo.

5. **No changes to current work**
   - Courier Orders, Courier Parcels, Delivery Zones, Send-to-courier, labels, COD and saved credentials keep working exactly as they do now.
   - The old "Courier Setup" link (/admin/couriers) redirects to the Courier Apps page, so old bookmarks still work.

## Technical details

- New registry `src/lib/courier-apps.ts` (pattern of `marketing-platforms.ts`): built from the existing `COURIERS` metadata. It includes `useCourierConnections()`, which reads `store.couriers` through the existing `getMyStore` query. A courier counts as connected when `enabled` is on and its required credentials are present; manual couriers count when they are enabled.
- Routes:
  - `admin/couriers.apps.tsx` (hub)
  - `admin/couriers.overview.tsx` (combined)
  - `admin/couriers.$provider.tsx` (workspace with `?section=overview|integration`)
  - `admin/couriers.index.tsx` redirects to the hub, and `couriers.tsx` becomes a layout keeping the existing `FeatureGate`
  - An unknown or unconnected `$provider` redirects to the hub.
- The workspace Integration section reuses the existing `CourierCard` and the existing save/test/sync/disconnect server functions, saving the full couriers object as today. There are no schema or server changes.
- Overview numbers come from the existing parcel data, filtered by courier key and store-scoped through the current admin functions. If no suitable read exists, one small read-only server function is added.
- Sidebar (`admin/route.tsx`): remove "Courier Setup" from Courier & Shipping and add a "Courier Apps" group with Courier Overview plus dynamic connected-provider items, mirroring how marketing platforms are injected. Icons come from the existing brand logos.
- Add a rule to AGENTS.md (keeping it within the size budget): courier menus are registry-driven and appear only while connected.
- Verify in the preview: the hub cards, connecting a courier adds its menu, disconnecting removes it, and the existing pages are unchanged. Then typecheck.
