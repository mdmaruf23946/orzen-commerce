## Goal

Turn `/admin/theme` into a real theme builder: a true storefront preview (real products, banners, logo, footer) that updates instantly as settings change, plus a much deeper — but still locked-down — customization panel. No database, routing, API, or business-logic behaviour is removed; the existing theme columns and functions stay and keep working for stores already on a theme.

## 1. Live preview = the real storefront in an iframe

The preview panel embeds the store's actual storefront (`/store/{slug}?theme_preview=1`) inside a resizable iframe instead of a hand-drawn mock. This guarantees header, search, nav, hero banner, categories, product cards, flash sale, featured, collections, badges, countdown, cart/wishlist buttons and footer all render exactly as a customer sees them, using the store's real data. Placeholder products appear automatically only when the store has none.

Live updates use `postMessage`: the editor sends the merged theme object on every change (throttled with `requestAnimationFrame`), and the storefront layout — when in preview mode — applies the incoming tokens to its CSS-variable style object and section flags. No reload, no save required, no refetch of store data.

Device switcher (Desktop / Tablet / Mobile) just resizes the iframe frame (1280 / 834 / 390 CSS px) with a CSS transform to fit the panel, so responsive rendering is genuine.

## 2. Theme = full design, not just colors

The shared theme contract in `src/lib/theme/definition.ts` gains new optional groups, all defaulted so existing stored definitions/overrides keep working untouched:

- `colors`: adds success, warning, error, background, surface, card, border, link
- `typography`: adds font weight, letter spacing, line height
- `header`: sticky, transparent, height, search/cart position, logo alignment
- `nav`: menu style, category position, mega menu
- `hero`: height, radius, overlay, text align, CTA style
- `sections`: adds trending, collections, testimonials, brand logos, newsletter + an `order` array for drag-and-drop ordering
- `product_card`: card style, shadow, radius, image ratio, hover effect, badge/button/rating/price style
- `buttons`: border, shadow, hover animation, filled/outline
- `footer`: layout, social icons, copyright, payment icons
- `spacing`: container width, section gap, card gap, padding, margin
- `global`: radius slider 0–30px, shadow level (low/medium/high/premium), animation level (none/minimal/modern/premium)

`themeCssVars()` emits the full token set; the storefront components read those tokens so a theme switch changes layout density, card shape, shadows and typography — not only colors. The five identities (Modern / Luxury / Electronics / Fashion / Grocery, plus existing catalog entries) are expressed purely through these token values, updated via a data migration on `store_themes.definition` that merges new keys into existing rows without dropping anything.

## 3. Store Admin editor UI

Three-pane layout matching the reference: left theme catalog + accordion setting groups, center/right live preview, top bar with device switcher, undo/redo, Reset, Publish; bottom bar showing the current theme with Preview Store / Save Draft / Publish Changes.

Setting groups: Brand, Colors, Typography, Header, Navigation, Hero Banner, Homepage Sections (with drag-and-drop ordering), Product Card, Buttons, Footer, Animations, Spacing, Radius, Shadow, plus one-click Style Presets (Flat / Soft / Glass / Premium / Modern / Luxury) that write a bundle of token values into the current overrides.

Undo/redo is an in-memory stack of override snapshots. Locked fields stay disabled with the lock icon exactly as today; the server still re-sanitizes every write, so store admins can never create a theme, edit theme structure, or inject code.

## 4. Winner Admin

`/owner/themes` gets an edit drawer exposing the same full token set (it currently only lists/publishes/duplicates/deletes), so official themes can be authored and pushed globally. Existing `ownerSaveTheme` server function already accepts an arbitrary definition — no signature change.

## 5. Performance

Preview messages are throttled per animation frame; the iframe mounts once and is never re-created on setting changes; catalog thumbnails render from tokens (no screenshots); product images keep `loading="lazy"`.

## Technical notes

- Files touched: `src/lib/theme/definition.ts` (extend + defaults, backward-compatible merge), `src/components/admin/theme/ThemeCustomizer.tsx` (rewrite into panel components under `src/components/admin/theme/`), `src/routes/store/$slug/route.tsx` and `src/routes/store/$slug/index.tsx` (consume new tokens + preview-message listener behind a `theme_preview` search param), `src/routes/_authenticated/owner/themes.tsx` (add editor drawer).
- Server functions in `src/lib/themes.functions.ts` keep their current signatures; only `sanitizeOverrides` grows to whitelist the new keys.
- One migration: additive JSON merge into `store_themes.definition` for the existing seeded themes. No column drops, no data loss.
- The preview iframe is same-origin, so `postMessage` is restricted to `window.location.origin`.
