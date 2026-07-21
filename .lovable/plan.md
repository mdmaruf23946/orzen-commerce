# Legal & Business Info Generator

Add a new Store Admin module that collects business information once and auto-generates SEO-ready legal/info pages served under the store's own domain/subdomain.

## 1. Database

New table `public.store_legal_info` (one row per store):
- store_id (FK, unique)
- store_name, owner_name, support_email, contact_phone
- business_address, website_domain, country, currency
- generated_at, pages_version (int)
- pages: jsonb `{ privacy, terms, refund, shipping, contact, about, data_deletion }` — each `{ title, description, html, updated_at }`

RLS: owners manage their own row; public RPC `get_store_legal_page(_slug, _page)` returns a single page for the storefront render.

## 2. Server functions (`src/lib/legal.functions.ts`)

- `getMyLegalInfo` — load row for current store owner
- `saveAndGenerateLegal({ info })` — validates via zod, upserts info, renders all 7 pages via a template renderer, stores in `pages` jsonb, bumps version
- `regenerateLegalPage({ key })` — regenerates a single page
- Auto-hook: when store name / domain / support email / phone / address change (in existing store settings), call generator to refresh copy (URLs stay stable because they're route-driven).

Template renderer lives in `src/lib/legal-templates.server.ts` — pure functions that take `info` and return `{ title, description, html }`. Meta-compliant boilerplate for Privacy, ToS, Refund, Shipping, Contact, About, Data Deletion.

## 3. Public routes (per-store)

Add file routes under `src/routes/store/$slug/`:
- `privacy-policy.tsx`, `terms.tsx`, `refund-policy.tsx`, `shipping-policy.tsx`, `contact.tsx`, `about.tsx`, `data-deletion.tsx`

Each route:
- Loader calls public RPC to fetch the page for the slug
- `head()` sets Meta Title, Description, Open Graph, canonical (self-referencing absolute URL built from request origin)
- Renders sanitized HTML in a shared `<LegalPage>` layout
- 404 fallback with `notFoundComponent`

On custom domain / subdomain the same routes resolve because storefront routing already normalizes host → slug.

## 4. Admin UI (`src/routes/_authenticated/admin/legal.tsx`)

Sidebar entry "Legal & Info Pages" (near SEO).

Sections:
- **Business Information form** — all 8 fields with zod validation
- **Generate button** — runs `saveAndGenerateLegal`; shows success toast
- **Generated URLs list** — 7 rows, each with:
  - Path label (`/privacy-policy` etc.)
  - Green "Generated" badge (if page exists)
  - Copy URL, Open Page (new tab), Regenerate buttons
- Mobile-first responsive cards

## 5. Auto update

Hook into existing `updateStoreSettings` / store profile save: if name/domain/email/phone/address changed and legal info exists, call regenerator server-side so pages refresh without touching URLs.

## 6. Future expansion

`pages` is a jsonb map keyed by page slug; adding a new page = add a template + a route file + one entry in the admin URL list. No schema change needed.

## Technical details

- Sanitize generated HTML with a small allowlist (headings, paragraphs, lists, links) — templates produce safe HTML only, no user HTML injected.
- Canonical + og:url built from `getRequestHeader('host')` inside `head()` via loader-provided origin.
- Copy button uses `navigator.clipboard`.
- Regenerate triggers a single-page rerender through `regenerateLegalPage`.
