# Fix images on https://orzen.top (Cloudflare Pages)

## What I verified

- `https://orzen.top/` renders fine (HTML, 200) — so the SSR worker itself is healthy and the domain/SSL is fine.
- `https://orzen.top/api/img/test.png` returns **HTTP 500** (worker crash), while the same path on the Lovable-hosted build returns a correct **404**.
- Every image in the app (products, banners, category images, brand/store logos, favicons) is served through the `/api/img/...` proxy route.
- That route downloads from the **private** `store-assets` storage bucket using the **service-role key**, read from `process.env.SUPABASE_SERVICE_ROLE_KEY`.
- The storage bucket is private (`public = false`), so without that key the proxy cannot read anything.

So this is not a CORS, cache, mixed-content or DNS problem: the image endpoint crashes on Cloudflare because the server-side key it needs is not present in that deployment. On Lovable Cloud the service-role key is not something you can copy into Cloudflare, so the fix is to make image serving work **without** it.

## The fix

**1. Make the image path key-free**

- Move the one existing `returns/` upload (customer return-evidence photo) into a new **private** bucket `return-evidence`, and point the return/exchange upload + read code at that bucket. This keeps genuinely sensitive media private.
- Flip `store-assets` to a public bucket (it will then hold only product images, banners, category images, brand logos, platform branding and template media — all things already shown publicly on storefronts).
- Rewrite `/api/img/$` so it fetches the public storage URL over plain HTTPS (built from `SUPABASE_URL` / `VITE_SUPABASE_URL`, both already available in the Cloudflare build) instead of using the admin client. All existing guards stay: image extensions only, blocked folders (`digital`, `private`, `downloads`, `deliverables`, `invoices`, `secure`, plus `returns`), `nosniff`, no path traversal. If a service-role key *is* present, it still uses it first.
- Paid digital files and service deliverables stay in their own private buckets behind entitlement-checked signed URLs — untouched.

**2. Domain wiring**

- Add `orzen.top` and `www.orzen.top` to the store-domain/root-domain settings so canonical URLs, sitemap, robots, SEO tags and OAuth redirects all resolve to the live domain.
- Replace the hard-coded `https://orzen-commerce.lovable.app` origin used for Messenger image/product links with the configured root domain, so Facebook can fetch product images from `orzen.top`.
- Add permissive image CORS headers (`access-control-allow-origin: *`) on `/api/img` responses so the assets also work from the Messenger/Meta crawler and any subdomain storefront.

**3. Cloudflare-side steps (I will write these into `docs/CLOUDFLARE_SETUP.md`)**

- Pages → Settings → Variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` for **both** Production and Preview (VITE ones must exist at build time).
- Compatibility flag `nodejs_compat` with a compatibility date of `2025-04-01` or later, so `process.env` is populated in the worker.
- SSL/TLS mode **Full (strict)**, Always Use HTTPS on, Automatic HTTPS Rewrites on (kills any mixed-content case).
- Speed → Optimization: leave **Polish/Mirage off** for now (they can rewrite image responses), and make sure no Cache Rule or Page Rule bypasses/short-circuits `/api/*`.
- Redeploy after setting variables — Pages does not re-run the build when variables change.

## Verification

After deploy I will curl `https://orzen.top/api/img/<a real product image path>` and confirm a `200` with an `image/*` content type, then load a storefront product page and confirm images render.

## Note

If you would rather not make `store-assets` public at all, the alternative is to host `orzen.top` on Lovable's own hosting (Project Settings → Domains), where the service-role key is injected automatically and images already work today. Tell me if you prefer that and I will plan it that way instead.
