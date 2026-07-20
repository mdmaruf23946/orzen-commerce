## Goal

Upgrade the Marketing → Facebook module from "just paste a Pixel ID" to a complete cross-device tracking pipeline: browser Pixel + server-side Conversion API, deduplicated by Event ID, with hashed user_data, a Test Event Code path, a live connection status, and a "Send Test Event" button.

## 1. Marketing settings UI — `src/routes/_authenticated/admin/marketing.tsx`

Rework the Facebook block into one card with:

- **Facebook Pixel ID** — 15–17 digit numeric; toggle: "Enable browser Pixel".
- **CAPI Access Token** — masked input; toggle: "Enable Conversion API".
- **Test Event Code** — optional (e.g. `TEST12345`); helper text: "When empty, events go to Live mode."
- **Connection status badge** — `Not configured` / `Live` / `Test Mode` / `Error: …` (derived from a status server fn).
- **Send Test Event button** — calls `sendFbTestEvent` server fn, shows the returned `events_received` from Meta.
- Client-side validation before save (regex for Pixel ID, non-empty token if CAPI enabled, test code shape).

Other channels (GA4, GTM, TikTok) untouched.

## 2. Schema + storage — `src/lib/admin.functions.ts`

Extend `marketingSchema` on the existing `stores.marketing` jsonb column (no migration needed):

```
fb_pixel_id, fb_pixel_enabled,
fb_capi_token, fb_capi_enabled,
fb_test_event_code,
enabled.fb_pixel (kept for back-compat)
```

Server-side validation in `updateMarketing`:
- Pixel ID: `/^\d{15,17}$/` when non-empty.
- Token: length 40–300 when CAPI enabled.
- Test code: `/^[A-Z0-9_-]{4,20}$/i` when non-empty.
- Plan gate via existing `assertPlan(..., "pixel")` stays.

The token is stored inside `stores.marketing` (already restricted — the public storefront RPC `get_public_store_by_slug` strips `fb_capi_token`, so it never reaches the browser).

## 3. Browser Pixel — `src/routes/store/$slug/route.tsx`

Rewrite `TrackingScripts` for FB so:
- Init only when `fb_pixel_enabled !== false` AND `fb_pixel_id` is set.
- On init, fire `PageView` with `{ eventID }` from a fresh UUID.
- Expose a small window helper `window.__fbTrack(event, params, userData)` that:
  - generates an `eventID`,
  - `fbq('track', event, params, { eventID })`,
  - POSTs the same `{event, params, userData, eventID, event_source_url}` to `/api/public/fb-capi/track` (see §5) so browser + server share the ID and Meta dedupes.
- Reads `_fbp`/`_fbc` cookies and current URL; passes them to the server call.
- If `fb_test_event_code` is present, pass it along so the server tags the CAPI event.
- Respects existing consent: if the storefront's consent flag (already used elsewhere) is `false`, skip both fbq and server calls.

## 4. Auto-tracked events — storefront wiring

Add small `useEffect`-based emitters using `window.__fbTrack`:

| Event | Where |
|---|---|
| PageView | Storefront route mount (already) |
| ViewContent | `src/routes/store/$slug/product.$productId.tsx` |
| Search | Product list page when a `?q=` query is present |
| AddToCart | `src/lib/cart.ts` addItem |
| InitiateCheckout | `src/routes/store/$slug/checkout.tsx` mount |
| AddPaymentInfo | Checkout on payment method selection |
| Purchase | `src/routes/store/$slug/order.$orderId.tsx` on first render of a paid/confirmed order (guarded by `sessionStorage` key so refresh doesn't re-fire) |
| CompleteRegistration | `src/routes/store/$slug/auth.signup.tsx` on success |

Each emits `{ value, currency: 'BDT', contents: [...], content_ids: [...] }` where relevant.

## 5. Server-side Conversion API

New public route `src/routes/api/public/fb-capi/track.ts` (POST):

- Reads `{ store_slug, event, params, userData, eventID, event_source_url, test_event_code? }`.
- Loads store via `supabaseAdmin` (server-only) to get `marketing.fb_pixel_id`, `fb_capi_token`, `fb_capi_enabled`, `fb_test_event_code`.
- Skips silently if CAPI disabled or token missing.
- Hashes `email`, `phone` (normalized: digits only, country code), `external_id` (customer id) with SHA-256.
- Adds `client_ip_address` from `x-forwarded-for` / request IP, `client_user_agent` from header, `fbp`/`fbc` from body.
- POSTs to `https://graph.facebook.com/v19.0/{PIXEL_ID}/events?access_token=…` with:
  ```
  { data: [{ event_name, event_time, event_id, event_source_url, action_source: 'website',
             user_data, custom_data }],
    test_event_code: <request-provided or stored, if any> }
  ```
- Returns `{ ok, fbtrace_id, events_received, messages }` or `{ ok:false, error }`.

Purchase is also fired server-side from the order-placement path (`src/lib/storefront.functions.ts` — `placeOrder`) using the confirmed amount + items so it lands even if the buyer closes the tab; same event_id is written into the order row (new nullable `fb_event_id` field on the order stored in existing `notes`/metadata jsonb — or via a tiny migration adding `orders.fb_event_id text`) so the browser-side Purchase, if it fires, dedupes.

## 6. Status + test-event server fns — `src/lib/admin.functions.ts`

- `getFacebookStatus()` (auth'd, owner-scoped) → `{ mode: 'off' | 'live' | 'test' | 'error', message }`. Derived from stored settings + last error captured by the test call.
- `sendFbTestEvent()` (auth'd) → server calls Graph API with a synthetic `PageView`, `test_event_code = fb_test_event_code || 'TEST_LOVABLE'`, returns Meta's `events_received` / `messages`. UI displays the raw result.

## 7. Compatibility & consent

- All browser code uses standard `fbevents.js` + `fetch` (works Chrome/Firefox/Edge/Safari/Samsung/Opera, desktop + mobile, PWA/WebView).
- `keepalive: true` on the CAPI beacon so Purchase survives navigation to the payment gateway.
- No third-party cookies required for CAPI — `_fbp`/`_fbc` are first-party.
- Existing storefront consent gate wraps every emitter.

## 8. Files touched

- `src/routes/_authenticated/admin/marketing.tsx` (redesign FB block, status + test button)
- `src/lib/admin.functions.ts` (schema, `getFacebookStatus`, `sendFbTestEvent`)
- `src/lib/fb-capi.server.ts` (new — hashing + Graph POST helper)
- `src/routes/api/public/fb-capi/track.ts` (new — browser→server bridge)
- `src/routes/store/$slug/route.tsx` (init + `window.__fbTrack`)
- `src/lib/cart.ts` (AddToCart)
- `src/routes/store/$slug/product.$productId.tsx` (ViewContent)
- `src/routes/store/$slug/index.tsx` (Search when `?q=`)
- `src/routes/store/$slug/checkout.tsx` (InitiateCheckout, AddPaymentInfo)
- `src/routes/store/$slug/order.$orderId.tsx` (Purchase browser side)
- `src/routes/store/$slug/auth.signup.tsx` (CompleteRegistration)
- `src/lib/storefront.functions.ts` (`placeOrder` fires server-side Purchase)
- Optional migration: `orders.fb_event_id text` for dedup with server-fired Purchase.

## Open question

Confirm one thing before I build: for **Purchase**, should the server fire it immediately when the order is placed (COD-style — event goes out even if the customer never returns to the thank-you page), or only after payment is marked `paid/confirmed`? Default in the plan above: fire on order placement, dedup with the browser event via `fb_event_id`.
