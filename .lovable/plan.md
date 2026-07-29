## Goal

Rebuild the SteadFast / Pathao / RedX / Paperfly cards so each shows only the fields that courier's official API actually needs, in 5 short sections: Credentials → Pickup → Shipping → Actions → Diagnostics. Same card design, no extra length.

## Official credential fields per courier

**SteadFast (Packzy)** — header auth `Api-Key` + `Secret-Key`
- API Key *, Secret Key *, Base URL (default `https://portal.packzy.com/api/v1`)
- No sandbox, no sync

**Pathao Courier** — OAuth2 token issue
- Client ID *, Client Secret *, Username (email) *, Password *, Store ID *
- Base URL: live `https://api-hermes.pathao.com`, sandbox `https://courier-api-sandbox.pathao.com`
- Sandbox: yes · Sync: yes (cities / zones / areas / stores)

**RedX** — single API access token
- API Access Token *, Base URL (default `https://openapi.redx.com.bd/v1.0.0-beta`)
- No sandbox · Sync: yes (areas)

**Paperfly** — Basic auth + key header
- Username *, Password *, API Key (`paperflykey`) *, Base URL (default `https://mplog.paperfly.com.bd/api`)
- No sandbox, no sync

## Form structure (all four)

1. **Credentials** — the fields above, secrets masked with Show/Hide, plus Sandbox toggle (only if supported), Enable/Disable, Set as Default.
2. **Pickup information** — Pickup Name, Pickup Phone, Pickup Address only. District / Area / Instructions removed from these four.
3. **Shipping options** — Inside City Charge, Outside City Charge, Cash on Delivery, Home Delivery only. Sub-city / priority / pickup-point / return / exchange toggles removed; the "Advanced automation" and "Webhook" accordions are hidden for these four.
4. **Actions** — Test Connection, Save Configuration, Disconnect (clears credentials + disables after confirm), Sync Courier Information (Pathao/RedX only).
5. **Diagnostics** — Connection status chip, Last sync time, Last error (shown only when status is error).

Other couriers (eCourier, S.A. Paribahan, Sundarban) keep today's fuller card via a per-courier `profile: "simple" | "full"` flag, so nothing regresses.

## Validation & feedback

- Save blocks when any required credential is blank while the courier is Enabled; the missing field is highlighted with an inline message.
- Base URL must be a valid `https://` URL.
- Pickup phone must match a BD mobile pattern (`01XXXXXXXXX`).
- Test Connection shows a green toast with latency on success and a red toast with the courier's own error text on failure; the same message lands in Diagnostics.

## Technical notes

- `src/components/admin/couriers/providers.ts`: rewrite the four entries — official `credentialFields` (with defaults/placeholders/help), corrected `supports` flags (`sandbox` true only for Pathao; new `sync` flag for Pathao/RedX), add `profile` and `requiredPickup` metadata.
- `src/components/admin/couriers/CourierCard.tsx`: render the simple layout when `profile === "simple"` (drop automation/webhook/extra shipping/pickup fields), add Disconnect + Sync buttons and inline required-field errors.
- `src/lib/admin.functions.ts`: extend `testCourierConnection` with real per-courier auth checks — Pathao `POST /aladdin/api/v1/issue-token`, RedX `GET /areas` with `API-ACCESS-TOKEN`, SteadFast `GET /get_balance` with `Api-Key`/`Secret-Key`, Paperfly basic-auth ping — and add a `syncCourierInfo` server fn for Pathao/RedX that stores fetched city/zone/area lists plus a `lastSyncAt` in diagnostics; add `lastSyncAt` to the couriers zod schema.
- No database change required — everything lives in the existing `stores.couriers` jsonb.
