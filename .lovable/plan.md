
# Store Mode Switching System (Physical ↔ Digital ↔ Hybrid)

Today the store already has a `store_mode` column (physical/digital/hybrid) and it only affects checkout, the AI agent context and a few product fields. The admin panel itself does not change: navigation, categories, banners and the product form look the same in every mode, and switching is a silent field save with no confirmation, no loading transition and no domain handling.

This upgrades it into a full, reversible workflow. Nothing is deleted at any point — modes only show or hide.

## 1. Switching flow (Store Settings → Store Mode)

- Mode cards stay, but selecting a different mode no longer saves silently. It opens a **confirmation dialog** listing, for the target mode:
  - what becomes visible (e.g. File Management, License Settings, Download Analytics)
  - what becomes hidden (e.g. Courier, Shipping, Weight/Dimensions, COD)
  - a reassurance block: products, categories, banners, orders, customers, analytics, coupons, reviews, payment/AI/email/notification settings, subscription, billing and invoice history are all kept and reappear if you switch back
  - the domain warning when a custom domain is connected
- On confirm, a **transition overlay** runs through the four steps: Updating Store Configuration… → Preparing Store Modules… → Refreshing Dashboard… → Almost Done… Each step is tied to real work (save → domain handling → cache invalidation → nav rebuild), not a fake timer.
- Afterwards only the mode-dependent React Query caches are invalidated (store, products, categories, banners, badge counts, domains). No page reload, no sign-out, no route change.

## 2. Mode-aware navigation

`src/routes/_authenticated/admin/route.tsx` gains a `modes` tag per link:

- Physical-only: Courier Orders, Couriers, Delivery, Inventory, Low Stock Alerts
- Digital-only: Digital Orders, plus new Digital pages (File Management, Download Settings, License Settings, Download Analytics)
- Hybrid: both sets, kept inside their existing groups so nothing duplicates
- Everything else (Orders, Customers, Finance, Marketing, Theme, Billing…) is always visible

Hidden pages remain routable — a bookmarked hidden URL still works and shows a small "this module is hidden in your current Store Mode" notice instead of a 404.

## 3. Products

- Physical mode: product dialog opens as a physical product; the Digital tab and the type selector are hidden.
- Digital mode: opens as a digital product; stock, weight, dimensions and COD-related fields are hidden.
- Hybrid mode: an explicit Physical / Digital type selector at the top of the dialog drives which tabs show.
- The product list gains a type filter and a type badge in hybrid mode.
- Existing products of the "other" type are never deleted, just filtered out of the default list view in single-type modes (with a "show all types" toggle so nothing is lost from sight permanently).

## 4. Categories

Categories gain a **product type** (physical / digital / both, default `both` so existing rows keep working everywhere). The categories page shows a type selector on create/edit, and filters the list to categories usable in the current mode. Storefront category listings respect the same filter.

## 5. Banners

Banners gain a **campaign type** (physical / digital / general, default `general`). The banners page shows the type on create and filters by mode; hybrid shows all three with a filter chip. Storefront picks banners matching the active mode plus general ones.

## 6. AI Sales Agent knowledge base

The agent's store context already switches wording by mode. It will additionally scope the product knowledge it loads: physical mode feeds physical products only, digital mode digital products only, hybrid feeds both with the type labelled per item. No manual reconfiguration by the merchant, no separate settings.

## 7. Domain handling

- On a mode change, any connected **custom** domain (not the free subdomain) is automatically disconnected: its row is marked disconnected and archived with the previous state, primary flag cleared. Nothing is deleted.
- A persistent warning banner appears in the admin: "Your custom domain has been disconnected because the Store Mode changed. Please reconnect your domain for the new Store Mode."
- Store Settings → Domains shows the archived domain with a one-click **Reconnect** action that restores the record and re-runs verification.

## Technical notes

- Migration: `categories.product_type` (text, default `both`), `banners.campaign_type` (text, default `general`), `store_domains.disconnected_at` + `previous_state` jsonb, and `stores.store_mode_changed_at`. All additive with defaults, so existing rows and current queries are unaffected; GRANTs mirror the existing ones on those tables.
- New server function `switchStoreMode` (authenticated) does the mode write plus domain archiving in one call and returns the domain-disconnect result for the UI warning.
- New shared helper module extends `src/lib/digital.ts` with mode→module visibility maps, used by nav, product dialog, categories and banners so the rules live in one place.
- No existing route paths, API signatures or query keys change; all new behaviour is additive and defaults to today's behaviour for physical stores.
