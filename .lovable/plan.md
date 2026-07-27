# Platform Branding Management System (Winner Admin)

Add a new, isolated "Platform Branding" hub to the Winner Admin. It centralizes the platform's own branding (Winner + Store Admin shells, auth pages, footer, favicon). Nothing existing is removed. Store-owner store branding, courier brand assets, and payment brand assets remain in their current pages untouched.

## Scope guardrails

- Do NOT edit: `courier-brand-assets.tsx`, `brand-assets.tsx` (payment gateways), `store-template`, store settings, or any Store Admin branding controls.
- Do NOT change existing sidebar/header component APIs — only swap the currently hard-coded logo/text source to read from the new branding config with a safe fallback to today's exact defaults.
- Every placement falls back to current behavior when unset, so unpublished/empty config leaves the UI unchanged.

## Data model

New table `public.platform_branding` (single row, `id = 'global'`), JSONB-first so we can extend without migrations:

```
id text pk default 'global'
assets jsonb        -- { primaryLogo, compactLogo, squareLogo, lightLogo, darkLogo,
                    --   primaryWordmark, lightWordmark, darkWordmark, compactWordmark,
                    --   favicon, appIcon192, appIcon512 }
                    -- each entry: { url, width, height, mime, size }
combo jsonb         -- { mode: 'logo'|'wordmark'|'both',
                    --   layout: 'left'|'top'|'centered',
                    --   align: 'start'|'center'|'end',
                    --   gap: number, logoSize, wordmarkSize }
placements jsonb    -- keyed by placement id (winner_header, store_header, sidebar,
                    --   mobile_header, website_header, customer_store, auth_login,
                    --   auth_register, auth_forgot, footer, checkout, order_confirm,
                    --   loading, invoice, email). Each: {
                    --     source: 'global'|'custom',
                    --     mode, layout, align, visible,
                    --     logo:{url,width,height}, wordmark:{...},
                    --     sizes:{ desktop, tablet, mobile },
                    --     lightAsset, darkAsset }
published_at timestamptz
updated_at timestamptz default now()
```

GRANTs: `SELECT` to `anon` + `authenticated` (branding is public), full CRUD to `service_role`. RLS: `SELECT` open; `INSERT/UPDATE` restricted to `has_role(auth.uid(),'admin')` (owner).

Public read RPC `get_platform_branding()` (SECURITY DEFINER, STABLE) returns the row so SSR/anonymous pages can read it without exposing the table directly.

Storage: reuse existing `store-assets` bucket under path `platform-branding/…`; add an authenticated-admin write policy for that prefix (public read already covered by existing policy pattern used by courier/payment brand assets).

## Server functions

New file `src/lib/platform-branding.functions.ts`:
- `getPlatformBranding()` — public GET, reads via RPC (used by shells + SSR).
- `updatePlatformBranding({ patch })` — owner-only, deep-merges into `assets`/`combo`/`placements`.
- `publishPlatformBranding()` — owner-only, stamps `published_at = now()`.
- `resetPlatformBrandingPlacement({ key })` — clears a placement override back to `source:'global'`.

All owner mutations gated by `assertOwner()` (already used elsewhere in `owner-ext.functions.ts`).

## Winner Admin UI

New route `src/routes/_authenticated/owner/platform-branding.tsx`, added to the owner sidebar under the existing Branding group (does not replace Payment/Courier brand asset pages).

Sections (accordion / tabs, mobile-friendly like existing owner pages):

1. **Global Brand Logo** — upload/replace/remove for Primary, Compact, Square, Light, Dark.
2. **Brand Name / Wordmark** — Primary, Light, Dark, Compact.
3. **Logo + Name Combination** — mode (logo / wordmark / both), layout (left / top / centered), alignment, spacing, logo/wordmark size sliders.
4. **Favicon & App Icon** — favicon (ico/png/svg), PWA 192, PWA 512.
5. **Placement Manager** — one card per placement key with `Use Global` / `Use Custom` toggle, mode selector, visibility, sizes per breakpoint, light/dark assets.
6. **Live Preview** — sandboxed mock frames for Desktop Header, Mobile Header, Sidebar (collapsed + expanded), Login, Customer Store, Footer, updating instantly from local form state.
7. **Save Changes / Publish Branding** buttons; save persists draft, publish stamps `published_at`.

Reuse existing patterns:
- `compressImage` helper for uploads.
- Upload flow mirrors `brand-assets.tsx` (Supabase storage → save returned path).
- `OwnerPageHeader` for consistent header.

Client-side validation: file type allowlist (png/jpg/webp/svg + ico for favicon), max size (2 MB logo, 512 KB favicon), reject 0-dim, preserve aspect ratio via `object-contain`.

## Consumer wiring (surgical, additive)

Introduce `src/lib/platform-branding.ts` with `useBranding(placementKey)` hook + `resolveBranding(cfg, key)` helper implementing the fallback chain:

```
custom placement → global asset → existing default
dark asset → primary asset
wordmark missing → existing plain text brand name
```

Wire consumers only where logos/brand text currently live, always keeping the existing default as the final fallback so behavior is unchanged until the owner publishes:

- `src/routes/__root.tsx` head links → favicon + apple-touch-icon from `assets.favicon` / `assets.appIcon192`.
- Winner Admin shell header (owner `route.tsx`).
- Store Admin shell header + sidebar (admin `route.tsx`).
- Auth pages: `src/routes/auth.tsx`, store `auth.login/signup/forgot`.
- Storefront header/footer (`src/components/storefront/*`) only for platform "Powered by" mark — the merchant's store logo stays as-is.
- Order confirmation + invoice pages: platform mark only (does not touch merchant invoice branding logic).

A single `<BrandMark placement="…" />` component renders the resolved logo/wordmark/combo with responsive sizing classes derived from `sizes.{desktop,tablet,mobile}` (Tailwind arbitrary values kept minimal via inline `style`).

## Fallback + safety

- If `platform_branding` row missing → hook returns null → components render today's hard-coded logo/text (zero regression).
- Images use `onError` to fall back to the next tier in the chain to prevent broken image icons.
- SSR reads via the public RPC; no auth needed.

## Non-goals this turn

- No changes to per-store branding, courier branding, payment branding, or email template HTML (email placement is stored but wired later — kept in the placement schema so future turns don't need another migration).
- No PWA manifest regeneration pipeline; `appIcon` URLs are surfaced via `<link rel="apple-touch-icon">` only.

## Deliverables checklist

- Migration: `platform_branding` table + GRANTs + RLS + `get_platform_branding()` + storage policy for `platform-branding/*`.
- `src/lib/platform-branding.functions.ts` (server fns) + `src/lib/platform-branding.ts` (hook/resolver + `<BrandMark>`).
- `src/routes/_authenticated/owner/platform-branding.tsx` (new page) + sidebar link.
- Consumer wiring in root head, owner shell, admin shell, auth pages, storefront platform mark — each behind fallback to current defaults.
