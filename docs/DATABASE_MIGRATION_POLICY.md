# Database migration policy

- `supabase/migrations/` is the only authoritative schema source. Every schema change is a new, timestamped SQL file there; existing files are never edited, renamed or deleted.
- `drizzle/` is a read-only mirror. App code, tests, CI and the production deploy script do not use Drizzle.
- `drizzle.config.ts` refuses to load unless the platform migration URL is present, so a manual `drizzle-kit generate|push|pull|migrate` stops immediately.
- Never reset, drop or re-baseline a database. Production (Cloudflare + own project) receives migrations only through the guarded production procedure, after review.
- Data fixes are not schema migrations; they need explicit owner approval.
