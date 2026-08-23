# Store Panel Full Audit — Findings and Fix Plan

Verified by reading every route under the store admin panel (55 pages), the sidebar definition, the plan-gating helpers (`FeatureGate`, `assertPlan`), and the plan/limit fields used by billing. Below is a serial list of what is missing, half-done, or inconsistent. Nothing has been changed yet.

## A. Missing features (built into plans but no UI/logic exists)

1. **Staff Management module missing.** Plans expose `staff_limit` and a `staff` feature flag, and the billing page shows "Staff Limit", but there is no `/admin/staff` page and no way to invite, list, or remove staff. Today `staff` is only referenced by service-order assignment text. Store owners are paying for a limit that cannot be used.
2. **Plan limits are never enforced.** `product_limit`, `order_limit`, `customer_limit`, `storage_mb` are displayed on Billing & Plans but no create path checks them — a store on a 50-product plan can add unlimited products. Only feature flags are enforced (`assertPlan`).
3. **No support/ticket surface for store admins.** `support_tickets` / `ticket_messages` exist and the platform owner has a Support page, but the store panel has no way to open or reply to a ticket.
4. **AI image generation in the product form is a stub** — the tab is literally labelled "AI (Coming Soon)" and does nothing.

## B. Half-done: feature gating is inconsistent

5. **Pages that call plan-gated server functions but have no UI gate**: Marketing (server enforces `pixel`), Invoice Templates (`invoice`), Customers notes (`customer_notes`), Bulk actions bar (`bulk_actions` enforced server-side only). Result: the page opens normally, then the save throws a raw error instead of showing the upgrade card.
6. **Channel pages not gated at all**: Messenger Inbox, WhatsApp Integration, WhatsApp Inbox, Handoff Queue, AI Recommendations. Only `/admin/messenger` is gated with `ai_messenger`, so the same feature is reachable through ungated sibling pages.
7. **Manual Call Center (`/admin/call-center`) has no plan gate**, while AI Call Center does. Both should follow the plan.
8. **Landing Pages / Landing Page Integrations have no plan gate and no feature key**, even though they are a premium capability.
9. **`fraud_checker` and `custom_domain` are cast as `as any`** in `assertPlan` calls because they were added to `FEATURE_KEYS` later — works, but the type safety is bypassed; `ai_call_center` and a landing-pages key should be added properly too.

## C. Navigation and page-level problems

10. **`/admin/parcels` is orphaned** — a full courier-parcel page exists but is not linked from the sidebar or from Courier Orders, so it is unreachable in the UI.
11. **Sidebar is a flat 45-item list.** Groups are defined (`Orders`, `Products`, `Customers`, …) but the item list itself is rendered flat, which makes the panel hard to navigate on mobile (the current viewport is 404px).
12. **Duplicate-looking entries** with no explanation for the user: Messenger / Messenger Inbox, WhatsApp / WhatsApp Inbox, My Subscription / Billing & Plans, Delivery / Couriers / Courier Orders / Parcels, Landing Pages / Landing Page Integrations.
13. **37 of 55 admin routes have no `head()` metadata** (no title/description), so browser tabs and history all read the root title.

## D. Smaller correctness issues

14. **Payment Gateway: "Test connection" and "Test webhook" are inert until the gateway is saved** — they only show an info toast. Acceptable, but there is no hint in the UI before clicking.
15. **`/admin/subscriptions` is a legacy redirect** to Orders; it is dead weight and can be removed once no links point to it.
16. **Store panel has no notification inbox entry in the sidebar** — `/admin/inbox` is only reachable from the header bell.

## Proposed fix order

Phase 1 — correctness and reachability (low risk, no schema change)
- Add `head()` metadata to all admin routes (11, 13).
- Link `/admin/parcels` from Courier Orders or add it to the sidebar; remove the dead `/admin/subscriptions` route (10, 15).
- Group the sidebar into the existing collapsible sections and add the Inbox entry (11, 12, 16).
- Disable + tooltip the payment gateway test buttons before save (14).

Phase 2 — consistent plan gating
- Add `ai_call_center` and `landing_pages` to `FEATURE_KEYS`/labels, drop the `as any` casts (9).
- Wrap Marketing, Invoice Templates, Messenger Inbox, WhatsApp, WhatsApp Inbox, Handoff Queue, AI Recommendations, Manual Call Center, Landing Pages in `FeatureGate` with the matching key, and add the missing server-side `assertPlan` where absent (5, 6, 7, 8).

Phase 3 — enforcement and missing modules
- Enforce `product_limit` / `order_limit` / `storage_mb` server-side in the product create, order create, and upload paths, with a friendly "উপগ্রেড করুন" message linking to Billing & Plans (2).
- Build Staff Management: `store_staff` table + roles, invite/remove UI, `staff_limit` enforcement, gated by the `staff` feature (1).
- Add a store-admin Support page over the existing `support_tickets` tables (3).
- Either implement AI product image generation via the AI gateway or remove the "Coming Soon" tab (4).

## Technical notes

- Gating uses `hasFeature()` in `src/lib/features.ts` for the UI and `assertPlan()` in `src/lib/plan-guard.ts` for server functions; every new gate must add both sides, otherwise the RPC stays callable directly.
- Limit enforcement belongs in `plan-guard.ts` as a new `assertLimit(supabase, userId, kind)` helper that counts existing rows, so product/order/staff/storage all share one code path.
- Staff Management needs a new table with RLS scoped to `store_id` plus GRANTs; it is the only phase that touches the database schema.
