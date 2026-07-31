# ORZEN Theme System — Winner Admin controlled

Store Admin never builds a theme. Winner Admin owns a catalog of themes; Store Admin picks one and edits only whitelisted options.

## 1. Data

New table `public.store_themes` (Winner Admin owned):
- identity: `name`, `slug`, `category` (modern/premium/luxury/fashion/electronics/grocery/minimal/dark/corporate/elegant)
- `preview_url` (thumbnail), `status` (`draft` | `published` | `hidden`), `sort_order`
- `definition` jsonb — the full theme: layout, header, footer, product card, buttons, colors, typography, banner style, animation defaults
- `locked` jsonb — which keys Store Admin may NOT change (e.g. `{"colors":["header"],"layout":true}`)
- timestamps. GRANTs + RLS: published themes readable by `anon`/`authenticated`; all writes restricted to platform owner.

On `stores` (additive only, existing `theme` blob and colour columns untouched):
- `theme_id uuid` — selected theme
- `theme_overrides jsonb` — Store Admin's safe customisations (published)
- `theme_draft jsonb` — unsaved/draft customisations

Seeding: ship ~12 hand-built professional themes in the migration (Modern Blue, Premium Corporate, Luxury Gold, Fashion Store, Electronics Pro, Grocery Fresh, Minimal, Dark Pro, Elegant, Corporate Clean, Beauty Soft, Sports Bold). Winner Admin creates the remaining ones through the UI to reach 30–40 — hand-authoring 40 in one migration would be filler, not quality.

## 2. Winner Admin — `/owner/themes`

- Grid of theme cards: preview thumbnail, name, category, status badge, "used by N stores".
- Actions: Create, Edit, Duplicate, Delete, Publish, Hide.
- Theme editor (form-driven, not a canvas): colours, typography, header config, footer config, product card config, button style, banner style, animation, homepage section defaults, plus a lock toggle beside each group ("Store Admin can change / locked").
- Live preview pane using the same renderer as the storefront.

## 3. Store Admin — `/admin/theme` (rebuilt in place, same route)

Two-step layout matching the reference screenshot.

**Step 1 — Choose Theme:** horizontally scrollable cards of published themes with previews and a check on the active one.

**Step 2 — Customize Selected Theme:** collapsible accordion, only whitelisted controls:
- Brand Identity — logo, store name, favicon (reuses existing store icon/favicon system)
- Colors — primary, secondary, accent, button, header, footer (locked ones render disabled with a lock icon)
- Typography — heading font, body font, button font, base size
- Header — toggles for Search, Categories, Wishlist, Cart, Account
- Homepage Sections — enable/disable Banner, Categories, Featured, Flash Sale, Best Sellers, New Arrival, Reviews, FAQ (no reorder, no add)
- Product Card — toggles for Rating, Discount badge, Sold count, Wishlist, Quick view, Buy Now, Add to Cart
- Buttons — border radius, style (solid/outline/soft), hover colour
- Footer — phone, email, address, social links
- Animation — None / Fade / Slide / Zoom

Right side: Live Preview with Desktop / Tablet / Mobile toggles, rendered in a scaled iframe of the real storefront using the draft theme.

Bottom bar: Save Draft, Publish Changes, Reset Theme, Restore Default Theme, Preview Store, plus undo/redo of unsaved edits.

## 4. Storefront

`src/routes/store/$slug/route.tsx` and the storefront components resolve theme = `store_themes.definition` merged with `stores.theme_overrides`, emitted as CSS variables and config props. Existing `header_color` / `button_color` / `theme` columns keep being written so nothing already live breaks. A store with no `theme_id` falls back to today's behaviour exactly.

## 5. Enforcement

- Server function `updateStoreTheme` validates overrides against a strict Zod whitelist and rejects any key the selected theme marks as locked — the UI gate cannot be bypassed via direct RPC.
- No custom CSS/HTML/JS fields exist anywhere in the store-side schema or validators.
- Theme create/edit/delete/publish server functions require platform-owner role.

## Technical notes

Files: new `src/lib/themes.functions.ts`, `src/lib/theme/definition.ts` (shared types + merge + whitelist), new `src/routes/_authenticated/owner/themes.tsx` (+ owner sidebar entry), rewritten `src/routes/_authenticated/admin/theme.tsx` with components under `src/components/admin/theme/`, storefront resolver updates in `src/routes/store/$slug/route.tsx` and `src/lib/store-ui.tsx`, plus one additive migration.
