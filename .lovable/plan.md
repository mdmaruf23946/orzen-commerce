# Products Page: Tab-Driven Product Creation

Make the active Product Type tab the single source of truth for product creation. No product type is ever chosen twice.

## What changes

**Products page header**
- Breadcrumb line under the title showing the active context: `Products · Current Type: Physical` (updates with the tab).

**Add Product button**
- The current multi-type dropdown is removed.
- The button becomes a split action with exactly two entries:
  - `Add <Type> Product` — opens the form pre-set to the active tab's type.
  - `AI Assistant — Generate <Type>` — opens the AI builder locked to the active type.
- Labels adapt per tab: Physical Product / Digital Product / Service / Subscription Plan.
- On the **All** tab (which keeps showing every product), the two actions default to Physical, labelled explicitly as "Add Physical Product" so the outcome is never ambiguous.
- The empty-state button on each tab uses the same behaviour.

**Product form**
- The "Product type" dropdown in Step 1 (General) is removed entirely.
- The type comes from the tab that opened the form (or, when editing, from the product's stored type) and is saved as `product_type` automatically.
- The dialog title reflects the type: "New digital product", "Edit service", etc.
- All existing type-conditional sections (digital files, service booking fields, subscription billing cycle, stock/shipping hiding) keep working — they just read a fixed type instead of a selectable one.

**AI Assistant**
- Receives the active type and generates content for it (physical vs digital vs service vs subscription), with the type baked into the saved product.
- No type picker appears inside the assistant.

## Technical notes

- `src/routes/_authenticated/admin/products.tsx`: derive `activeType = tab === "all" ? "physical" : tab`; replace the dropdown with the two-action menu; pass `activeType` to both dialogs; add the breadcrumb line.
- `src/components/admin/product-form/ProductDialog.tsx`: delete the `Field label="Product type"` select (line ~502); keep `productType` as read-only state seeded from `editing.product_type ?? initialType`.
- `src/components/admin/product-form/AIProductBuilderDialog.tsx`: accept a `productType` prop, include it in the generation prompt and in the saved payload.
- UI-only change; no schema or server-function changes.
