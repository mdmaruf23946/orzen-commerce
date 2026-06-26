## Product Card — Unified Bottom Panel

Refactor the storefront product card so the full info area (title + price + buttons) sits inside one solid-colored container, controlled by a single store setting. No new dependencies, no extra queries, no animations.

### 1. Reuse the existing color field
- Reuse the existing `stores.title_bar_color` column as the unified "Product card panel" color (it already powers the title bar and is already editable + loaded with the store). No DB migration, no extra payload.
- In `src/routes/_authenticated/admin/settings.tsx`, rename the picker label from **"Product title bar"** to **"Product card panel"** and update the helper hint. Same field, clearer meaning.

### 2. Rework `src/components/storefront/ProductCard.tsx`
- Keep the image block as-is (lazy, aspect-square, link to product detail).
- Replace the current split (colored title strip + plain price/buttons area) with **one** container directly under the image:
  - `background: var(--store-title-bar-bg)` with a sensible fallback.
  - Auto-contrast text: compute white vs near-black once per render from the hex via simple luminance check (pure JS, no lib) so titles/prices stay readable on light or dark panels.
  - Inside the panel, stacked layout: title (2-line clamp) → price row (current + struck-through old price) → Add to Cart (outline) + Buy Now (solid) buttons.
  - Buttons: outline button uses `currentColor`/transparent on the panel; solid Buy Now uses `--store-btn-bg`. White text on Buy Now stays as today.
  - Out-of-stock state replaces the buttons with a centered "Out of stock" label inside the same panel.
- Keep `:active` opacity only — no shadows, gradients, transitions.

### 3. Performance guardrails
- No new server calls, no new context, no extra renders — purely presentational JSX/CSS changes inside one component.
- Contrast calc is O(1) per card and runs only on render of already-loaded data.
- CSS variables continue to drive theming; admin color change still takes effect on next render with zero refetch.

### Files touched
- `src/components/storefront/ProductCard.tsx` — restructure into single panel + contrast helper.
- `src/routes/_authenticated/admin/settings.tsx` — relabel the existing color picker.

No schema changes, no new routes, no new packages.
