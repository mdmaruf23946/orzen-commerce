# Platform Owner Control Center — Phased Build Plan

Complete rebuild of `/owner/*` into a professional SaaS control center. Delivered in phases across many turns so each ships working code, mobile-friendly, without huge unreviewable diffs.

## Phase 0 — Shell & Navigation (this turn)

Redesign `src/routes/_authenticated/owner/route.tsx` into a collapsible, grouped sidebar shell.

- Shadcn `Sidebar` with `collapsible="icon"`, mobile off-canvas sheet.
- Grouped sections:
  - **Overview**: Dashboard
  - **Stores**: All Stores, Health
  - **Billing**: Subscriptions, Payments, Packages, Payment Settings
  - **AI**: AI Control, Usage
  - **Integrations**: Couriers, Marketing Pixels
  - **Platform**: Features, System Settings, Users, Roles
  - **Insights**: Reports, Support, Notifications
  - **Security**: Audit, Login Logs, Backups
  - **Developer**: API, Webhooks, Logs
- Top bar: search, notifications bell, owner avatar, "Back to Admin".
- Every new nav entry maps to a route file; entries without a real page yet render a lightweight `ComingSoon` placeholder (title, description, "Request feature" button) so nav is never a dead link.
- `min-w-0` / `truncate` / `grid` guards throughout for mobile safety.

## Phase 1 — Dashboard Rebuild

Real KPI cards backed by existing tables: MRR (payments), active stores, active subs, trials, AI spend (ai_usage), 7-day revenue sparkline, recent activity feed (role_audit_log + payments + new stores).

## Phase 2 — Stores Control

Enhance `/owner/stores`: search, filter by status/plan, suspend/activate, "Login as admin" (impersonation via short-lived session — will require secure server fn + audit log), delete with confirmation, per-store usage drawer (products, orders, storage, AI tokens).

## Phase 3 — Subscription & Billing Ops

- `/owner/subscriptions`: tabs for Active / Trials / Expiring (7d) / Expired / Renewals.
- `/owner/billing`: transaction ledger, manual verification queue, refund requests, invoice viewer.
- `/owner/packages`: keep 4 canonical tiers, edit limits, features, cycle pricing, discount rules.

## Phase 4 — AI Control Center

`/owner/ai`: manage LOVABLE_API_KEY status, OpenAI/Gemini keys via `add_secret`, default model per store type, live usage & cost analytics, per-store enable toggle.

## Phase 5 — Integrations & Feature Flags

- `/owner/couriers`: provider registry, API keys, default courier.
- `/owner/marketing`: platform-wide pixel defaults (FB, GA4, GTM, TikTok, CAPI).
- `/owner/features`: global feature flag matrix — toggles a `platform_feature_flags` table read by every `FeatureGate`.

## Phase 6 — System, Users, Reports

- `/owner/system`: platform name, logo, domain, currency, timezone, email/SMS/WhatsApp providers.
- `/owner/users`: store owners list, platform admins, role assignment (writes to `user_roles`), login history.
- `/owner/reports`: revenue, subscription, growth, orders, AI usage — server-side aggregation + CSV export.

## Phase 7 — Support, Security, Notifications, Dev

- Support Center: `support_tickets`, `contact_requests`, `feedback`, `announcements` tables + inbox UI.
- Security: audit log viewer (already have `role_audit_log`), login logs, API logs, backup instructions, rate-limit config.
- Notifications: broadcast to stores (writes `platform_notices`), email campaigns, maintenance mode toggle.
- Developer: API key management, webhook registry, system logs viewer.

## Database Work (deferred to each phase)

New tables planned (created only when their phase lands, each with GRANTs + RLS scoped to owner role via `has_role(auth.uid(), 'owner')`):

- `platform_feature_flags` (flag_key, enabled, description)
- `support_tickets`, `ticket_messages`
- `contact_requests`, `feedback`
- `announcements`, `broadcast_messages`
- `login_history`
- `api_keys` (owner-issued), `webhooks`, `webhook_deliveries`
- `payment_transactions` (if not sufficient in existing `payments`)
- `refund_requests`
- `platform_settings` (singleton key-value)
- `courier_providers`, `courier_credentials`
- `marketing_pixel_defaults`

## Guarantees Every Phase

- Mobile-first: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`, `min-w-0`, `truncate`, `overflow-x-auto` on tables.
- No horizontal scroll on 320/360/375/414 widths.
- Reusable primitives: `OwnerPageHeader`, `StatCard`, `DataTable`, `EmptyState`, `ComingSoon`, `ConfirmDialog`.
- All server access via `createServerFn` + `requireSupabaseAuth` + `has_role(_, 'owner')` check.
- No animations beyond default shadcn transitions.

## This Turn's Deliverable

Phase 0 only: new grouped sidebar shell, `ComingSoon` component, and all placeholder route files so the nav tree is complete and navigable. No schema changes. Subsequent turns implement one phase each.

Confirm to proceed with Phase 0, or tell me a different phase to start with.
