# Landing Page Section Library — 18 New Sections

Adds 18 new reusable sections to the existing Section Library. The current 28 sections, their editors, renderers, ordering and AI behaviour stay untouched.

## New sections and their fields

Content-only sections (registry-driven, no new plumbing):

- Use Cases — title + list (icon, title, short text)
- Technology / Components — title + list (icon, name, description)
- Ingredients / Materials — title + intro + list (name, description, image)
- Results / Outcomes — title + text + list (value, label, short note)
- Package / Bundle — title + text + list (name, contents, note, image)
- Limited Time Offer — title, text, button label (no fake countdowns or invented urgency)
- Customer Stories — title + list (name, location, story, photo)
- Brand Story — title, story text, image
- Certifications / Awards — title + list (name, issuer, logo)
- Partners / Brands — title + list (name, logo)
- Product Variants — title + list (variant name, options, image); pre-filled from the linked product's variants when present

Sections with a purpose-built layout:

- Before & After — title, intro, before image + label, after image + label (side-by-side pair, stacks on mobile)
- Video Showcase — title, text, YouTube/Vimeo URL, optional poster image
- Product Demo — title, text, YouTube/Vimeo URL, short caption list
- Image Gallery — title + list (image, caption) in a responsive gallery grid
- Recommended Products — title + merchant-picked products from the same store
- Related Products — title; automatically the same-category products of the linked product
- Recently Viewed — title only; filled from the visitor's own browsing history, hidden when empty

Product cards in the last three link to the storefront product page. No new product data system: they read the store's existing products, and Recently Viewed reuses the existing browsing-history helper.

## Editor behaviour

Every new section appears in the Section Library card list and is added/removed exactly like today. Editors are generated from the field schema — text, textarea, image and repeating item rows with the existing uploader (Change image / Choose existing / Remove). Recommended Products gets a product picker (search + select from the store's products). Related Products and Recently Viewed only expose a title, with a note explaining where the products come from.

No colour, font, size, spacing or layout controls anywhere — all styling comes from the existing Landing Page Design System tokens.

## AI generator

The generator already reads the registry, so all 18 sections become available to it automatically. It writes content only for the sections that fit the product and leaves the rest out; sections needing real data it does not have (video URLs, partner logos, certifications, before/after photos, gallery images) are left disabled rather than invented. Statistics and results are only written when supported by supplied product facts.

## Technical notes

- `src/lib/landing-sections.ts`: 18 new `LPSectionSpec` entries inserted at sensible default order positions between the existing ones. Add an optional `render?: string` marker on a spec so a handful of sections can opt into a custom renderer; everything else keeps using `GenericSection`.
- New renderers under `src/components/landing/sections/`: `BeforeAfter.tsx`, `VideoEmbed.tsx` (shared by Video Showcase and Product Demo, with YouTube/Vimeo URL → embed parsing), `Gallery.tsx`, `ProductGrid.tsx` (shared by Recommended / Related / Recently Viewed).
- `src/components/landing/GenericSection.tsx` gains a small dispatch to those renderers keyed on the spec marker; its existing generic layout is unchanged.
- `src/routes/lp.$slug.tsx`: loader additionally fetches the store's active products needed for the product-grid sections (only when one of those sections is enabled), and passes store slug for links. Recently Viewed renders client-side from local history.
- `src/components/admin/landing/GenericSectionEditor.tsx`: adds a `products` field type used by Recommended Products; all other new sections use existing field types.
- `src/lib/landing-ai.server.ts`: no structural change — new sections flow in through the registry manifest.
- No database migration and no changes to the order form, design, domains or settings tabs.
