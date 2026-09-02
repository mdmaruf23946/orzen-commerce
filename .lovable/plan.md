# Domain lifecycle: real Cloudflare cleanup + idle auto-release + reconnect

Today a landing subdomain is created on Cloudflare when the page is published or
the merchant sets a label, but several removal paths leave the hostname alive on
Cloudflare. Deleting a landing page removes only the database row. Connecting a
custom domain leaves the old subdomain attached. And nothing ever reclaims hosts
for pages nobody uses. This plan closes all of that and adds a one-click
Reconnect.

## 1. Deleting always cleans Cloudflare

- Deleting a landing subdomain (Domains tab, "Remove") already detaches from
  Cloudflare — keep it, but make failures visible instead of silent.
- Deleting a whole landing page detaches every hostname it owns first:
  its subdomain (removed from Cloudflare and from the database) and any custom
  domain attached to it (detached from Cloudflare SSL for SaaS, but the domain
  row itself stays in Domain settings so the merchant keeps ownership of it and
  can attach it elsewhere).

## 2. Custom domain live → subdomain retires automatically

- Landing pages: when a custom domain attached to the page becomes active
  (verified + SSL issued), the page's `*.orzen.top` subdomain is released:
  removed from Cloudflare and marked `released` in the database, not deleted.
  The Domains tab then shows it as "Released — Reconnect".
- Storefronts: when a store custom domain becomes active and is made the store's
  primary host, the store's `<slug>.orzen.top` subdomain is detached from
  Cloudflare the same way, with the same Reconnect control on the Domains page.
- Retirement happens both at the moment the domain is confirmed active (the
  status-check / sync path) and in the background job below, so a domain that
  goes active between checks is still handled.

## 3. Idle landing pages lose their hosts (page is never deleted)

Activity = a public visit to the page, an order through it, or a merchant edit.

```text
last activity ──15 days──> warning ──30 days──> hosts released
```

- Day 15: a warning is recorded and shown on the landing page card and inside
  the builder ("No visits for 15 days — this page's domain will be disconnected
  on <date>"), plus a merchant notification.
- Day 30: the page's subdomain and any attached custom domain are removed from
  Cloudflare. The landing page, its content, its subdomain label and its domain
  attachment all stay in the database, marked `released`.
- Any activity before day 30 clears the warning.
- Reconnecting resets the clock.

## 4. Reconnect button

- Every released host (landing subdomain, landing custom domain, store
  subdomain) shows a **Reconnect** button with the reason it was released.
- Pressing it re-registers the hostname on Cloudflare, flips the status back to
  active/issuing, and clears the idle timers. No re-entry of DNS records is
  needed for subdomains; for custom domains the existing DNS still points at us,
  so it comes back on its own.

## Technical notes

- Migration:
  - `landing_pages`: `last_visit_at`, `last_activity_at`, `idle_warned_at`,
    `hosts_released_at`.
  - `landing_page_domains` and `store_domains`: `released_at`,
    `release_reason` (`custom_domain_live` | `idle` | `manual`), and `released`
    accepted as a status value.
  - Index on `landing_pages(last_activity_at)` for the sweep query.
- `src/lib/cloudflare-pages.server.ts` already exposes `detachSubdomain`;
  `cloudflare-ssl.server.ts` exposes `detachCustomHostname`. A new
  `src/lib/domain-lifecycle.server.ts` wraps both with
  `releaseHost(...)` / `reattachHost(...)` used by every path, so behaviour is
  identical wherever it is triggered.
- Server functions added/updated in `landing-builder.functions.ts` and
  `domains.functions.ts`: `deleteLandingPage` (cleanup first),
  `reconnectLandingDomain`, `reconnectStoreSubdomain`, plus retirement inside
  `syncCustomHostname` / `setPrimaryDomain`.
- Activity capture: the public landing page loader bumps `last_visit_at`
  (throttled, fire-and-forget so rendering is never blocked); builder saves and
  landing orders bump `last_activity_at`.
- New cron route `src/routes/api/public/cron/domain-idle.ts`, `CRON_SECRET`
  protected like the existing cron endpoints, run daily: emits warnings at 15
  days and releases hosts at 30.
- No change to Content, Order Form, Design, Coding or Settings behaviour.
