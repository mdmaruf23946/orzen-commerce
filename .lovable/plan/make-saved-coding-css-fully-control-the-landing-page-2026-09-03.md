# Make saved Coding CSS fully control the Landing Page

## What is actually wrong

The saved CSS *is* being injected into the public page (`.lp-root` scoped `<style>` tag), so this is not a "CSS never loads" bug. It is a precedence problem, confirmed by reading the renderer:

1. **Inline styles win over everything.** The landing renderer sets colors, backgrounds, borders, radius and layout values through React `style={{ ... }}` attributes — 26 places in the public page file and 30 more in the landing components (root, header, hero badge, buttons, order form, footer, section cards). An inline style beats any stylesheet rule that does not use `!important`, so merchant CSS for backgrounds, buttons, cards, radius, hero and header simply loses.
2. **A hard-coded `!important` block sits above the merchant CSS.** The page injects a palette-mapping stylesheet that forces `background-color`, `color` and `border-color` with `!important` on all the neutral utility classes. Merchant CSS can never beat it.
3. **What still works today = CSS variables.** Merchant CSS can change `--lp-primary`, `--lp-bg`, etc., and those variables feed the inline styles. That is exactly why "only minor color changes appear" and nothing structural does.
4. **Preview refresh is manual.** The preview iframe only reloads when the refresh button is pressed or the device changes, so a save does not visibly update it.

## The fix

### 1. Stop the renderer from hard-locking presentation

- Convert the presentational inline `style={{}}` values in the landing renderer and landing components into CSS custom properties + classes on a base stylesheet (e.g. `lp-btn`, `lp-card`, `lp-header`, `lp-hero`), keeping the exact same default look. Content, product data, order-form logic and section structure are untouched.
- Where an inline style must stay (values computed from content, such as a background image URL), keep it but make it a CSS variable the merchant can override.

### 2. Give merchant CSS the last word

- Move the neutral-utility palette mapping into the same base layer and drop its `!important` usage, so it is a default, not a lock.
- Emit stylesheets in a fixed cascade order: app CSS → landing base layer → palette variables → **merchant design code last**.
- Wrap the base layer in `@layer lp-base` and the merchant CSS in `@layer lp-user` so the merchant layer always wins on conflicts regardless of selector specificity, while still preserving structure.

### 3. Replace old CSS cleanly, no stale styles

- Render the merchant CSS in a single `<style data-lp-design>` element keyed on the saved code, so a new save replaces the whole element instead of stacking.
- On save, the builder immediately writes the new code to the shared draft key and bumps the preview iframe cache-buster, so Preview repaints right away.

### 4. Same CSS in Preview and in the browser

- Public page keeps reading `design_code` from the page row; add the saved timestamp to the page URL/data fetch as a version token so a fresh save always defeats edge/browser caching.
- Confirm the public HTML no-store / revalidate headers already added still cover the landing host, and add the version token to the landing manifest/branding fetch path if it is cached.

### 5. Correct style hooks

- Update the "Style hooks" list and default design code in the Coding tab so every selector matches the real DOM (section wrapper is `div[data-lp-section="key"] > section`, cards/buttons get the new `lp-*` classes). Merchants copying the default into ChatGPT then get code that actually targets real elements.
- New pages automatically get this same architecture — the default design code and base layer are shared, nothing per-page is needed.

## Guardrails kept

- CSS-only: validation, `.lp-root` scoping, script/import/url blocking and the 60 KB limit stay exactly as they are.
- No changes to product data, section content, order form logic, orders, customers, payments, domains, auth or any backend rule.
- Existing landing system is not rebuilt — only the presentation/cascade layer changes.

## Verification

- Save a CSS that changes background, layout, typography, cards, buttons, shadows and animations; confirm Preview updates instantly and the public subdomain matches after reload.
- Reset to default and confirm the stock design returns unchanged.
