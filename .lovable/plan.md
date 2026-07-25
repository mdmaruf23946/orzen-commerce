## Goal

Redesign `/admin/couriers` into a professional courier management dashboard while preserving the existing `updateCouriers` save flow and every current field (`api_key`, `secret`, `base_url`, `enabled`).

## Scope

- Extends the `couriers` JSON column shape on `stores` (already a JSON blob — no schema migration).
- No changes to the sidebar, plan gating, or the `owner/couriers` global provider registry.
- Only touches: `src/lib/admin.functions.ts`, `src/routes/_authenticated/admin/couriers.tsx`, and new components under `src/components/admin/couriers/`.

## Provider Registry (frontend metadata)

New file `src/components/admin/couriers/providers.ts` defines each courier's official branding and capability flags so unsupported fields hide automatically:

```ts
{
  key, label, brandColor, logoUrl,
  supports: {
    sandbox, subCity, pickupPoint, exchange, return,
    autoParcel, autoStatus, autoTracking, autoLabel, autoSms, autoNotify,
  }
}
```

Providers: SteadFast, Pathao, RedX, Paperfly (same set as today). Logos as inline SVG components so no asset fetch.

## Data shape (per provider, saved into `stores.couriers[key]`)

Extends the existing `{ api_key, secret, base_url, enabled }` with optional fields — all backward-compatible:

- `sandbox: boolean`, `is_default: boolean`
- `shipping: { insideCity, outsideCity, subCity, cod, home, pickupPoint, return, exchange, priority }`
- `pickup: { contactName, phone, address, district, area, instructions }`
- `automation: { autoParcel, autoStatus, autoTracking, autoLabel, autoSms, autoNotify }`
- `diagnostics: { lastConnectedAt, lastStatus, lastError, lastResponse }` (updated by Test Connection)

## Server changes (`src/lib/admin.functions.ts`)

1. Expand `courierProvider` Zod schema with the optional fields above (all `.optional()` so existing rows keep working).
2. Add `testCourierConnection` server function:
   - `.middleware([requireSupabaseAuth])`, plan-gated `courier`.
   - Input: `{ key: 'steadfast' | 'pathao' | 'redx' | 'paperfly' }`.
   - Reads the store's stored credentials, does a lightweight auth ping (GET `base_url` or provider-specific balance endpoint when known; generic HEAD fallback), then writes `diagnostics` back into `stores.couriers[key]` and returns `{ ok, status, latencyMs, message }`.
   - No adapters shipped yet — this is a network reachability + auth-header ping; provider-specific adapters slot in later without UI changes.

## UI (`src/routes/_authenticated/admin/couriers.tsx`)

Replaces the current single form with a card grid built from the registry. Wrapped in `FeatureGate feature="courier"` (unchanged).

Each card (`<CourierCard/>` new component):

- Header: brand logo + name, `Verified` badge, `Connected`/`Disconnected` chip driven by `diagnostics.lastStatus`, colored accent bar in `brandColor`.
- Enable/Disable switch + Default toggle (only one default at a time — set locally when saving).
- Collapsible sections (accordion, all closed by default on mobile):
  1. **Credentials** — API Key, Secret Key, Base URL, Sandbox switch (hidden when `!supports.sandbox`), Test Connection, Save.
  2. **Shipping options** — the switches/inputs from the spec; each hidden when the provider's `supports.*` is false.
  3. **Pickup information** — contact name, phone, address, district, area, instructions.
  4. **Advanced automation** — only rendered flags the provider supports.
  5. **Diagnostics** — API status, auth status, last sync, last response (pretty JSON, collapsed), last error, Retry button (re-runs `testCourierConnection`).
- Last Connected time formatted with existing date util.

Reusable pieces under `src/components/admin/couriers/`:
- `providers.ts` (registry)
- `CourierCard.tsx`
- `CourierDiagnostics.tsx`
- `BrandBadge.tsx`

Save behavior stays the same: form-level state per card, `updateCouriers` receives the full `couriers` object (merge of all four cards) so existing rows continue to load.

## Responsive / a11y

- Grid: 1 col mobile, 2 cols `lg`, keeps existing padding.
- All toggles use existing `Switch`; sections use existing `Accordion` primitives.
- Sticky per-card Save button on mobile, inline on desktop.

## Out of scope

- Real provider SDK integrations (parcel creation, tracking sync). The automation toggles persist intent; adapters land in a follow-up.
- Any change to owner-level global courier providers page.

## Files touched

- `src/lib/admin.functions.ts` — extend schema, add `testCourierConnection`.
- `src/routes/_authenticated/admin/couriers.tsx` — full rewrite of the page body.
- `src/components/admin/couriers/providers.ts` (new)
- `src/components/admin/couriers/CourierCard.tsx` (new)
- `src/components/admin/couriers/CourierDiagnostics.tsx` (new)
- `src/components/admin/couriers/BrandBadge.tsx` (new)
