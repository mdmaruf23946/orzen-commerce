# Landing Pages Builder (Store Admin)

A new, separate section that lets a store admin turn any existing product into a standalone, conversion-focused landing page — with its own content, its own URL/domain, and orders flowing into the normal Orders section.

The current "Landing Pages" section (external integrations that receive orders by API/webhook) stays untouched and is renamed **Landing Page Integrations** in the sidebar. The new builder is a separate item: **Landing Pages**.

## Flow

```text
Landing Pages  →  Create Landing Page  →  Select Product  →  Generate
                                                              ↓
                        Editor (sections)  →  Preview  →  Publish
```

On generate, product data (name, images, price, discount price, description) is **copied once** into the landing page as its own content snapshot. Editing the product later never changes a published landing page; the editor shows a "Re-sync from product" button the admin must click.

## Page sections (generated, each toggleable)

Hero (image + name + price/discount + CTA), Product Images, Features with icons, Benefits, Product Details, Customer Reviews, FAQ, Contact Info, CTA band, Order Form, Footer.

Each section can be turned on/off and its text, images and colors edited from a simple form editor (no drag-and-drop). Mobile-first responsive design, fast static-ish render, no storefront chrome or storefront theme dependency.

## Management

Per landing page: Edit, Preview (draft-only URL), Publish/Unpublish, Duplicate, Delete, copy URL, Domain settings. Multiple landing pages per store, one product each (a product may have several pages).

## Domains

Each landing page owns its own domain settings, independent from the storefront:

1. **Subdomain** — `<slug>.orzen.top`, validated against reserved labels, existing store subdomains, and other landing pages.
2. **Custom domain** — connected per landing page with the same DNS verification + Cloudflare SSL flow the storefront domains already use.

Edge routing resolves the incoming host: store host → storefront (unchanged), landing-page host → that landing page. Unpublished pages return 404 on their public host.

## Orders

The order form is admin-configurable per page: choose which fields appear (name, phone, address, area/zone, quantity, note, email) and which are required, plus payment method (COD by default). Submission goes through the existing landing-page order intake, so orders appear in Orders with source `landing_page`, respect stock/duplicate-order protection, and trigger the normal notifications.

## Technical notes

- New tables: `landing_pages` (store_id, product_id, slug, status, content JSONB snapshot, theme JSONB, form config JSONB, published_at), `landing_page_domains` (landing_page_id, hostname, kind subdomain|custom, verification/SSL columns mirroring `store_domains`). Full GRANTs + owner-scoped RLS; anonymous read only through a `get_public_landing_page(_host_or_slug)` security-definer RPC that returns published pages and never exposes cost price.
- Server functions in `src/lib/landing-pages-builder.functions.ts` (owner CRUD, generate-from-product, publish, duplicate, resync) with `requireSupabaseAuth`; domain verification reuses `src/lib/cloudflare-domains.functions.ts` helpers.
- Public routes: `src/routes/lp/$slug.tsx` (renders published page from the RPC) and `src/routes/_authenticated/admin/landing-pages-builder.*` for admin. `src/lib/tenant-host.ts` + `resolve_domain` extended to return `{ kind: 'landing_page', slug }` and rewrite to `/lp/<slug>`.
- Order POST reuses `intakeLandingPageOrder` in `src/lib/landing-pages.server.ts` via a public route under `src/routes/api/public/lp/$id/orders.ts` with Zod validation and rate/duplicate guards.
- Sidebar: new "Landing Pages" entry; existing entry relabeled "Landing Page Integrations". No changes to products, storefront, inventory or store settings.

## Out of scope

A/B testing, analytics dashboards beyond order counts, drag-and-drop layout editing, multi-product landing pages.
