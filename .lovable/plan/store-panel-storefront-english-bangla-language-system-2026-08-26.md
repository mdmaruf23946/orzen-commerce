# Store Panel (Storefront) English / Bangla Language System

## What the shopper sees

- A compact **EN | বাংলা** switcher in the storefront header (and inside the mobile drawer), styled with the store's existing theme tokens — no layout or design changes anywhere else.
- Choosing a language instantly re-renders the whole storefront: home, categories, product page, cart, checkout, order tracking, returns/exchange wizard, account area, login/signup, downloads, subscriptions, AI chat labels, bottom nav and footer.
- The choice is remembered per store in the browser, and `<html lang>` updates to `en` / `bn`.

## What the merchant controls

In Merchant Panel → Settings → **Store Configuration**, a new "Storefront language" block:

- **Language switcher** on/off toggle.
- **Default language** (English / Bangla) — always applied as the starting language; when the switcher is off, it is locked and shoppers see only that language.

## Bangla quality rules

Natural, professional Bangla — not word-for-word. Kept in English inside Bangla sentences: brand/store names, product titles, plan names, and common commerce/technical terms such as Order, Delivery, Courier, Cash on Delivery, bKash, Nagad, Stripe, Email, SMS, WhatsApp, Messenger, PDF, Invoice, Download, Subscription. Numbers, prices and currency formatting stay unchanged.

## Explicitly unchanged

Design, spacing, colors, permissions, routing, business logic, product/category data entered by the merchant (owner-typed content renders exactly as typed).

## Technical notes

- Migration: add `storefront_lang_switcher boolean not null default true` and `storefront_default_lang text not null default 'en'` (check `in ('en','bn')`) to `public.stores`; mirror both in `public.store_template` so new stores inherit them; extend the `get_public_store_by_slug` jsonb builder to return both fields.
- New `src/lib/store-i18n.tsx`: `StoreLangProvider` (mounted in `src/routes/store/$slug/route.tsx` inside `StoreUIProvider`) + `useStoreT()` exposing `lang`, `setLang`, `t(key)`, `pick({en,bn})`. Initial value = store's default language; when the switcher is enabled it hydrates from `localStorage` key `orzen-store-lang:<storeId>` in an effect (SSR-safe, no hydration mismatch). When disabled, storage is ignored and `setLang` is a no-op.
- New `src/lib/store-copy.ts`: single typed dictionary of `{ en, bn }` pairs grouped by area (nav, home, product, cart, checkout, order, returns, account, auth, digital, subscription, chat, common). All hardcoded UI strings in `src/routes/store/$slug/*` and `src/components/storefront/**` are replaced with `t()` lookups; toast/validation messages included.
- New `StoreLangSwitch` component rendered in the storefront header bar and `MobileDrawer`, hidden when the merchant disabled the switcher.
- Merchant UI: extend `src/routes/_authenticated/admin/settings.configuration.tsx` (toggle + select) and its existing save server function to persist the two new columns; add the same two fields to the Owner Panel Store Template form so global defaults stay in sync.
- Route `head()` metadata, SEO/JSON-LD and server-rendered content stay as-is (language is a client-side presentation layer).
