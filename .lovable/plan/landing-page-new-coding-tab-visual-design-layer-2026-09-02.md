# Landing Page — new "Coding" tab (visual design layer)

Add a sixth tab, **Coding**, to the existing Landing Page editor. It holds the real
design code that styles the public landing page — layout, spacing, typography, cards,
buttons, image presentation, responsive rules, animations. It never touches content,
sections, orders, payments, or settings.

## What the merchant sees

A new tab next to Content / Order form / Design / Domains / Settings:

- A real code editor containing the page's actual design code (scoped CSS).
- Line numbers, monospace, dark editor surface, syntax-safe editing.
- **Save code** — persists the code and applies it to the live page.
- **Preview** — reuses the existing Desktop / Tablet / Mobile preview frame, rendering
  with the unsaved code so changes can be checked before saving.
- A **Reset to default** action that restores the system-generated base design.
- An error strip: if the code fails validation (bad syntax, forbidden rule), the editor
  shows exactly what's wrong plus a **Fix with AI** button.
- A reference panel listing the section keys and class hooks actually present on this
  page (hero, product, faq, reviews, order, footer, plus any library sections enabled),
  so the merchant/AI styles only what exists.

## Why CSS, not a JSX component

The chosen approach stores real, page-scoped CSS that the public landing page loads and
uses. It renders server-side (fast, SEO-safe), can never read or change data, cannot
call the database, auth, orders, or payments, and works unchanged whatever mix of
sections a page has. The section renderer keeps producing the markup; the coding layer
decides how it looks.

## Fix with AI

When saved or previewed code fails validation, the editor surfaces the exact error and a
**Fix with AI** button. It sends the current code plus the error to the AI, which returns
corrected code preserving the merchant's design intent. The merchant sees a diff-free
replacement in the editor and must still press Save. The same server function is what a
future AI Design Generator will call to write a full design for a product.

## Safety rules (enforced server-side, not just in the UI)

- All rules are automatically scoped to the landing page root, so nothing can leak into
  the Merchant Panel or another page.
- Rejected before saving: `@import`, `url(...)` pointing at anything other than https or
  data-image, `behavior`, `expression(`, `position: fixed` on the root, and any
  `<script>`/HTML content. Size capped (e.g. 60 KB).
- The code is CSS only — it has no access to JavaScript, the database, auth, orders,
  payments, customers, products, store settings, or domains.

## Rendering flow (unchanged except the last step)

```text
Product data → Section data → Order form data → Theme palette → Saved design CSS → Public page
```

Theme colors from the Design tab stay the source of truth for palette variables; the
design CSS is injected after them, so it can restyle layout while still using the chosen
colors through the existing CSS variables.

## Technical notes

- New nullable columns on `landing_pages`: `design_code` (text) and `design_code_at`
  (timestamptz). Migration includes grants; no policy changes.
- New shared module `src/lib/landing-code.ts`: default design CSS generator (built from
  the page's enabled sections), the validator/sanitizer, and the scoping transform.
- Server functions in `src/lib/landing-builder.functions.ts`: `setLandingDesignCode`
  (auth + validate + save) and `fixLandingDesignCode` (AI repair, returns corrected code
  only — never writes).
- Editor UI: `src/components/admin/landing/CodingPanel.tsx`, mounted as
  `<TabsTrigger value="coding">Coding</TabsTrigger>` + matching `TabsContent` in
  `src/routes/_authenticated/admin/landing-builder.$id.tsx`. No other tab is touched.
- Public page `src/routes/lp.$slug.tsx`: after the existing theme token style, inject a
  single `<style>` with the sanitized, scoped design CSS; page root gets a stable
  `data-lp` scope attribute and each section wrapper gets `data-lp-section="<key>"`.
  Empty/invalid code = current default look, so pages can never break.
- Preview passes draft code the same way the draft theme is already passed.
- Section markup, section editors, Order Form logic, Design, Domains and Settings remain
  exactly as they are.
