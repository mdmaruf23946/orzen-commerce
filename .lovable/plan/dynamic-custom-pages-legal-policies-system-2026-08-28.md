# Dynamic Custom Pages & Legal Policies System

Merchants get one place to write every informational and legal page; the storefront renders those pages on clean URLs and the footer links to them.

## What the merchant gets

A new **Pages & Content** section in the Merchant Panel with a list of 9 pages:

- Quick Links: About Us, Contact Us, Track Order, Blogs, Shop
- Customer Policies: Privacy Policy, Terms & Conditions, Return & Refund Policy, Shipping Policy

Each page has:
- Custom page title
- Rich text editor (bold, italic, headings, lists, quotes, links) — same editor used in the product builder
- Show/hide toggle (hidden pages disappear from the footer)
- SEO description field
- "Generate starter content" button that fills legal pages from the store's business info (reuses the current generator, but the merchant's edits always win)
- Live "view page" link

The old **Legal & Info Pages** screen is replaced by this one. All existing generated content is migrated in as the starting text so nothing is lost.

Note: Track Order and Shop are functional pages, so their editors only control the heading/intro text shown above the built-in tracking form and product grid.

## What shoppers get

New storefront pages, available both on the store subpath and on the store's own domain/subdomain:

| Page | URL |
|---|---|
| About Us | `/about-us` |
| Contact Us | `/contact-us` |
| Shop | `/shop` |
| Track Order | `/track-order` |
| Blogs | `/blogs` |
| Privacy Policy | `/privacy-policy` |
| Terms & Conditions | `/terms-conditions` |
| Return & Refund Policy | `/return-refund-policy` |
| Shipping Policy | `/shipping-policy` |

- Each page renders the merchant's saved content in a clean, branded article layout with store theme colors, breadcrumb and a "Back to store" button.
- Pages with no content yet show a polished placeholder template (title, friendly message, contact block) instead of a blank page — never a broken screen.
- `/shop` is a dedicated product listing page: full grid, search, category filter and sort.
- `/contact-us` shows the merchant's content plus a working contact form.
- Every page has its own SEO title/description, canonical URL and social preview tags.

## Footer

Footer "Quick Links" and "Customer Policies" columns are wired to these routes with in-app links (no full page reloads), and hidden pages are omitted automatically.

## Technical notes

- New table `public.store_pages`: `store_id`, `page_key`, `title`, `content_html`, `seo_description`, `is_published`, timestamps; unique on (`store_id`, `page_key`). GRANTs for `anon` (read published only), `authenticated`, `service_role`; RLS: public read of published rows, owner/staff write via `has_store_access`.
- Data migration backfills rows from `store_legal_info.pages` for existing stores.
- Public read via a new security-definer RPC `get_store_page(_slug, _page_key)` (mirrors `get_store_legal_page`), called from a public server fn in `src/lib/store-pages.functions.ts`; merchant CRUD via `requireSupabaseAuth` server fns.
- Content is sanitized on save (server-side allowlist) before storage to avoid unsafe HTML on storefronts.
- Merchant route: `src/routes/_authenticated/admin/pages.tsx` (sidebar entry replaces "Legal & Info Pages"); `admin/legal.tsx` removed and redirected to the new page.
- Storefront routes: `src/routes/store/$slug/{about-us,contact-us,shop,blogs,privacy-policy,terms-conditions,return-refund-policy,shipping-policy}.tsx`, plus root-level equivalents for custom domains resolving the slug from the host (existing `privacy-policy.tsx`, `terms.tsx`, `refund-policy.tsx`, `shipping-policy.tsx`, `about.tsx`, `contact.tsx` are repointed at the new data source; old URLs keep working via redirects).
- Existing `/store/$slug/track-order` is kept and gains the editable intro block.
- Shared components: `StorePageLayout` (rendered content + fallback template) and reuse of `RichTextEditor`.
