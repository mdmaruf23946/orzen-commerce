# Production Supabase Migration Roadmap

## Status
- [x] User's own Supabase project created & verified (orzen-commerce, ref rljisleyqluoexmtncos, Seoul, empty)
- [x] Management access token saved (PROD_SUPABASE_ACCESS_TOKEN)

## Tasks
1. **Schema export** — collect full DDL from Lovable Cloud (tables, enums, functions, triggers, policies, grants, views, indexes, extensions, cron, publications)
2. **Schema apply** — run DDL in the new project in dependency order
3. **Auth users migration** — copy auth.users with password hashes, email confirmations
4. **Data migration** — copy all table data in FK order
5. **Verification** — row counts per table match; merchant/customer codes; wallet balances; RLS sanity checks
6. **Storage migration** — buckets + bucket policies + file copy
7. **Auth config** — site URL, redirect URLs, SMTP, providers (Google etc.)
8. **Cloudflare switch** — point live site env vars at the new project (only with explicit user approval, last step)

## Rules
- No destructive change to Lovable Cloud, ever (it stays as dev/backup).
- Each major step reported to user; migration steps to the NEW project proceed per user's request.
- Never print secrets.
