# Landing Page → Content: Used Sections + Section Library

Upgrade only the Content tab of the existing Landing Page editor. Order Form, Design, Domains, Settings tabs, the creation flow, product system and order system stay exactly as they are.

## What the merchant sees

Content tab keeps its current card style and gains two groups:

**Used Sections** — cards in real page order, each showing name, one-line description, status pill (`Visible` or `Always visible` for required), and an arrow that opens that section's own editor. Optional sections have a "Remove" action that disables them and moves them back to the library.

**Section Library** — cards for every available section not currently used, each with an `Add` button. Adding moves it instantly into Used Sections at its correct default position.

Required sections (Header, Hero, Order Form, Footer) are always visible and cannot be removed.

## Section catalogue

Default order: Header, Hero, Trust Bar, Product, Product Highlights, Benefits, Problem → Solution, Description, Features, Specifications, How It Works, How To Use, What's In The Box, Size Guide, Colors & Variants, Comparison, Offer, Social Proof, Reviews, Customer Photos, Guarantee, Shipping & Delivery, Payment Information, FAQ, Final CTA, Order Form, Contact, Footer.

Each section keeps exactly the fields listed in the request. Sections that mirror existing systems pre-fill from them and say so in the editor: Product/Offer from the product record and its pricing, Shipping & Delivery from delivery zones, Payment Information from the order form payment methods, Contact/Footer from Store Settings, Reviews from real store reviews where available.

## Section editors

Clicking a used section replaces the panel with a single editor: back link, section name, a one-line explanation, only that section's fields, and Save Changes. Repeating sections (benefits, features, specs, steps, FAQ, reviews, photos, comparison rows, variants, sizes, box items, trust items, highlights) use the existing compact item-row pattern with Add / open item / Delete.

Media fields use the existing uploader with Change image / Choose existing image / Remove only — no size, crop, position, colour or styling controls.

## Published page

`src/routes/lp.$slug.tsx` renders the used sections in stored order using the fixed professional template, one renderer per new section type. Unused/disabled sections are skipped with no spacing gaps.

## AI compatibility

The generator reads the same section registry: it sees every available section, picks the relevant ones for the product, writes content for them and skips the rest. Adding a section to the registry later automatically makes it available to the AI with no prompt changes.

## Technical notes

- New `src/lib/landing-sections.ts`: a data-driven registry — for each section key: name, description, required flag, default order index, and a field schema (text / textarea / image / list-of-fields, with max lengths and AI guidance). This registry is the single source of truth for the editor UI, the published renderer, and the AI manifest.
- `src/lib/landing-builder.ts`: `LandingContent` gains `sectionOrder: string[]`, `sectionEnabled: Record<string, boolean>`, and `blocks: Record<string, unknown>` for the new sections. The existing eight typed sections keep their current shape; `normalizeContent()` backfills order/enabled from what a stored page already has, so every existing landing page keeps its text and renders unchanged.
- `src/lib/landing-ai.server.ts`: `landingFieldManifest()` is generated from the registry instead of a hand-written list, plus a section-selection step so the model returns which sections to enable. Existing generation behaviour and the language choice stay.
- `src/components/admin/landing/section-editors.tsx` is split: `SectionList` becomes Used Sections + Section Library, and generic registry-driven editors (`GenericSectionEditor`, `ListSectionEditor`) cover the new sections; the current hand-written Header/Hero/Product/Description/FAQ/Reviews/Order/Footer editors are kept as-is.
- No database migration — content stays JSONB. No changes to server functions other than saving the extended content object through the existing `updateLandingPage`.
