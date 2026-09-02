# Landing page on the subdomain shows an old version

## What I found (verified, not guessed)

The page data in the database is current. The live subdomain is not.

- Database, page `classic-white-sneakers`: theme `Athletic Crimson` , primary colour `#e11d48`, saved today.
- `https://classic-white-sneakers.orzen.top/` returns HTML with primary colour `#16a34a` (the old default) and none of the new section markup.
- The Lovable-published build of the same page returns `#e11d48` — the correct, current design.

So the code that serves `orzen.top` and its subdomains is an **old build**. `orzen.top` is hosted on a Cloudflare Pages project that builds from GitHub; that project has not rebuilt since the recent landing-page work (themes, section library, design code). Preview and the Lovable-published URL run the new code, the Cloudflare deployment runs the old one — which is exactly the mismatch you see.

No HTTP caching is involved: the live response carries no cache headers and is not being served from Cloudflare's cache.

## Fix

1. **Redeploy the Cloudflare Pages project** so `orzen.top` runs the current code (new deployment from the latest commit; if the Git connection stopped picking up commits, reconnect the repository/branch in the Pages project). This alone makes the subdomain match the preview.

2. **Add a build-version endpoint** — `GET /api/public/version` returning the build timestamp and commit — so we can check in one request whether a host is running the current build instead of comparing colours by hand.

3. **Explicitly mark landing and storefront HTML as never-cached** in `src/server.ts` (`Cache-Control: no-store` on tenant HTML responses, hashed assets keep their long cache). This guarantees that once a merchant edits and publishes, the very next browser load shows the new content even if a proxy or CDN in front of the site tries to cache pages.

4. **Verify after deploy**: fetch the subdomain and confirm the served HTML carries the page's saved palette and the current section markup, plus the version endpoint reporting the new build.

## Technical notes

- Diagnosis commands used: direct fetch of the subdomain vs the Lovable-published host, plus a database read of `landing_pages.theme` for the same slug.
- Item 3 touches only the response-header path in `src/server.ts` for tenant HTML (host resolves to a store or landing tenant); asset routes in `_headers` / `_routes.json` stay unchanged.
- Item 2 is a small public server route under `src/routes/api/public/`, no secrets exposed.
