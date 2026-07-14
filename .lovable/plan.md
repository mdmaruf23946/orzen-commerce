## Switch platform domain back to `orzen.top`

Replace every `orzen.com` reference introduced in the last change with `orzen.top`, so registration, admin, owner, and DNS defaults all generate `https://{subdomain}.orzen.top`.

### Files to update

1. **`src/routes/auth.tsx`** — change the `rootDomain` literal to `"orzen.top"` so the live subdomain preview reads `mystore.orzen.top`.
2. **`src/routes/_authenticated/admin/domains.tsx`** — set `rootDomain = "orzen.top"` so store admins see the correct subdomain URL.
3. **`src/routes/_authenticated/owner/domains.tsx`** — restore owner defaults/placeholders: `root_domain` → `orzen.top`, `login_host` → `admin.orzen.top`, `dns_target` → `stores.orzen.top`.
4. **`src/lib/domains.functions.ts`** — fallback `dnsTarget` → `stores.orzen.top`.
5. **`src/routes/index.tsx`** — update the marketing/app URL reference (`app.orzen.com` → `app.orzen.top`) if present.
6. **`platform_settings` row** — data update setting `root_domain`, `login_host`, and `dns_target` back to the `orzen.top` values.

### Verification
- `rg "orzen\.com"` returns no matches.
- Auth page preview shows `https://<slug>.orzen.top` while typing.
- Owner → Domains form loads with the `orzen.top` defaults.

### Out of scope
- Wildcard DNS/SSL provisioning.
- Rewriting historical `stores`/`store_domains` rows created under the previous value.
