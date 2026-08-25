# Employee Management & RBAC for the Merchant Panel

A complete team system: merchants create employee accounts, assign a role and per-section permissions, and employees sign in through their own login to a filtered Merchant Panel that only shows and allows what they are permitted to use. Every important action is recorded in an Activity Log.

## What the merchant gets

**Employees page (`/admin/employees`)** — replaces the current basic Staff page (kept at the same place in the sidebar, renamed "Employees & Team"):

- List of employees with name, Employee ID (auto-generated, e.g. `EMP-0007`), email, role, status badge, last login.
- Add employee: name, email, phone, role, temporary password (auto-generated or typed), permissions. The account is created and ready to log in immediately.
- Edit employee: details, role, and permissions.
- Status management: Active / Suspended / Invited. A suspended employee is blocked at login and on every API call instantly.
- Account management: reset password (set a new one, optionally force change at next login), and remove employee (revokes their access and their login).
- Search and filter by role/status.

**Roles** — a small set of built-in roles that pre-fill permissions, plus custom per-employee overrides:

- Manager — manage everything except billing, plans, staff, and store settings
- Order Agent — Orders, Courier Orders, Returns, Customers (view)
- Support Agent — Inbox, Messenger, WhatsApp, Support, Customers (view)
- Inventory Staff — Products, Categories, Inventory, Low Stock
- Viewer — read-only across allowed sections
- Custom — start blank and tick what you want

**Permissions** — auto-generated from the panel's real navigation, not a hardcoded list. Every sidebar section becomes one permission row with three levels: **No access / View only / Manage**. When a new section is added to the panel in future, it automatically appears in the permission editor. Sections the merchant's own plan does not include are shown as unavailable.

Owner-only sections are never grantable: Billing & Plans, My Subscription, Employees & Team, Domains, and Store Settings stay merchant-only.

**Activity Log (`/admin/activity`)** — a timeline of important actions by both employees and the merchant: who (name + employee ID), what (e.g. "Cancelled order PH-2026-0142"), which section, and when. Filter by person, section, and date range.

## What the employee gets

- Separate login at `/employee-login`, branded "Employee Login" (email + password). Merchants keep using the normal login.
- After signing in they land on an Employee Dashboard: a welcome card with their name/role, quick tiles for the sections they can use, and their recent activity.
- The sidebar shows only their permitted sections. Opening any other URL directly shows a clean "You don't have access to this section" screen.
- View-only permission hides create/edit/delete buttons in that section.
- Employees can change their own password from a small account menu.

## Security model

- Employees are real platform accounts, bound to exactly one store. All their data reads and writes are scoped to that store's ID — they can never see another store's data.
- Every merchant-panel server call resolves the caller's store through a single shared access helper: the merchant gets their own store, an employee gets the store they belong to, and the required section permission is verified server-side before anything runs. Hiding a menu item is never the only protection.
- Suspended or removed employees fail this check immediately, even with an old session open.
- Database row-level rules are extended so employees of a store can read/write that store's rows the same way the owner can, and nothing else. Sensitive tables (billing, subscriptions, payment credentials, employees themselves) remain owner-only.
- Passwords are handled by the platform's auth system; the merchant never sees an employee's password, only sets/resets it.

## Technical notes

- **Database migration** (one migration, with GRANTs, RLS and policies):
  - Extend `store_staff` into the employee model: `employee_code` (unique per store), `permissions jsonb`, `must_change_password`, `last_login_at`, `created_by`, and index on `user_id`.
  - New `staff_activity_log` table: `store_id`, `actor_user_id`, `actor_staff_id`, `actor_name`, `section`, `action`, `entity_type`, `entity_id`, `summary`, `meta jsonb`, `created_at`.
  - New security-definer helpers: `staff_store_id(uuid)` returning the store an auth user is an active employee of, `has_store_access(store_id)` = owner OR active employee, and `staff_can(store_id, section, level)`.
  - Update existing store-scoped table policies from `is_store_owner(store_id)` to `has_store_access(store_id)` for the operational tables (orders, order_items, products, categories, inventory, customers, returns, coupons, banners, messenger/whatsapp, call center, etc.), leaving owner-only tables untouched.
- **Section registry** (`src/lib/panel-sections.ts`): derived from the existing sidebar `links`/`groupDefs` in `src/routes/_authenticated/admin/route.tsx`, mapping each route to a section key, label, group, owner-only flag, and optional plan `FeatureKey`. Both the permission editor and the server guard read this one file, so it stays in sync automatically.
- **Access layer** (`src/lib/store-access.server.ts`): `resolveStoreAccess(supabase, userId)` → `{ storeId, isOwner, staff, permissions }`, plus `requireSection(access, section, "view" | "manage")`. Existing `myStoreId(...)` helpers in the merchant server-function files are switched to call it — same behaviour for owners, employee support added. No business logic changes.
- **Server functions** (`src/lib/employees.functions.ts`): list/create/update/suspend/remove employee, reset password, list activity. Employee auth accounts are created and updated through the privileged admin API inside the handler, after verifying the caller owns the store; employee emails are also invited/confirmed so they can sign in right away.
- **Activity logging**: a `logActivity(...)` helper called from the mutating merchant server functions (orders status/cancel, product create/update/delete, customer edits, returns decisions, coupon changes, employee management). Writes are best-effort and never block the action.
- **Routes**: `/employee-login` (public), `/admin/employees`, `/admin/activity`, and an employee home rendered by `/admin` when the signed-in user is an employee. The admin layout gains an access context (`useStoreAccess`) used to filter the sidebar and to gate each page with an `AccessGate` wrapper.
- Merchant-only UI (billing, subscription, employees, settings, domains) is filtered out for employees both in the sidebar and at the route level.

## Out of scope

- No changes to merchant login, storefront customer accounts, plans, or existing business logic.
- Employee count continues to respect the plan's staff limit already enforced by the plan guard.
