
# Redesigned Store Registration

## New form (`src/routes/auth.tsx`, sign-up mode)

Fields, in order:
1. Owner Name — required, 2–80 chars
2. Store Name — required, 2–80 chars
3. Store Subdomain — required, `^[a-z0-9-]+$`, 3–40 chars, no leading/trailing hyphen
4. Email
5. Password (min 6)
6. Confirm Password (must match)

Sign-in mode stays as it is today (email + password only).

### Subdomain UX
- Auto-generate from Store Name via existing `slugify()` on every keystroke, until the user manually edits the subdomain field (then stop auto-syncing).
- Sanitize input on change: lowercase, replace invalid chars with `-`, collapse repeats.
- Debounced (350 ms) availability check via a new **public** server fn `checkStoreSlugAvailable({ slug })` that uses a server-side publishable Supabase client and queries `stores` for that slug. Requires a narrow anon SELECT policy exposing only `id, slug` (see Data section).
- Status pill next to the field: `Checking…` / `Available` (green) / `Already taken` (red) / `Invalid format` (amber). Submit disabled unless status is `Available` and passwords match.

### Submit flow
1. Client-side Zod validation of all fields.
2. Final `checkStoreSlugAvailable` call before submit (guards against races; server fn below also re-checks).
3. `supabase.auth.signUp({ email, password, options: { data: { owner_name, store_name, store_slug }, emailRedirectTo: origin + "/admin" } })`.
4. On success (session returned — email confirmation is off in this project), call new authenticated server fn `createMyStoreWithSlug({ storeName, slug, ownerName })`.
5. Navigate to `/admin` (Store Admin Dashboard).

## Server functions (`src/lib/admin.functions.ts`)

### `checkStoreSlugAvailable` (new, public)
- `createServerFn({ method: "GET" })` with `.inputValidator(z.object({ slug: z.string().regex(/^[a-z0-9-]+$/).min(3).max(40) }))`.
- Uses a server publishable client (pattern from `tanstack-supabase-integration`) to `select id from stores where slug = ? limit 1`.
- Returns `{ available: boolean }`.

### `createMyStoreWithSlug` (new, authenticated)
- `.middleware([requireSupabaseAuth])`, input: `{ storeName, slug, ownerName }` (Zod, same slug regex).
- If a store already exists for `userId`, return it (idempotent — handles retries).
- Re-check slug uniqueness; if taken, throw `Slug already taken`.
- Fetch template via `fetchTemplate(supabase)`; insert `stores` row with `owner_user_id`, `name = storeName`, `slug`, `status: "active"`, and `...templateStoreFields(tpl)`.
- `seedStoreFromTemplate(supabase, store.id, tpl)` (non-fatal on failure, same as `getMyStore`).
- Also upsert `ownerName` into user metadata via `supabase.auth.updateUser({ data: { owner_name } })` (best-effort, ignore error).
- Return the created store.

`getMyStore` stays as-is (auto-create fallback for users that arrived through some other path).

## Data (single migration)

- Add a narrow anon SELECT policy on `stores` limited to `slug` lookups. Simplest: policy `USING (true)` but the server publishable client only ever projects `id, slug` in `checkStoreSlugAvailable`. To keep exposure minimal, prefer a `SECURITY DEFINER` RPC `is_slug_taken(_slug text) returns boolean` granted to `anon, authenticated`. Use the RPC from `checkStoreSlugAvailable` — no new table policy needed.
- No schema changes to `stores`.

## Page styling

Keep the existing card layout in `src/routes/auth.tsx` but:
- Widen sign-up card to `max-w-md`, keep sign-in at `max-w-sm`.
- Tight spacing (`space-y-3`), inputs `h-10`, single-column, works down to 320px.
- Subdomain field renders as `Input` with a right-aligned suffix `.<host>` (read-only visual hint) and the availability pill below.
- Preserve existing branding, no new fonts/colors.

## Files touched

- `src/routes/auth.tsx` — new sign-up form, subdomain live-check, post-signup store creation.
- `src/lib/admin.functions.ts` — add `checkStoreSlugAvailable`, `createMyStoreWithSlug`.
- Migration — add `is_slug_taken(text)` SECURITY DEFINER function + grants.

## Out of scope

- Custom subdomain DNS wiring (slug is stored; hosting mapping is a separate feature).
- Changing sign-in mode.
- Email confirmation flow changes.
