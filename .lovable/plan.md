# Landing Page themes: generate once at creation, then keep them fixed

Right now the Design tab asks the AI for fresh palettes every time it loads (and the Regenerate button asks again), so the recommended themes keep changing. New pages are also created with the fixed default green theme, not a product-matched one.

## New behaviour

1. **At landing page creation**, the AI produces a set of product-matched themes (4–5) once, using the product's name, images, description and category.
2. Those themes are **stored with the page**, and the **first one is applied immediately**, so a newly created landing page already opens in product-appropriate colors.
3. The Design tab **shows the stored themes only** — no request on open, no auto-change. The list stays identical every time the merchant returns.
4. The merchant can click any stored theme to try it; it applies to the live preview and, on Save, to the public landing page.
5. The "Regenerate" button is removed from the automatic path. It stays only as an explicit merchant action labelled clearly (Regenerate themes) that replaces the stored list once — nothing regenerates by itself.
6. Manual color customization (5 roles) keeps working exactly as today.

## Selected theme must show on the landing page

The public page already reads the saved theme tokens, so this part is about making sure the selection is actually persisted and used:
- The applied theme (including the AI default picked at creation) is written into the page's saved theme.
- Save design persists it; refresh and the public URL both render that palette.
- Verification step: create a page, note the auto-applied palette, reopen the Design tab (list unchanged), select a different theme, save, and confirm the public page renders those colors at mobile and desktop widths.

## Technical notes

- `src/lib/landing-builder.ts`: extend `LandingTheme` with `presets?: LandingThemePreset[]` and `presetsAt?: string`. Backwards compatible — old pages simply have none.
- `src/lib/landing-builder.functions.ts` (`createLandingPage`): after the product is resolved, call the existing `suggestThemes` (from `landing-theme.server.ts`) best-effort, store `presets` in the `theme` JSONB and merge the first preset's five colors + `themeId`/`themeName` into the inserted theme. On AI failure fall back to the deterministic `FALLBACK_THEMES` list, so a page never has an empty theme list.
- `src/lib/landing-theme.functions.ts`: `suggestLandingThemes` becomes an explicit-refresh call only; add a companion path that persists the returned presets back onto the page theme so a regenerate is also permanent. No call on mount.
- `src/components/admin/landing/DesignPanel.tsx`: read presets from the `theme` prop instead of `useQuery`; remove the mount-time AI effect. Add a one-time backfill for pages created before this change (pages with no stored presets get them generated once, then saved, and never again). Regenerate becomes an explicit button that overwrites the stored list.
- No schema migration — everything fits in the existing `theme` JSONB column. Content, sections, order form, domains and settings are untouched.
