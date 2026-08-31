# AI-Generated Landing Page Creation

Upgrade only the "Create Landing Page" step. Tabs, sections, Design, Domains, Settings, Order Form, publishing and the fixed 8-section structure stay exactly as they are.

## New flow

```text
Create Landing Page → product list (existing) → select ONE product
   → [ Create Landing Page ] button appears
   → progress: "Creating your landing page..." → "AI is preparing your product content..."
     → "Building your landing page..." → "Finalizing..."
   → page created (draft) → existing editor opens → review/edit → preview → publish
```

Today the product list creates the page instantly on click. It will instead mark the product as selected (highlighted row) and enable a Create button at the bottom of the dialog.

## AI generation

A new server function generates content for the selected product and the page is created with that content in one call. It reads existing data only: product name, price/old price, images, short description, description, features, specifications, warranty, shipping, return policy, delivery days, plus store name/contact and any real product reviews.

Generated: header text, hero headline/subheadline/offer/CTA, product section title/subtitle, description text and key points, FAQ items, "why customers choose this" style content, order form heading/subtitle/success message, footer text and copyright.

Not generated: images, prices, specs, features (these are copied from the product as today), and the design/theme.

### Factual safety
- The prompt forbids inventing specs, certifications, warranty, delivery promises, ratings or customer counts. Facts are passed in explicitly; anything absent gets general persuasive copy instead.
- Reviews: if the product has approved reviews, they are used as-is. If not, the Reviews section stays off and the AI instead fills a neutral benefits-style block in the Description section — never fake testimonials.
- Every AI field is validated and length-clamped; if AI fails or the plan doesn't allow it, the page still gets created with today's template content (no dead end).

### Future-proof
The generator builds its request from a single field manifest derived from the landing content model (section key → editable text fields, limits, guidance). Adding a new editable text field or section to that manifest is all that's needed for the AI to start filling it — no rewrite of prompt or parsing logic. Non-text fields (images, toggles, numbers) are excluded by the manifest.

## Language
Copy follows the existing template's Bangla-first defaults, adapting to the language of the product's own name/description when that is English. Merchant can edit everything afterwards.

## Technical notes
- `src/lib/landing-ai.server.ts` (new): field manifest built from `LandingContent`, prompt builder, structured-output call via the Lovable AI gateway (same pattern as `ai-product-builder.functions.ts`), validation/clamping, merge of AI text onto `generateContentFromProduct(product)`.
- `src/lib/landing-builder.functions.ts`: `createLandingPage` gains an optional `useAi` flag; when set it awaits the generator and inserts the merged content plus AI-written SEO title/description. Errors fall back to the current template content.
- `src/routes/_authenticated/admin/landing-builder.index.tsx`: `CreateDialog` becomes select-then-create with the staged progress messages, then navigates to the existing editor as it does now.
- Reviews come from the existing `product_reviews` data already exposed to the merchant panel.
- No schema changes, no new tabs, no changes to the renderer or order intake.
