# Keep the storefront out of the ORZEN app

## What is happening

The Merchant Panel's "View Store" button builds the link from the panel's own address:
`window.location.origin + /store/<slug>` → `https://orzen.top/store/<slug>`.

That URL is inside the ORZEN platform app's install scope (`/`), so when the merchant has
the ORZEN app installed, Android opens it **inside the ORZEN app** — which is why the
splash screen shows the ORZEN icon and "ORZEN - Smart Commerce" before the storefront
appears (screenshots 2 and 3).

## The fix

1. **View Store opens the store's own address.**
   The dashboard will use the store's public host — the verified primary custom domain if
   one exists, otherwise `https://<slug>.orzen.top` — instead of a path on the platform
   site. The same URL is used by the "copy store link" action. The link opens in a new tab
   (`target="_blank"`, `rel="noopener noreferrer"`), so it launches the store's own
   installed app if present, otherwise the browser — never inside the ORZEN app.

2. **The platform site never serves a storefront at its root domain.**
   When `orzen.top/store/<slug>` is requested on the real platform host, the Worker will
   permanently redirect to the store's own host. Preview/sandbox hosts and localhost keep
   working exactly as today (needed for development), and any host that cannot be resolved
   falls back to the current behaviour.

3. **Correct splash / icon.**
   Because the storefront then always loads on the store host, its own manifest
   (store name, store icon, store theme colour) is the only one in scope, so the install
   dialog and splash screen show the merchant's branding — never ORZEN's.

4. **Audit other in-panel links.** Any other Merchant Panel place that links to
   `/store/<slug>` (share, preview, SEO, landing links) is switched to the same public
   store URL helper so nothing else can pull the storefront into the platform app.

## Technical notes

- Add a shared helper that resolves a store's canonical public URL (primary verified
  `store_domains.hostname`, else `<slug>.<root_domain>` from `platform_settings`), and
  return it from the dashboard overview server function so the client does not build the
  URL from `window.location.origin`.
- `src/components/admin/dashboard/WelcomeCard.tsx`: View Store anchor gets
  `target="_blank" rel="noopener noreferrer"`.
- `src/server.ts`: for `url.hostname === rootDomain || www.<rootDomain>` and a path
  starting with `/store/<slug>`, look up the store host and issue a 301. No change for
  `.lovable.app`, `.workers.dev`, localhost, or unresolvable slugs.
- No database or storefront UI changes.
