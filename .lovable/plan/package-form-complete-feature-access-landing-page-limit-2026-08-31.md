# Package Form: Complete Feature Access + Landing Page Limit

The Winner Admin package form only shows features that exist in the platform feature-flag catalog. Facebook Page is missing there (it exists in code but was never added to the catalog), and "Landing Pages" is a single vague toggle covering two very different tools.

## 1. Split Landing Pages into two toggles

- `landing_page_create` — Landing Page Builder (create/edit standalone landing pages)
- `landing_page_connect` — Landing Page Integrations (connect external landing pages / API pushing)

Existing plans that had `landing_pages` on get both new toggles on, so nothing breaks for current merchants. The old key keeps working as a fallback during the transition.

## 2. Add the missing toggles to the catalog

These are already enforced or clearly gate-able in the Merchant Panel but are not selectable in the package form:

- Facebook Page
- WhatsApp Business (currently rides on AI Messenger)
- Messenger Inbox
- Store Themes & customization
- Custom Pages (About/Policies/Blogs)
- Store SEO tools
- Duplicate Order Protection
- Delivery Zones
- Payment Gateways (store-own gateways)
- Customer Accounts (storefront login)
- Product Reviews
- Quick / Manual order creation
- Notifications (SMS / Email / WhatsApp sending)
- Digital products, Service products, Subscription products (product types)
- Wallet & auto-renewal

Each gets a label, description, category and sort order so the Features tab stays grouped and readable.

## 3. Landing page creation limit per plan

- New `landing_page_limit` on subscription packages (0 = unlimited).
- Added to the package form's **Limits** tab alongside product/order/staff/storage limits.
- Enforced server-side when a merchant creates a landing page: over the limit returns an upgrade message, same style as the product limit.
- Shown on the merchant Billing & Plans comparison so merchants see it before upgrading.

## 4. Wire the new toggles up

For each new flag, the matching Merchant Panel page/section is gated with the existing soft-lock (English "Update" action linking to billing) and the sidebar section map is updated, so turning a toggle off in a plan actually locks that area. AI Call Center stays Coming Soon and plan-gated as before.

## Technical notes

- Migration: insert the new rows into `platform_feature_flags`; add `landing_page_limit integer default 0` to `subscription_packages`; backfill `features` jsonb of every existing package so `landing_pages` maps to both new keys.
- `src/lib/features.ts`: extend `FEATURE_KEYS` / `FEATURE_LABELS` / `PLAN_ROWS`.
- `src/lib/plan-guard.ts`: add a `landing_page` limit kind counting rows in `landing_pages` for the store.
- `src/lib/owner.functions.ts` (`upsertPackage`) and `src/routes/_authenticated/owner/packages.tsx`: accept and edit `landing_page_limit`.
- `src/lib/panel-sections.ts` + the affected admin routes: point at the new flag keys.
