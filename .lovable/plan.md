# Customer Account & Order System Upgrade

Rebuild the storefront customer area so every screen adapts to the product type of the order (Physical, Digital, Service, Subscription), with strict isolation between types.

## 1. Account dashboard

- Profile card: avatar (initials fallback), name, email, phone, membership badge, Edit profile.
- Quick cards: Orders, Wishlist, Addresses, Active Services, My Subscriptions, Downloads, Settings.
  A card is hidden when the store has no products of that type and the customer has no records of it (services / subscriptions / downloads are conditional; Orders, Wishlist, Addresses, Settings always show).
- Account menu: Personal Information, Change Password, Saved Addresses, Payment Methods, Notifications, Privacy & Security, Help & Support, Logout.
  - Payment Methods = read-only list of methods used on past orders (no card vaulting).
  - Privacy & Security = session info, password, data-deletion request link.
  - Help & Support = store contact channels (phone / email / WhatsApp / chat) from store settings.

## 2. Orders list

Each order row becomes a card: product thumbnail, product name (+ "and N more"), product-type badge, order ID, date, total, payment status, order status, and a View details button.

Filters: type tabs (All / Physical / Digital / Service / Subscription), status filter (Pending, Completed, Cancelled, Active, Expired), sort (Newest / Oldest), and text search over order ID and product name.

## 3. Order details, per type

The detail route keeps one entry point and branches by `order_type`.

- Physical: timeline, shipping address, courier + tracking number, payment status, items, invoice. Actions: Cancel order (only pre-confirmation), Download invoice, Contact seller.
- Digital: product name, license key, files, download count / remaining, activation instructions, payment status, purchase date. Actions: Download, Copy license key, Contact seller. When unpaid: downloads hidden, message "Waiting for payment confirmation."
- Service: service name, package, current stage, assigned staff, latest update, timeline, uploaded requirement files, deliverables, revision count, payment status. Actions: Upload files, Download deliverables, Request revision, Contact provider, Cancel (pre-confirmation only).
- Subscription: plan name, status (Active / Pending / Expired / Cancelled / Paused), billing cycle, start / renewal / expiry dates, auto-renew, next payment, payment method. Actions: Renew, Upgrade plan, Change billing cycle, Cancel, Manage. When active, an Access / Dashboard button.

Isolation is enforced by rendering type-specific view components only — no shipping on digital/subscription, no downloads on physical/service, no tracking on service/subscription.

## 4. Cancel rules

Cancellation allowed only for `pending`, `awaiting_payment`, `awaiting_confirmation`. Disabled for confirmed, processing, working, completed, delivered, and active subscriptions (those use Cancel subscription instead). Always confirm in a dialog before cancelling.

## 5. Dedicated pages

- Downloads: digital purchases only — image, name, purchase date, remaining downloads, Download button.
- Active Services: service name, progress, assigned staff, latest update, Manage service.
- My Subscriptions: plan name, status, expiry, next billing, renewal status, with Manage / Renew / Upgrade.

## 6. Notifications

Customer notification feed page listing: order confirmed, payment confirmed, service started, service updated, revision requested, files delivered, digital ready, subscription activated, renewal reminder, subscription expired. Read from the existing notification records; unread count badge on the account menu.

## 7. Empty states

"No orders yet." / "No active services." / "No subscriptions found." / "No digital products purchased." — each with an illustration-free, single-CTA card back to the shop.

## Technical notes

- `listCustomerOrders` (src/lib/customer-auth.functions.ts) currently returns only id/invoice/status/subtotal. It will be extended to also return `order_type`, `payment_status`, first item image + name, item count, and to accept type / status / sort / search parameters.
- New customer server functions: `cancelMyOrder` (state-guarded), `listMyNotifications` + `markNotificationsRead`, `listMyPaymentMethods` (derived from orders).
- Account route `src/routes/store/$slug/account.tsx` gains tabs: `services`, `notifications`, `payments`, `privacy`, `support`; existing overview/profile/orders/downloads/subscriptions/addresses/wishlist/password stay.
- Order detail branches through new `PhysicalOrderView` and `DigitalOrderView` components alongside the existing `ServiceOrderView` and `SubscriptionOrderView`; shared pieces (status badges, type badge, cancel dialog, contact-seller sheet) go in `src/components/storefront/order/`.
- Reuses existing functions: `getOrderDigitalAccess`, `requestDigitalDownload`, `getServiceOrder`, `requestServiceRevision`, `requestServiceCancel`, `listMySubscriptions`, `cancelMySubscription`, `renewMySubscription`, `setMyAutoRenew`.
- No schema change is expected unless cancellation needs an audit column; if so it will be a single additive migration.
