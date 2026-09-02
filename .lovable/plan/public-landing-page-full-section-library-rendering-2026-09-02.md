# Public Landing Page — Full Section Library Rendering

Make the public landing page (`/lp/$slug` and its custom-domain equivalent) render every section of the existing Section Library: enabled sections only, in the merchant-configured order, using saved Section Editor content, fully responsive, registry-driven so future sections work without frontend changes.

No changes to the Merchant Panel, Section List, Section Editors, Order Form, Design, Domains, or Settings tabs.

## Current state (verified)

- `src/routes/lp.$slug.tsx` already renders `content.sectionOrder` in order, skips disabled sections, keeps Header first / Footer last, dispatches builtin sections (Hero, Product, Description, FAQ, Reviews, Order Form) and sends everything else to the registry-driven `GenericSection`.
- `GenericSection` + specialized renderers (BeforeAfter, VideoEmbed, Gallery, ProductGrid) cover most of the 46 registered sections; catalogue-driven sections (Recommended / Related / Recently Viewed) already fetch store products server-side.

## Gaps to fix

1. **Missing sections — Ratings and Return / Refund** (in the required section list but not in the registry). Add both to `src/lib/landing-sections.ts`. Because the registry is the single source of truth, this automatically gives them a Section Library card, a generic editor, AI availability, and public rendering — no editor or renderer wiring needed.
   - `ratings`: overall score, total review count, short summary, optional list of rating rows (label + score). Editor note: pre-fill from the Reviews section where available.
   - `return_refund`: title, policy text, optional list of policy points. Editor note: should reflect the store's real return/refund policy.
2. **Customer Photos uses the wrong layout** — it has no render hint, so photos render as generic cards. Add `render: "gallery"` so it uses the existing `Gallery` component like Image Gallery.
3. **Icon fields render as raw text** — list items with an icon field (Trust Bar, Benefits, Features, Guarantee, etc.) currently print the icon name ("shield") as the item heading. Fix `GenericSection` to resolve icon names through a shared lucide icon map (moved out of `lp.$slug.tsx` into `src/lib/landing-icons.ts`) and exclude icon fields from the text output.
4. **Safety guard** — `GenericSection` must never render `products`-type fields (picked product IDs) as text; only the ProductGrid renderer consumes them.
5. **Responsive / consistency pass on the public renderers only** — verify each renderer (generic layout, BeforeAfter, VideoEmbed, Gallery, ProductGrid, builtins) behaves cleanly at mobile (~390px), tablet (~820px), desktop (1440px): grid breakpoints, image aspect ratios, video 16:9, no overflow. Fix only presentation issues found; design tokens (`--lp-primary`, `--lp-radius`, etc.) stay system-owned.

## What does not change

- Section registry shape, existing 46 section keys, builtin sections, editors, AI manifest generation (it reads the registry, so the two new sections become AI-selectable automatically with relevant-only guidance).
- Data model: content stays in the existing JSONB; `normalizeContent()` backfills order/enabled, so all existing landing pages render unchanged.
- No new data systems: product data, store info, reviews, delivery zones and payment methods keep flowing from the existing sources.

## Technical notes

- Files touched: `src/lib/landing-sections.ts` (2 new sections + gallery hint), new `src/lib/landing-icons.ts`, `src/components/landing/GenericSection.tsx` (icon rendering + guards), `src/components/landing/sections/*` and `src/routes/lp.$slug.tsx` (responsive fixes only if found), `src/lib/landing-ai.server.ts` only if the manifest needs the new sections' guidance wording (likely automatic).
- The two new sections get `ai` guidance so the generator uses them only when relevant (ratings → only with real review data; return/refund → only when policy facts exist).
- Verify with a Playwright pass over a published landing page at 390/820/1440 widths, toggling sections on/off to confirm order and visibility are respected.
