# Subscription Module Refactor — One Place to Manage

Goal: remove the duplicate standalone Subscriptions area. Orders → Subscription tab becomes the only place to manage subscription orders, and global subscription configuration moves into Store Settings.

## 1. Remove the standalone Subscriptions area

- Delete the "Subscriptions" entry from the Store Admin sidebar.
- Delete the page `/admin/subscriptions` (dashboard, subscriber list, KPI strip, filters, settings tab) and the standalone `SubscriptionDrawer` component.
- Keep the existing `/admin/subscription` page — that is the store's own platform plan/billing page, not customer subscriptions, and it stays untouched.
- Add a redirect from the old `/admin/subscriptions` URL to `/admin/orders` on the Subscription tab so existing bookmarks and links don't 404.

No orphan routes or unused components are left behind.

## 2. Orders → Subscription tab becomes the controller

The Orders page already has a Subscription tab with subscription order cards. It gets the full control set, driven by the real subscription record linked to each order:

- Card-level quick actions: View, Confirm, Cancel.
- Details panel actions based on current status: Activate, Suspend, Resume, Expire, Extend, Renew now, Auto-renew on/off, Cancel (at period end) / Cancel now, Mark invoice paid.
- Filters on the Subscription tab: status, plan, customer, and a renewal date range (moved over from the old page, so nothing is lost).

## 3. Subscription details inside the order drawer

Opening "View" on a subscription order shows a dedicated Subscription section in the order details drawer (the same way service orders get their workflow panel), containing:

- Customer information and plan name
- Billing cycle, order date, activation date, expiry date, next renewal date
- Renewal status, payment status, auto-renewal status
- Renewal history and invoice history (with per-invoice detail: subtotal, tax, setup fee, period)
- Activity timeline (subscription events)
- Internal admin notes
- Status-aware action buttons and a "Generate/Download invoice" link

Physical, digital and service orders keep their existing drawers unchanged.

## 4. Subscription Settings move into Store Settings

- Remove the Settings tab from the deleted subscriptions page.
- Add a "Subscription Settings" section on `/admin/settings`, grouped as:
  - Billing: default billing cycle, auto-renewal default, setup fee, tax %
  - Trial: allow free trial, trial days, grace period
  - Renewal: renewal reminder days, failed-payment retry policy
  - Checkout: invoice prefix, success redirect URL, allow Cash on Delivery
  - Notifications: email, SMS, WhatsApp
  - Policies: subscription terms, cancellation policy, refund policy
  - Access: default activation method (manual approval / automatic approval)
- All fields save through the existing subscription settings server functions; the "Access" activation-method field maps to the store's existing subscription order-confirmation preference (auto/manual) already stored on the store, so no duplicate switch exists.

## 5. Product-type isolation

Subscription logic stays in its own components and server functions. The Orders page remains a unified shell that loads type-specific cards, filters and detail panels per product type. Nothing in subscription handling touches physical, digital or service order flows.

## 6. Data safety

No database migration and no data changes. All existing tables (`store_subscriptions`, `store_subscription_invoices`, `store_subscription_events`, `store_subscription_settings`, `store_subscription_notifications`) and the customer-facing subscription pages, checkout, and renewal cron stay exactly as they are. Only admin UI location and navigation change.

## Technical notes

- Reuse `src/lib/subscriptions-admin.functions.ts` as-is; add one server function to fetch a subscription (plus invoices and events) by `order_id`, since the Orders tab keys off orders while the subscription record keys off its own id.
- New `src/components/admin/subscriptions/SubscriptionOrderPanel.tsx` holds the detail + action UI, rendered from `OrderDetailsDrawer` when `order_type === "subscription"`.
- New `src/components/admin/settings/SubscriptionSettingsSection.tsx` replaces `SubscriptionSettingsPanel.tsx`, rendered inside `src/routes/_authenticated/admin/settings.tsx`.
- Delete `src/routes/_authenticated/admin/subscriptions.tsx`, `src/components/admin/subscriptions/SubscriptionDrawer.tsx`, `src/components/admin/subscriptions/SubscriptionSettingsPanel.tsx`; remove the nav entry in `src/routes/_authenticated/admin/route.tsx`.
