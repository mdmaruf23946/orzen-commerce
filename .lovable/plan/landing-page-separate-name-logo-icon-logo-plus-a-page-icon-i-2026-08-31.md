# Landing Page: separate name-logo & icon-logo, plus a page icon in Settings

Three changes to the existing Landing Page Creator only. No new tabs, no structure/design changes.

## 1. Remove "Use store logo"

The Header and Footer logo control currently has a "Use store logo" button (empty value = pull the logo from Store Settings). That button and the automatic store-logo fallback are removed. A landing page only shows what the merchant uploads for that page.

## 2. Header + Footer: two separate logos

Each of Header and Footer gets two independent upload fields:

- **Icon logo** — the small square brand mark.
- **Name logo (wordmark)** — the image showing the store name.

Each field: preview, Upload/Change, Remove. Both optional.

Rendering on the public landing page (fixed system design):

```text
[icon] [name-logo]        -> both uploaded
[icon] Store name (text)  -> icon only
[name-logo]               -> wordmark only
Store name (text)         -> nothing uploaded
```

Icon renders at a fixed square height, wordmark at a matching height with auto width, so any combination looks balanced in both header and footer.

Existing pages: whatever single logo they have today becomes the icon logo; pages that were set to "use store logo" fall back to the store name text (or the merchant uploads a logo).

## 3. Settings tab: browser / app icon

A new "Page icon" upload in the existing Settings tab (next to SEO). Square PNG/WebP recommended 512x512.

- Used only as the browser tab favicon, apple-touch icon and app (PWA) icon for that landing page URL.
- Never rendered inside the header, footer or any page section.
- If not set, no landing-specific icon is injected.

## Technical notes

- `src/lib/landing-builder.ts`: replace `header.logo` / `footer.logo` with `iconLogo` + `nameLogo` (legacy `logo` normalized into `iconLogo`, legacy `""` -> empty); add `seo.icon` (page icon path) to the SEO shape.
- `src/components/admin/landing/section-editors.tsx`: `LogoField` becomes a plain upload/remove control (no store-logo button); Header and Footer editors each render two of them.
- `src/routes/_authenticated/admin/landing-builder.$id.tsx`: Settings tab SEO card gains a page-icon `ImageUploader` bound to `seo.icon`.
- `src/routes/lp.$slug.tsx`: header/footer render icon + wordmark combination; `head()` adds `icon` / `apple-touch-icon` links from `seo.icon` when present. Store-logo fallback removed.
- Order form, Design, Domains, publishing, delivery zones and AI generation stay untouched.
