# Subscription Product Creation Form (15-step wizard)

Build a dedicated Subscription form that mirrors the proven Service form architecture (`src/components/admin/product-form/service/`), fully isolated from Physical, Digital and Service fields. All subscription-specific data is stored under `products.meta.subscription`, so no schema migration is required.

## What gets built

**1. `src/components/admin/product-form/subscription/subscription-meta.ts`**
Type definitions + label maps for the whole subscription model:
- `billing_cycle`: weekly | monthly | quarterly | half_yearly | yearly | lifetime | custom, plus `custom_cycle { number, unit: days|weeks|months|years }`
- `plan_type`: individual | business | enterprise | custom; `badge` (Most Popular, Best Value, Recommended, Limited Offer, custom text)
- pricing: `setup_fee`, `tax_included`, `renewal_price_mode` (same | different) + `renewal_price`
- trial: `enabled`, `duration`, `unit`; activation: `automatic | manual | scheduled` + `activation_delay`
- `access_items[]` (label + optional note) — unlimited access rules
- `usage_limits[]` (metric, unlimited flag, limit value, reset period daily|weekly|monthly|never)
- `benefits[]` (title + description)
- renewal/upgrade: `renewal_mode`, `allow_upgrade`, `allow_downgrade`, `upgrade_rules`, `grace_period_days`, `renewal_reminder_days`, `expiry_reminder_days`, `renewal_discount`, `upgrade_discount`
- `customer_fields[]` (label, type text|email|url, required)
- `media` (preview images, promo video, documentation file URLs)
- `seo` (meta title, description, slug, keywords)
- `flags` (featured, popular, recommended, new, limited_offer) + `publish_at`
- `policies` (refund, cancellation, renewal, terms, warranty)
- `notifications` (welcome, payment_success, trial_ending, renewal_reminder, expiration_reminder, activated, cancelled — each boolean)

Backwards compatible with the existing `meta.subscription.billing_cycle` value written by the current inline form.

**2. `src/components/admin/product-form/subscription/SubscriptionProductDialog.tsx`**
A 15-step wizard reusing the existing shared primitives from `service/ui.tsx` (`Field`, `StepCard`, `RepeatableList`, wizard shell with progress + prev/next, `selectCls`) and existing `ImageUploader`, `GalleryUploader`, `RichTextEditor`, shadcn `Switch`/`Badge`/`Dialog`.

Steps: General → Subscription Plan → Pricing → Trial & Activation → Access Control → Usage Limits → Benefits → Upgrade & Renewal → Customer Information → Media → SEO → Visibility → Policies → Notifications → Review & Publish.

- Categories come from the already type-scoped `listMyCategories` (subscription only), with a subcategory select derived from `parent_id`.
- Footer actions on the final step: **Save Draft**, **Preview** (opens the storefront PDP in a new tab for saved products), **Publish Subscription**.
- No stock, shipping, variants, weight, digital files or service booking fields anywhere.
- Mobile-first: single-column stacked fields, horizontally scrollable step rail, sticky action bar.

**3. Shared wizard rename (light refactor)**
`service/ui.tsx` exports `ServiceWizard`; re-export it as a neutral `FormWizard` so both forms share it without duplicating code. The Service form keeps working unchanged.

**4. `src/routes/_authenticated/admin/products.tsx`**
Route to `SubscriptionProductDialog` when the active type (tab-driven) is `subscription`, exactly as `ServiceProductDialog` is routed today; `ProductDialog` keeps handling physical/digital.

**5. AI compatibility — `src/lib/ai-product-builder.functions.ts` + `AIProductBuilderDialog.tsx`**
Add a subscription branch to the prompt/validator so the AI returns billing cycle, plan type, pricing (incl. renewal price), trial, benefits, access items and usage limits under `meta.subscription`, and never emits physical/digital/service fields. The dialog already inherits the active product type from the scope.

**6. Storefront rendering — `src/components/storefront/pdp/SubscriptionInfoSections.tsx`**
Mirrors `ServiceInfoSections.tsx`: billing cycle + renewal summary, benefits grid, what's included/access list, usage limits table and FAQ-style policies. Wired into `src/routes/store/$slug/product.$productId.tsx` when `product_type === "subscription"`.

## Integration with the rest of the system

Subscription products already flow through the existing product-type isolation layer (`src/lib/product-type-scope.tsx` + scoped server fns), so Orders, Categories, Coupons, Analytics, dashboard counts and search are automatically subscription-only when the tab is active. This plan adds no cross-type leakage and changes no other product type's form.

Note on scope: this delivers the form, its data model, AI support and storefront display. Runtime *behaviour* of renewals, upgrade/downgrade billing runs, entitlement enforcement and the automated notification emails are separate engines — the form stores their configuration and is ready for them, but wiring those background systems is not part of this task.

## Technical notes

- Storage: `products.meta.subscription` (jsonb) — no migration needed.
- Price mapping follows the existing convention: sale price in `price`, regular price in `old_price` when a sale price is set.
- Publish scheduling stored as `meta.subscription.publish_at` with status `draft` until then.
- All new files stay under 500 lines by splitting steps into two co-located step-group components if needed.
