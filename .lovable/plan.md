# Landing Page Footer — Modern, Dynamic, Store-Connected

Rebuild only the public Landing Page footer (and its small editor panel), keeping Content, Order Form, Design, Domains, Settings and the section architecture untouched.

## Current state (verified)

- The footer is inline JSX at the bottom of `src/routes/lp.$slug.tsx`: a centered single column with logo, name, text, plain-text phone/email/address, text-only social links (Facebook, Instagram, YouTube, TikTok, WhatsApp), free links and a copyright line. No brand icons, no columns, hardcoded `text-neutral-*` colors instead of theme tokens.
- `normalizeContent()` in `src/lib/landing-builder.ts` already stores footer fields and the footer editor in `src/components/admin/landing/section-editors.tsx` edits them; store values are used only as fallbacks at render time.
- The public RPC `get_public_landing_page` returns only `phone, whatsapp, email, address, facebook, instagram, youtube, tiktok` from the store — it does not return `linkedin, telegram, messenger, website, business_hours, description, trade_license`, which all already exist on `stores` and are edited in Merchant Panel → Settings → Information.
- Store legal/policy pages already exist in `public.store_pages` (`page_key`, `title`, `is_published`) with a public reader; the landing footer does not use them today.

## What will change

### 1. Store data becomes the single source (no duplicate system)

- Extend the `get_public_landing_page` RPC to also return the store's `linkedin`, `telegram`, `messenger`, `website`, `business_hours`, `description`, `trade_license`, `name_logo_url`, plus the store's published policy pages (title + key) from `store_pages`.
- Landing footer resolution stays "merchant override on the landing page, otherwise the store value, otherwise hide". Nothing is duplicated: the landing page never stores its own copy unless the merchant deliberately types an override.
- Add the four missing platforms (X/Twitter, Pinterest, Snapchat, Threads) as columns on `stores` and as fields in the existing Settings → Information "Social Links" card, so they flow to both storefront and landing footer from one place.

### 2. New footer layout

New component `src/components/landing/LandingFooter.tsx` replacing the inline block:

- Responsive grid: 1 column (mobile) / 2 (tablet) / 4 (desktop).
  - Brand: icon logo + name logo or store name, short description.
  - Contact: phone, WhatsApp, email, address, website, business hours — each with a lucide icon and a real `tel:` / `mailto:` / `https://wa.me/` link.
  - Quick Links: merchant-defined footer links.
  - Policies & Support: published store pages (Privacy Policy, Terms, Return/Refund, Shipping) auto-listed, linking to the store site.
- Social row of circular brand-icon buttons with authentic glyphs and brand hover colors, reusing/extending `src/components/storefront/social-icons.tsx` (adds X, Pinterest, Snapchat, Threads glyphs).
- Bottom bar: copyright (auto-generated if unset) and trade license line when present.

### 3. Theme-driven styling

The footer uses only the existing landing design tokens (`--lp-primary`, `--lp-surface`, `--lp-text`, `--lp-muted`, `--lp-radius`, etc.) — no hardcoded neutral classes — so it follows the Design tab theme and any Coding-tab CSS via the existing `data-lp-section="footer"` hook.

### 4. Fully dynamic

Every block, column, row and icon renders only when it has a value. An empty column collapses; the grid re-balances. Nothing shows placeholders.

### 5. Editor (minimal)

The existing Footer editor keeps its fields and gains:
- A read-only "Synced from your store" summary showing which contact/social values are inherited.
- Per-field overrides continue to work as they do now (empty = use store value).

## Technical notes

- Files: `src/components/landing/LandingFooter.tsx` (new), `src/routes/lp.$slug.tsx` (swap inline footer), `src/components/storefront/social-icons.tsx` (4 new glyphs + shared brand-color map), `src/lib/landing-builder.ts` (normalize new optional override fields), `src/components/admin/landing/section-editors.tsx` (sync summary + new social overrides), `src/routes/_authenticated/admin/settings.information.tsx` (4 new social inputs).
- Migration: add `twitter`, `pinterest`, `snapchat`, `threads` to `public.stores`; replace `get_public_landing_page` with the widened version (same security-definer + grants as today).
- Verification: Playwright pass over a live landing page at 390 / 820 / 1440 px, with fields toggled empty/filled to confirm nothing empty renders.
