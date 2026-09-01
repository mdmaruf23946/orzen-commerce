# Landing page domains — Cloudflare-connected subdomains + central custom domains

Goal: landing page subdomains actually go live on Cloudflare, and custom domains
are set up in one place (the Domain settings page), then simply searched and
attached to a landing page.

## What exists today

- Store Domains page (`Domains` in the merchant menu) has three sections:
  Store Subdomain, Custom Domains (already supports multiple), Primary Domain.
- Landing builder has a Domains tab with its own "Subdomain" and its own
  "Custom domain" add form, writing to a separate `landing_page_domains` table.
- The Worker already routes any resolved host to `/lp/<slug>` for landing pages,
  so routing itself is in place.
- Store subdomains call Cloudflare (`ensureSubdomainAttached`) when created;
  **landing page subdomains do not** — this is why `page.orzen.top` never
  comes alive even though it is saved.

## Plan

### 1. Landing subdomain → real Cloudflare hostname

- On save, register `<label>.<root>` as a Worker custom domain through the same
  Cloudflare call the store subdomain uses (idempotent PUT), and detach the old
  hostname when the label changes.
- Persist the attach result: status (`active` / `pending` / `error`) and the
  failure text when Cloudflare rejects it.
- Subdomain card shows live status (Provisioning / Live / Failed with reason),
  a "Retry" button, and the final URL as a clickable link.
- Availability check before save: format rules, reserved labels, clash with an
  existing store slug or another landing page.

### 2. Custom domains live only in the Domain settings page

- The Domains page gets a new section, **Landing Page Domains**, next to the
  existing store Custom Domains section. Merchants can add several custom
  domains there, each with its own DNS instructions (CNAME target, apex A
  record, ownership TXT), "Check now" verification, status pill and remove.
- Verification and Cloudflare SSL use the existing store-domain flow, so a
  domain added here behaves exactly like a store domain: verified → SSL issued
  → active.
- Each domain in that section shows what it is currently attached to
  ("Not attached" or the landing page name), so the merchant sees the whole
  picture in one place.

### 3. Landing builder Domains tab becomes attach-only

- The "add custom domain" form is removed.
- Replaced by a search box listing the store's own verified/active custom
  domains (filtered as you type). Selecting one and pressing **Connect** makes
  the landing page live on that domain immediately.
- Shows the connected domain with an open link and a **Disconnect** action.
- A domain already attached to another landing page is shown as unavailable
  with the page it belongs to; connecting a second domain to the same page is
  allowed (all of them serve the page, one is the canonical link).
- Empty state links straight to the Domains page: "Add a domain in Domain
  settings first".

### 4. Routing

- A custom domain attached to a landing page serves that page at clean root
  URLs (`mydomain.com/` → the landing page), while unattached store domains
  keep serving the storefront. Host resolution checks the attachment first.
- Landing subdomains keep working as they do now.

## Technical notes

- Migration on `store_domains`: nullable `landing_page_id` (FK, ON DELETE SET
  NULL) plus an index; attaching = setting that column, detaching = clearing it.
  A domain with `landing_page_id` set is excluded from storefront resolution.
- `resolve_host_kind` updated to return `kind = 'landing'` for a verified
  `store_domains` row that has `landing_page_id`, before the storefront lookup.
- Existing `landing_page_domains` custom rows are migrated into `store_domains`
  with the attachment set, so nothing currently live breaks. The
  `landing_page_domains` table stays in use for subdomains only.
- New/updated server functions: `attachDomainToLandingPage`,
  `detachDomainFromLandingPage`, `listAttachableDomains`, and a Cloudflare
  attach step + status fields inside `setLandingSubdomain`.
  `addLandingCustomDomain` is retired from the UI.
- Cloudflare automation needs `CF_API_TOKEN`, `CF_ZONE_ID`, `CF_ACCOUNT_ID`,
  `CF_WORKER_NAME` present in the Worker env. When they are missing, the UI
  says so plainly and falls back to manual DNS instructions instead of failing
  silently.

## What you do after this ships

1. Confirm the Cloudflare secrets above exist for the Worker (needed for
   automatic subdomain + SSL provisioning).
2. Add custom domains in Domain settings, point the DNS records shown there,
   wait for "Active", then attach one to a landing page from its Domains tab.
