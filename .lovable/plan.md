# Service Order Experience — Full Build

Goal: the order details page becomes type-aware. Service orders get their own workflow (progress, meetings, communication, updates, deliverables, revisions, review) and never show any courier/shipping element. Subscription orders get their own view too. Physical and digital stay as they are.

## 1. Database

New tables (all store-scoped, owner-managed, read by shoppers only through a security-definer function keyed by order id):

- `service_workflow_settings` — per store: which stages are enabled (`request_submitted`, `pending_review`, `confirmed`, `consultation_scheduled`, `in_progress`, `waiting_for_client`, `revision`, `completed`, `closed`), default revision count, whether client cancel is allowed, response-time promise, support channels (whatsapp / messenger / email / phone / live chat).
- `service_order_progress` — order_id, stage, note, created_at (the service timeline; replaces courier stages).
- `service_order_meetings` — date/time, timezone, platform (meet/zoom/teams/office), link, address, password, notes.
- `service_order_assignments` — assignee name, role (staff/freelancer/agent), avatar, contact channels, last_reply_at.
- `service_order_updates` — admin-published updates: status label + note + timestamp.
- `service_order_deliverables` — file path in a new private `service-deliverables` bucket, kind (source/zip/invoice/license/warranty/credential/key), secret value for credentials/keys, expiry, download limit, download count.
- `service_order_revisions` — request text, status (requested/in_progress/delivered/rejected), deadline, admin response.
- `service_order_reviews` — rating, review text, screenshot path, recommend flag.

Also add a `service_order_state` column-set to `orders.fulfillment_meta` (stage, remaining revisions) — no new orders columns needed; advance/balance already stored there.

Access: owner policies via `is_store_owner(store_id)`; shopper access exclusively through new definer RPCs (`get_public_service_order`, `get_public_subscription_order`) that take the order id, plus signed URLs for deliverable downloads issued by a server function.

`get_public_order` will be extended to also return `order_type`, `email`, `company`, `country`, and `fulfillment_meta` so the page can branch by type.

## 2. Server functions

- `src/lib/service-order.functions.ts` — shopper reads (progress, meeting, assignment, updates, deliverables, revisions, review status, payment summary), request revision, submit review, request cancel, issue signed download URL (enforcing expiry + limit).
- `src/lib/service-order-admin.functions.ts` — owner writes: set stage, add timeline note, publish update, schedule/edit meeting, assign staff, upload deliverables, respond to revisions, toggle enabled stages.
- `src/lib/subscription-order.functions.ts` — shopper read for subscription orders: status, plan, billing cycle, start date, renewal/next payment date, amount, trial info, usage/limits from product meta, cancel/manage request.

## 3. Storefront page

`src/routes/store/$slug/order.$orderId.tsx` becomes a thin dispatcher on `order_type`:

- `physical` → existing courier tracking (unchanged)
- `digital` → existing digital view (unchanged)
- `service` → new `ServiceOrderView`
- `subscription` → new `SubscriptionOrderView`

New components under `src/components/storefront/order/service/`:

1. `SuccessHeader` — animated check, "Service Request Submitted Successfully", service ID, order date/time, payment status badge.
2. `ServiceProgress` — stepper built from the store's enabled stages, current stage highlighted.
3. `ServiceTimeline` — status + time + admin note entries.
4. `MeetingCard` — date/time/timezone, platform badge, link or office address, password, notes, live countdown, Join Meeting button. Hidden when no meeting.
5. `CommunicationCard` — assignee name/role/avatar, response time, last reply, buttons for WhatsApp / Messenger / Live chat / Email / Call (only channels the store enabled).
6. `PaymentCard` — status, paid, remaining, method, transaction id, invoice download, payment history (reuses `PaymentTimeline`), plus Complete Payment / Retry / Upload proof when unpaid or balance due.
7. `ServiceDetailsCard` — service name, package, plan, estimated delivery, delivery type, included features, selected add-ons, custom requirements.
8. `ClientInfoCard` — name, phone, email, business name, website, intake answers, uploaded files, notes.
9. `AdminUpdatesFeed` — published updates with date/time/status/note.
10. `DeliverablesCard` — secure download list with expiry/limit, credentials/keys revealed on demand.
11. `RevisionsCard` — remaining count, request form, history, deadline, admin response.
12. `ReviewCard` — star rating, review text, screenshot upload, recommend toggle (after completion).
13. `ActionBar` — status-driven buttons: Contact Support, Chat with Admin, Download Invoice, View Files, Join Meeting, Complete Payment, Request Revision, Place New Order, Cancel Request.

Nothing courier-related is imported into this view: no courier block, tracking id, delivery address, delivery zone, parcel status, or shipping timeline. The order summary in the service view drops the Address row and shows service line items only.

`SubscriptionOrderView` shows subscription status, plan/package, billing cycle, start date, renewal date, next payment amount, usage/limits, invoice list, and manage/cancel actions.

## 4. Admin side

New "Service workflow" panel inside the existing order details drawer (only for `order_type = 'service'`):
- Stage selector using the store's enabled stages, with note
- Publish update
- Schedule/edit meeting
- Assign staff/freelancer/agent
- Upload deliverables (with expiry + download limit), add credentials/keys
- Review and respond to revision requests
- Read client intake answers and uploaded files

Plus a "Service workflow" section in Service Checkout settings to enable/disable stages, set default revision count, response time, support channels, and allow-cancel.

## 5. Notifications

Reuse the existing order notification outbox so stage changes and published updates trigger the store's configured email/SMS/WhatsApp notification settings.

## Technical notes

- All new tables follow the project's grant → RLS → policy order; shopper access is definer-RPC only, so no anon grants on the new tables.
- Deliverable downloads use short-lived signed URLs from a private bucket, with server-side expiry and limit checks before signing.
- Files uploaded by clients keep using the existing `service-uploads` bucket and `service_order_files`.
