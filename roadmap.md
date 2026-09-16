# Production Supabase Migration Roadmap

## Status
- [x] User's own Supabase project created & verified (orzen-commerce, ref rljisleyqluoexmtncos, Seoul, was empty)
- [x] Management access token saved (PROD_SUPABASE_ACCESS_TOKEN)
- [x] Schema applied — all 253 migrations from supabase/migrations, then parity fixes:
  - store_invoice_settings.order_type text NOT NULL DEFAULT 'physical' (existed only on live DB)
  - email_queue_dispatch() + email_queue_wake() (only on live DB; bodies reference the Lovable preview URL + vault secret email_queue_service_role_key + pgmq queues — must be repointed/recreated at config step)
  - generate_invoice_no(uuid, text DEFAULT 'physical') correct 2-arg version (single-arg overload dropped)
  - rls_auto_enable() + ensure_rls event trigger (platform helper) dropped for parity
- [x] Schema verification vs Lovable Cloud — EXACT MATCH: columns hash c14270f0... (2362), funcs hash 36008e1c... (93), policies (494), triggers (118), views (1), enums (61); tables identical (182) + migration_log tracking table.

## Tasks
1. [x] **Auth users migration** — 6 auth.users + 6 identities copied with password hashes (confirmed_at/identities.email are generated cols, excluded). Sessions/refresh_tokens intentionally NOT copied (JWT secret differs).
2. [x] **Data migration** — pg_dump --data-only of public (triggers disabled during load, re-enabled after; target truncated first to drop migration seed rows). Fixed drift found during load: store_invoice_settings PK -> (store_id, order_type) + order_type CHECK.
3. [x] **Verification** — 182 tables / 1344 rows identical; constraints 535=535, indexes 416=416 (no missing/extra/differing); merchant codes A000001..A000005 intact; merchant_code_seq=5 both; wallet total 180.00 both; orders 24; auth users 6.
4. [x] **Storage migration** — 5 buckets recreated (all private, no size limits): digital-files, service-deliverables, service-uploads, store-assets, subscription-invoices. 284 objects (76,279,022 bytes) copied to store-assets; name+size hash 1caff6ac... identical both sides; 29 storage.objects policies already present from migrations; sample download verified (JPEG, 147485 bytes).
5. [x] **Config** — pgmq queues + vault secret + email_queue_dispatch/wake repointed to https://orzen.top; pg_cron schedules; auth site URL/redirects/providers.
6. [x] **Cloudflare switch (2026-09-16)** — live Worker `orzen-commerce` (account 255163c0…, zone orzen.top) rebuilt with VITE_SUPABASE_* = rljisleyqluoexmtncos and redeployed via `wrangler versions upload` → `versions secret bulk` → `versions deploy @100%` (version e31340b0). Secrets now on the Worker: SUPABASE_URL/PROJECT_ID/PUBLISHABLE_KEY (+VITE_ copies), SUPABASE_SERVICE_ROLE_KEY, CREDENTIALS_ENCRYPTION_KEY, LOVABLE_API_KEY, PUBLIC_SITE_ORIGIN=https://orzen.top. Service-role key present ⇒ secure-forwarding to orzen-commerce.lovable.app is now OFF; Cloudflare is fully independent. Verified: orzen.top 200, client bundle points at rljisleyqluoexmtncos, sitemap 200, store subdomains render real products.
7. [ ] **Remaining** — Meta/Facebook webhook callback URL should be set to https://orzen.top/... in the Meta app (user action); merchant login/order/Messenger/email smoke test by the user.

## Rules
- No destructive change to Lovable Cloud, ever (stays as dev/backup).
- Data/config steps to the NEW project proceed only after user approval per roadmap promise.
- Never print secrets.

## 2026-09-16 (later) — production rollback incident
A Lovable "Publish" (or other build using the default Lovable Cloud .env) deployed Worker version 235c4074 at 14:41 UTC, which reverted the browser bundle to the OLD Supabase (dqhfxvhzagitytpvildw) while server secrets stayed on the new project → "Unauthorized: Invalid token" on /auth and merchant panel not loading.
Fix: rebuilt with production VITE_SUPABASE_* and deployed version 6e582b88 at 100%. Verified live chunk client-Dt0IOu2g.js → rljisleyqluoexmtncos.
RULE: never publish orzen.top from the Lovable Publish button. Always redeploy through the wrangler procedure in mem://features/production-migration.

## New task (2026-09-16)
8. [x] **Trial expiry enforcement** (done 2026-09-16: expire_due_subscriptions + hourly cron on both DBs; PlanLockGate blocks panel; deployed worker version 4ea48ea1) — 3-day trial must actually end: after trial_ends_at the store loses all access (no auto-drop to Free). Merchant sees a blocking screen with "Activate Free plan" button or upgrade to a paid plan. Applies to every account, new and existing. No plan active = no panel access.

9. [x] **Winner Admin Panel audit & fixes** (done 2026-09-16, worker version 0154bc34) — fixed AI Admin → Notifications infinite update crash; built real Store Health page (per-store plan/activity/catalogue/customers/domains + health score) and AI Usage page (7/30/90d requests, tokens, cost, per-store & per-model tables, 30d chart, CSV); dashboard Sparkline empty-state guard. Both new owner server fns verify owner then read platform-wide via admin client. Swept all 62 owner routes — no console errors, no 4xx/5xx.
10. [x] **Recurring production login mismatch** — restore orzen.top to the production backend, add guarded production deployment, improve stale-session recovery, and expose browser/server database identity parity in Deployment Health.
