## Store Customer Authentication System (Per-Store Isolated)

Build a self-contained customer auth system for storefronts, fully separate from the existing Supabase `auth.users` (which is only for store owners / Winner Admin). Customers belong to exactly one store; the same email/phone may re-register in a different store without conflict.

---

### 1. Database (new migration)

**`store_customers`** — one row per (store, customer):
- `id uuid pk`
- `store_id uuid → stores(id) on delete cascade`
- `full_name text`
- `email text` (nullable)
- `phone text` (nullable, normalized)
- `password_hash text` (bcrypt via `pgcrypto` `crypt()`)
- `is_active bool default true`
- `last_login_at timestamptz`
- `created_at`, `updated_at`
- CHECK: `email is not null OR phone is not null`
- Partial unique indexes: `(store_id, lower(email))` where email not null; `(store_id, phone)` where phone not null.

**`store_customer_addresses`** — saved delivery addresses (name, phone, address, area, is_default, store_id, customer_id).

**`store_customer_sessions`** — opaque session tokens:
- `token_hash text pk` (sha256 of the random token)
- `customer_id`, `store_id`, `expires_at`, `created_at`, `user_agent`, `ip`.

**Add to `orders`**: `customer_id uuid null → store_customers(id)` (nullable to preserve guest checkout).

**Add to `stores.checkout_config` jsonb**: `require_customer_login bool` (default false). No schema change if we reuse an existing jsonb column; otherwise add `require_customer_login bool default false` on `stores`.

**RLS + GRANTs**:
- `store_customers`, `store_customer_addresses`, `store_customer_sessions`: RLS enabled. No `anon`/`authenticated` policies for direct access — all storefront reads/writes go through `SECURITY DEFINER` RPCs or server functions using `supabaseAdmin` (scoped by `store_id` in code). Store-owner reads/updates: policy `is_store_owner(store_id)` for SELECT/UPDATE/DELETE on `store_customers` (owner sees their own store's customers only). Winner Admin: `has_role(auth.uid(),'owner')` policy for read-only aggregate.
- `orders.customer_id`: existing owner policies already scope by store; no change needed beyond the FK.

**RPCs (SECURITY DEFINER, search_path=public)**:
- `customer_signup(_store_id, _name, _email, _phone, _password) → jsonb {ok, customer_id, token}` — validates uniqueness in store, hashes with `crypt(_password, gen_salt('bf'))`, creates session.
- `customer_login(_store_id, _identifier, _password) → jsonb {ok, token, customer}` — looks up by email OR phone in that store, verifies with `crypt`.
- `customer_logout(_token)`, `customer_from_token(_token) → jsonb` — used by server functions to resolve the current customer.
- `customer_change_password(_token, _old, _new)`.

All RPCs revoked from `anon`/`authenticated` and only executed via server functions.

---

### 2. Server layer

**`src/lib/customer-auth.functions.ts`** (public server fns — no `requireSupabaseAuth`, resolve store from slug/host, use `supabaseAdmin` inside handler):
- `signupCustomer({ storeSlug, fullName, email?, phone?, password })`
- `loginCustomer({ storeSlug, identifier, password })`
- `logoutCustomer({ token })`
- `getCurrentCustomer({ token })` → profile + store scope check
- `updateCustomerProfile`, `changeCustomerPassword`
- `listCustomerOrders({ token })` — joins orders on `customer_id` + store_id.
- `listCustomerAddresses`, `upsertCustomerAddress`, `deleteCustomerAddress`.

Token stored client-side in `localStorage` under a store-scoped key: `orzen_customer_token__<storeSlug>` (so switching stores in same browser doesn't cross sessions).

**`src/lib/admin.functions.ts`** additions (protected via `requireSupabaseAuth` + `is_store_owner`):
- `adminListCustomers({ search? })`, `adminGetCustomer`, `adminSetCustomerActive`, `adminDeleteCustomer`, `adminGetCustomerOrders`.

**Owner** (`src/lib/owner.functions.ts`): `ownerCustomerStats()` → per-store counts only, no cross-store row mixing.

**Extend `getStoreActiveGateway` / public store fetch** to include `require_customer_login` so checkout knows the rule.

**Update `placeOrder`** in `src/lib/storefront.functions.ts`:
- Accept optional `customerToken`; if store requires login, reject when missing.
- If token present, resolve `customer_id` and stamp it on the order.

---

### 3. Storefront UI (`src/routes/store/$slug/`)

New routes (all mobile-first, matching current storefront theme tokens):
- `auth.login.tsx` — email/phone + password, forgot-password link.
- `auth.signup.tsx` — full name, email OR phone (at least one), password + confirm, validation with zod.
- `auth.forgot.tsx` — placeholder (email reset link is out of scope unless email infra exists; if not, show "contact store admin" flow — confirm below).
- `account.route.tsx` (layout with sidebar/tabs) + children:
  - `account.index.tsx` — profile summary
  - `account.orders.tsx` — order history + track
  - `account.addresses.tsx` — CRUD saved addresses
  - `account.profile.tsx` — edit name/email/phone
  - `account.password.tsx` — change password

**`src/lib/customer-session.ts`** — small client hook `useCustomerSession(storeSlug)` reading the scoped localStorage token, exposing `customer`, `login`, `logout`, `refresh`.

**Storefront header** (`store/$slug/route.tsx`): show "Login / Signup" when logged out; account menu (name, orders, logout) when logged in.

**Checkout (`checkout.tsx`)**:
- Fetch `require_customer_login` from public store data.
- If ON and no session → redirect to `/store/$slug/auth/login?redirect=/store/$slug/checkout`.
- If logged in: prefill name/phone/address from profile + saved addresses (address picker), attach `customerToken` to `placeOrder`.
- If OFF: unchanged guest flow.

---

### 4. Store Admin Panel

New route: `src/routes/_authenticated/admin/customers-accounts.tsx` (keep existing `customers.tsx` for the phone-based order-derived list; new page is for registered accounts):
- Search bar (name/email/phone).
- Table: name, email, phone, orders count, last login, status.
- Row actions: view profile drawer (details + order history), toggle active, delete (with confirm).
- Mobile: card layout.

**Settings** (`src/routes/_authenticated/admin/settings.tsx` or a new "Checkout" tab): toggle "Require Customer Login Before Checkout".

Sidebar link added under Customers group.

---

### 5. Winner Admin Panel

New route: `src/routes/_authenticated/owner/customers.tsx` — per-store customer counts, totals, growth. Read via `ownerCustomerStats()`; no row-level cross-store listing.

---

### 6. Security notes

- Passwords hashed with bcrypt via pgcrypto `crypt()` inside RPCs; plaintext never leaves the server function.
- Session tokens are 32-byte random hex; only their SHA-256 hash stored.
- Every server fn re-validates `store_id` against the slug/host — a token from Store A cannot address Store B even if replayed.
- Rate-limit login attempts (simple in-table counter or defer to later; note in follow-ups).
- No changes to Supabase `auth.users`; store owners and customers are entirely separate identity systems.

---

### Open questions before I build

1. **Forgot password**: email infra isn't set up for customer flows here. Options:
   (a) Ship auth without forgot-password (customers contact store admin who resets from admin panel — I'll add a "Reset password" action there).
   (b) Wire Lovable Emails + a per-store transactional template (adds email-domain setup).
   Which do you want?
2. **Login identifier**: single field that accepts email OR phone (auto-detected), or two separate tabs "Email" / "Phone"?
3. **Phone format**: normalize to digits-only (e.g. strip `+`, spaces) and treat `01712345678` and `+8801712345678` as the same? Assuming yes unless you say otherwise.
