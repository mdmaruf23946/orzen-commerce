# Landing Page → Design phase: AI themes + color customization

Make the Design tab functional: AI-recommended color themes per product, a 5-role color customizer with automatic shade/contrast derivation, live preview, and a saved design the public landing page actually uses. Content, Order Form, Domains, Settings and the section system stay untouched.

## Current state (verified)

- The Design tab in `src/routes/_authenticated/admin/landing-builder/$id.tsx` renders only a static "Professional Landing Page" info card — no controls.
- `LandingTheme` in `src/lib/landing-builder.ts` is `{ primary, accent, dark, rounded }`, and `defaultTheme()` is hardcoded green/amber. The theme is already stored per page in the `theme` JSONB column and is already saveable via `updateLandingPage` (it accepts a `theme` patch).
- The public page `src/routes/lp.$slug.tsx` ignores the saved theme: it applies a fixed `STYLE` object (`--lp-primary: #16a34a`, `--lp-accent: #f59e0b`, `--lp-radius`). Only the browser theme-color meta reads `page.theme.primary`.
- `LandingPreviewFrame` (desktop/tablet/mobile scaled iframe) already exists and is used by the builder.

So the storage path exists; the design UI, the palette generator, and the public token wiring do not.

## What gets built

### 1. Theme model (data-driven, backward compatible)
Extend `LandingTheme` with five color roles — `primary`, `secondary`, `accent`, `background`, `text` — plus `themeId` and `themeName` for the selected preset, keeping the old `accent`/`dark`/`rounded` fields so existing pages keep working. A `normalizeTheme()` helper fills any missing role from the old values or the default palette, so every existing landing page renders unchanged.

### 2. Automatic color harmony + contrast
A new `src/lib/landing-theme.ts` (shared browser+server, no deps) takes the five roles and derives the full token set: hover, light background tint, border, muted surface, button foreground, and on-primary/on-accent text — each picked by relative-luminance contrast so text stays readable (min 4.5:1, auto-flipping to black or white). It exports `themeTokens(theme)` returning the `--lp-*` CSS variables.

### 3. AI recommended themes
A new server function `suggestLandingThemes` (in `src/lib/landing-theme.functions.ts`) calls the existing Lovable AI gateway with the linked product's title, category, description and image URLs, asking for 3–5 palettes with a name and the five hex roles. It returns JSON only — it never touches product data, content, sections, order form, domains or settings. If AI is unavailable it falls back to a small deterministic set of professional palettes seeded from the product category, so the tab is never empty.

### 4. Design tab UI
Replaces the static card with:
- **AI Recommended Themes** — 3–5 cards, each showing theme name, a miniature landing-page mock (header bar, hero block, price, CTA button) rendered with that palette, the 5 color swatches, and a Select button. A Regenerate button re-runs the AI.
- **Customize Colors** — exactly five color inputs (Primary, Secondary, Accent, Background, Text), each hex + swatch, plus a read-only "derived states" strip showing the auto-generated hover/border/light/button colors and a contrast badge (Pass / Low contrast) so the merchant sees when a pick is unreadable.
- **Live Preview** — a Preview button opening the existing `LandingPreviewFrame` with the draft colors passed as query params, so unsaved edits show immediately at desktop/tablet/mobile.
- **Save Design** — persists the theme through the existing `updateLandingPage`; nothing else in the payload changes. Persists across refresh.

### 5. Public landing page uses the saved design
`lp.$slug.tsx` swaps the hardcoded `STYLE` object for `themeTokens(normalizeTheme(page.theme))`, and in preview mode accepts the draft-color query params so the preview matches. All existing `var(--lp-primary)` / `var(--lp-radius)` usages keep working; the new tokens (background, text, secondary, border) get applied to the page shell and generic section surfaces that currently use fixed neutral classes.

### 6. AI default
When a page has no manually selected theme, the first AI-recommended palette is applied as the default on first open of the Design tab (shown as "AI default", saved only when the merchant saves or selects).

## Technical notes

- Files touched: `src/lib/landing-builder.ts` (theme type + normalize + default), new `src/lib/landing-theme.ts` (derivation/contrast), new `src/lib/landing-theme.functions.ts` (AI suggestion server fn), `src/routes/_authenticated/admin/landing-builder/$id.tsx` (Design tab only), new `src/components/admin/landing/DesignPanel.tsx`, `src/routes/lp.$slug.tsx` (token wiring), and small token usage in `src/components/landing/GenericSection.tsx`.
- No migration needed — the `theme` JSONB column already stores this shape.
- No font, spacing, layout, section or component editing is added.
- Verification: pick a theme, save, refresh, and confirm the public page at 390/820/1440 renders the saved palette with readable contrast.
