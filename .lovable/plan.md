## Product Details Page UX Improvement

Reorder the product details layout so the action area (quantity + Add to Cart + Buy Now) appears immediately under price/stock, with the description moved below. No new dependencies, no animations, no extra JS.

### File touched
- `src/routes/store/$slug/product.$productId.tsx` — JSX reorder only; loaders, queries, and handlers stay unchanged so loading speed is unaffected.

### New structure

Mobile (single column, order top → bottom):
1. Product images (main + thumbnails)
2. Title
3. Price + old price
4. Stock status
5. Quantity selector (− / qty / +)
6. Add to Cart button
7. Buy Now button
8. Description
9. Back link

Desktop (`sm:` and up) — two-column grid:
- Left column: images + thumbnails
- Right column: title, price, stock, quantity, Add to Cart, Buy Now
- Description spans full width **below both columns** (moved out of the right column into a third row under the grid)

### Implementation notes
- Wrap images + info in a `grid sm:grid-cols-2 gap-6` container; render the description as a sibling block after the grid so it sits below both columns on desktop and naturally below the buttons on mobile.
- Keep buttons in a 2-column grid (`grid-cols-2 gap-3`) so they remain visible together above the fold on mobile.
- Quantity selector stays as the existing rounded − / qty / + control, placed directly above the buttons.
- No style/animation additions; reuse existing Tailwind classes and CSS variables already in the file.
- No changes to data fetching, cart logic, or routes.
