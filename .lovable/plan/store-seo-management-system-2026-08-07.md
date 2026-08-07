# Store SEO Management System

Rebuild the Store Admin "SEO Settings" page into a tabbed, fully functional per-store SEO system, and wire the saved values into the live storefront (meta tags, sitemap, robots.txt, JSON-LD).

## Tabs

```text
Basic  |  Social  |  Search  |  Verification
```

**Basic**
- SEO Title, Meta Description (with live character counters and Google-style preview)
- Favicon (reuses the existing store icon/favicon uploader)
- Canonical URL (auto-filled from the store's primary domain / subdomain, overridable)
- Search engine visibility: Index / No Index

**Social**
- Open Graph Title, Open Graph Description, Open Graph Image
- Twitter/X image (falls back to OG image when empty)
- Live social card preview (Facebook + X style)

**Search**
- Sitemap: automatic per-store sitemap with a link to the store's live `/sitemap.xml`, entry counts (home, categories, products), and a "sitemap enabled" toggle
- Robots.txt: automatic content preview plus an optional custom extra-rules box
- SEO Health panel: Title, Description, Sitemap, Schema, Favicon, Search Console — each shown as OK / Missing / Warning with a one-line hint

**Verification**
- Google Search Console verification meta tag
- Bing Webmaster verification meta tag
- Both rendered into the storefront `<head>` for that store only

Meta Keywords is removed from the form, from the save schema, and from the storefront head output.

## Automatic SEO fallback

Every value follows: **Custom SEO → Store defaults (name, description, logo, icon) → Automatic** (generated from store name, category names and product counts). The admin form shows the auto-generated value as placeholder text so the admin can see what visitors get if they leave the field blank.

## Structured data (JSON-LD)

Generated from data that already exists, injected per page on the storefront:
- Store layout: Organization + WebSite (with SearchAction)
- Product page: Product + Offer (price, currency, availability from stock) + BreadcrumbList
- Category/listing views: BreadcrumbList

## Multi-store isolation

All SEO data stays in the existing `stores.seo` jsonb column, scoped by store, saved through the existing owner-authenticated store update path. Sitemap, robots and verification tags are resolved from the requested host/slug, so one store can never read or affect another's SEO.

## Technical notes

- `seoSchema` in `src/lib/admin.functions.ts`: drop `keywords`; add `canonical_url`, `noindex`, `og_title`, `og_description`, `twitter_image_url`, `google_verification`, `bing_verification`, `sitemap_enabled`, `robots_extra`.
- New `src/lib/seo.ts` (shared, browser-safe): `resolveStoreSeo(store, ctx)` returning the resolved title/description/images/robots, plus JSON-LD builders. Used by both the admin preview and the storefront head so they never drift.
- New public server function in `src/lib/seo.functions.ts`: `getStoreSeoHealth` (counts of indexable products/categories) for the Health panel, and a host→store resolver reused by sitemap/robots.
- New routes: `src/routes/sitemap[.]xml.ts` and `src/routes/robots[.]txt.ts` — resolve the store from the request host (existing `resolve_domain` logic), fall back to the platform sitemap on the root domain. A slug-scoped `store/$slug/sitemap[.]xml.ts` is added so subdomain-less stores are still covered.
- `src/routes/store/$slug/route.tsx` head(): use the resolver — canonical, og:*, twitter:card/image, robots noindex, verification meta tags, favicon, plus Organization/WebSite JSON-LD.
- `src/routes/store/$slug/product.$productId.tsx` head(): per-product canonical, og:*, Product/Offer/Breadcrumb JSON-LD.
- Admin page `src/routes/_authenticated/admin/seo.tsx` rewritten with the existing `TypeFilterTabs` pattern (same as Marketing) and split into `src/components/admin/seo/{BasicTab,SocialTab,SearchTab,VerificationTab,SeoHealth,Previews}.tsx`. Each tab saves through one `updateSeo` call that merges only its own keys, so saving one tab never clears another.
- No new tables, no duplicated product/category data.

## Verification

- Save each tab independently; reload and confirm values persist per store.
- Two stores side by side: different titles, sitemaps and verification tags.
- `/sitemap.xml` and `/robots.txt` return store-scoped content on a store host.
- Product page source contains Product + Offer JSON-LD and correct canonical.
