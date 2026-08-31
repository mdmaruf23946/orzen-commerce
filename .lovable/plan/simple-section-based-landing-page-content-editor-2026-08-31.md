# Simple Section-Based Landing Page Content Editor

Rebuild the Content tab of the Landing Page Creator into a clean, nested "edit content" experience with exactly 8 fixed sections, and simplify the published page + Design tab to match. No drag-and-drop, no design controls.

## Section model (fixed order)

Header → Hero → Product → Description → FAQ → Reviews → Order Form → Footer

- Always visible: Header, Hero, Order Form, Footer
- Optional (show/hide): Product, Description, FAQ, Reviews
- Hidden sections disappear from the published page; spacing stays consistent automatically.

## Content tab flow

1. Content opens on a list of 8 section cards only — name, one-line description, visibility pill (or "Always visible"), arrow.
2. Clicking a card replaces the panel with a single section editor: "← Back to sections", section name, only that section's fields, and a Save button that saves and returns to the list.
3. FAQ and Reviews add a second level: the section editor shows compact item rows (Question 1 →, Review 1 →) plus "+ Add". Opening an item shows only that item's fields with Save and Delete.

### Fields per section
- Header: Store name, Header button text, Show order button. Logo comes from Store Settings.
- Hero: Headline, Short description, Offer text, Button text. Image/price/discount come from the linked product.
- Product: Section title, Short description, Show product features toggle. Product data pulled from the product record.
- Description: Section title, Description, 3–5 key points (title + text), Add/remove key point.
- FAQ: visibility toggle + nested question/answer items.
- Reviews: visibility toggle + nested items (name, location, review text, 1–5 rating).
- Order Form: Form title, Form subtitle, Button text only, with a link across to the Order Form tab for field/payment/delivery configuration.
- Footer: Short description, Contact text, Copyright text. Contact/social details come from Store Settings.

## Other tabs

- Order Form tab: unchanged (fields, required, payment methods, delivery charge). The submit button text stays here and is shared with the Content → Order Form text.
- Design tab: replaced with a single informational card ("Professional Landing Page — design is managed automatically"). Existing color/dark/rounded pickers removed; stored theme values keep a fixed professional default.
- Domains tab: unchanged.
- Settings tab: page title, slug, publish/unpublish, SEO title, meta description, social share image.

## Preview

Keep the existing Preview button (already works for drafts via `?preview=true`). Add a Desktop / Mobile toggle in an in-panel preview that renders the published page inside a sized iframe, view-only, refreshed after each save.

## Published page

`src/routes/lp.$slug.tsx` is rewritten to render exactly the 8 sections in fixed order with one polished, responsive template: sticky header with store logo/name and order button, hero with product image and pricing, product section with gallery/features/specs from the product, description with key points, FAQ accordion, reviews grid, order form, footer. Hidden sections are skipped cleanly.

## Technical notes

- `src/lib/landing-builder.ts`: new `LandingContent` shape (`header`, `hero`, `product`, `description`, `faq`, `reviews`, `order`, `footer`) plus a `normalizeContent()` migration that maps existing stored content (hero/gallery/features/benefits/details/reviews/faq/contact/cta/order/footer) into the new shape, so existing pages keep their text. `generateContentFromProduct` updated to emit the new shape. No database migration required — content stays JSONB.
- Section editor state lives in the route component (`activeSection`, `activeItem`); Save calls the existing `updateLandingPage` server function — no new backend logic, no duplicated product/order/domain systems.
- Editor split into `src/components/admin/landing/` components (section list, per-section editors, nested list editor, preview frame) to keep the route file small.
- Product, store settings, order submission, domains and review data continue to come from the existing systems; nothing is duplicated.
