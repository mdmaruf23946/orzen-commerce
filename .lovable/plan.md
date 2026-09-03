# Multi-Product Offer & AI Design Workflow for Landing Pages

Upgrade the existing Landing Page creation into a guided offer builder: pick the main product, the language, an offer type, secondary products from the store catalog, and the pricing rules — then let AI write the content and the full premium CSS design from those real facts.

Everything reuses the current product, store, brand, review, order-form, domain, Design and Coding systems. No duplicate data systems, no changes to unrelated features.

## 1. Offer model (new, shared)

A new `src/lib/landing-offer.ts` defines one offer object stored per landing page:

- Offer types: single, addon (main + add-ons), combo/bundle, buy-1/2/3, buy-X-get-Y, quantity discount, tiered pricing, upsell/cross-sell, choose-your-bundle, premium upgrade package.
- Each offer holds: main product, secondary products (store catalog product ids + quantity + role: addon / free gift / upgrade), and a list of offer tiers.
- Each tier holds: label/title, quantity, included products, pricing mode (fixed price, % discount, fixed-amount discount), original price, offer price, free product, badge, default flag.
- One pure calculator (`computeOfferPricing`) returns original total, offer price, savings amount and percentage for each tier. The same function runs in the merchant UI, on the public page, and on the server at order time, so the displayed price and the charged price can never diverge.

Example the merchant can configure directly: 1 pc → ৳999, 2 pcs → ৳1,799, 3 pcs → ৳2,399.

## 2. Creation flow (Merchant Panel)

The "Create with AI" dialog becomes a short stepped wizard:

1. Main product (existing product picker)
2. Language — Bengali / English (existing choice, moved into the wizard)
3. Offer type (cards with a one-line description each)
4. Secondary products — searchable list from the store catalog, only shown for offer types that use them
5. Offer & pricing — tier rows with live-calculated original price, offer price, savings and total
6. Generate

Step 5 always shows a live summary card so the merchant sees exactly what the buyer will see.

## 3. Storage

One migration adds two columns to `landing_pages`:

- `offer jsonb not null default '{}'` — the offer configuration
- `content_lang text` — the language chosen at creation

No new tables, no new grants needed (existing table policies and grants stay as they are). Existing pages keep working: an empty offer means "single product", exactly today's behaviour.

## 4. AI content generation

`createLandingPage` already loads real business facts (brand colours, contact, socials, policies, reviews, rating, units sold, variants, stock). It will additionally pass:

- main product + every secondary product (name, price, image, short description)
- offer type, all tiers and their computed pricing
- the selected language

The AI prompt gains a strict rule set: it may only use the supplied pricing numbers, may never invent products, prices, claims, reviews or urgency, and must pick the sections that fit the offer type (e.g. bundle offers get the Package/Bundle and Offer sections; buy-X-get-Y gets a gift-focused offer section). Section selection stays inside the existing section registry.

## 5. AI design code (Coding layer)

A new generator produces the page's CSS at creation time and stores it in the existing `design_code` field, so it flows through the Coding tab, the preview and the public page with no new plumbing:

- Built from the page's own palette (brand colours + AI theme) and product imagery.
- Covers backgrounds and gradients, typography scale, section rhythm, product cards, offer/pricing cards, buttons, borders, shadows, hover states, transitions, entrance animations, image treatment and mobile breakpoints.
- Validated and page-scoped by the existing `landing-code` guards (CSS only, no scripts/imports, 60 KB cap).
- A "Regenerate design with AI" button in the Coding tab re-runs it on demand.

The cascade work from the previous fix already lets saved CSS control the whole page; this plan adds the offer-specific hooks (`.lp-offer`, `.lp-offer-tier`, `.lp-price`, `.lp-save-badge`) to the base layer and the hook list so generated and hand-written CSS can style the offer UI too.

## 6. Public landing page & orders

- The offer renders as a tier selector inside the existing order section (selected tier highlighted, savings badge, included items listed) plus an optional standalone Offer/Bundle section.
- Selecting a tier updates quantity, subtotal, delivery and total through the same calculator.
- `POST /api/public/lp/order` recomputes the chosen tier from the stored offer and the live product rows server-side — the browser never sets the price — and writes one `order_items` row per included product, so the Merchant Panel, invoices, inventory and courier flows all see the real basket.
- Stock checks run for every product in the tier.

## 7. Editing after creation

The builder gets an **Offer** tab reusing the same wizard components, so tiers, secondary products and pricing can be edited later. Content, Design, Coding, Domains, Settings tabs are untouched.

## Technical notes

- New: `src/lib/landing-offer.ts` (types + calculator), offer wizard components under `src/components/admin/landing/`, offer renderer for the public page, AI design-code generator in `src/lib/landing-code.server.ts`.
- Changed: `createLandingPage` (accepts and validates the offer, passes offer facts to AI, saves generated CSS), `landing-ai.server.ts` (offer-aware prompt + section choice), `lp.$slug.tsx` (offer UI in the order section), `landing-builder.server.ts` (server-side offer pricing + multi-item orders), `landing-base-css.ts` and `landing-code.ts` (offer style hooks).
- Untouched: products, store settings, branding, reviews, customers, payments, domains, auth, plan gating and limits.
- Server always re-derives prices from the database; the offer JSON only ever describes intent.
