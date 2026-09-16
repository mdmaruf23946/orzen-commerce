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
1. **Auth users migration** — copy auth.users with password hashes + identities (ON HOLD for user approval of data step)
2. **Data migration** — copy all public table data (disable triggers during load, re-enable after)
3. **Verification** — row counts per table; merchant/customer codes; wallet balances; sample logins
4. **Storage migration** — buckets + bucket policies + file copy
5. **Config** — pgmq queues + vault secret (email_queue_service_role_key) + repoint email_queue_dispatch/wake URL to production origin; pg_cron schedules (recover-messenger-jobs etc.); auth site URL + redirects + SMTP + providers
6. **Cloudflare switch** — point live site env vars at new project (only with explicit user approval, last step)

## Rules
- No destructive change to Lovable Cloud, ever (stays as dev/backup).
- Data/config steps to the NEW project proceed only after user approval per roadmap promise.
- Never print secrets.
