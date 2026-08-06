# AI Product Builder: Four Type-Specific Workflows

Keep one dialog, one 3-step stepper (Images → Essentials → Describe), but swap the fields inside each step based on the active Product Type so a generated product is ready to publish without extra editing.

## Step 1 — Images (same for all types)

- Product images (Gallery / Camera), up to 8, existing validation kept.
- Category (required) and Subcategory selects, sourced from the already-passed `categories` list, filtered by the active product type.
- Brand (optional) moves here from Step 2.
- Product type shown as a read-only chip (auto-detected from the tab that opened the builder).
- Continue is blocked until a category is chosen (images stay required for physical/digital, optional for service/subscription where a photo may not exist).

## Step 2 — Essentials (dynamic)

**Physical:** selling price, compare price, cost price, stock qty, SKU, low-stock alert, weight, dimensions (L/W/H), warranty, manufacturer, country of origin.

**Digital:** selling price, compare price, delivery type (instant / manual / external), file upload or external URL, file version, download limit, expiry days, license type.

**Service:** pricing mode (fixed / starting from) + price, booking required toggle, appointment duration, online/offline mode, service area, delivery time, response time.

**Subscription:** billing plan rows for Monthly / 3 Months / 6 Months / Yearly / Lifetime — each enabled independently with its own price and compare price; trial enable + trial days; activation auto/manual; renewal auto/manual.

## Step 3 — Describe (dynamic)

Same free-text box, but the placeholder/prompt hints and the extra media fields change:

- Physical: description, features, specifications, what's in the box + YouTube and Facebook video URLs.
- Digital: description, installation guide, system requirements, changelog + demo video URL.
- Service: service description, included features, customer requirements, workflow, FAQ.
- Subscription: overview, features, benefits, included services, FAQ.

## AI generation

The server function is extended to always return, per type: product name, short description, full HTML description, SEO title, meta description, URL slug, tags, keywords, FAQ, plus the type-specific blocks listed above (box contents / installation + requirements + changelog / workflow + requirements / benefits + included services).

Everything the user typed in Step 2 wins over the AI guess; the AI fills only what was left empty.

## Hand-off

After generation the draft opens in the matching form (ProductDialog for physical/digital, ServiceProductDialog, SubscriptionProductDialog) with every Step-2 field and every generated block already mapped into the product record and its metadata — including digital delivery/license rules, service booking rules, and subscription plans — so the form is a review screen, not a fill-in screen.

## Technical notes

- `src/components/admin/product-form/AIProductBuilderDialog.tsx`: split into a shell plus per-type step components (`steps/PhysicalEssentials.tsx`, `DigitalEssentials.tsx`, `ServiceEssentials.tsx`, `SubscriptionEssentials.tsx`, and matching Describe panels). Local state moves into one typed `essentials` object keyed by product type.
- `src/lib/ai-product-builder.functions.ts`: extend `draftSchema` with optional type-specific arrays (`box_contents`, `installation_html`, `system_requirements`, `changelog`, `workflow_steps`, `customer_requirements`, `benefits`, `included_services`, `faq`) and branch the system prompt per type. Schema stays flat and constraint-free; bounds clamped in code as today.
- `buildEditingLike` gains per-type mapping: digital → `meta.digital` (delivery mode, external_url, version, max_downloads, expiry_days, license_type, requirements, changelog, faq); service → `meta.service` (pricing_type, booking, delivery, included, requirements, deliverables, faq); subscription → `meta.subscription.plans` from the enabled plan rows, trial, activation, renewal.
- Mobile-first: all field grids are single-column below `sm`, sticky footer nav retained.
- No schema or database changes.
