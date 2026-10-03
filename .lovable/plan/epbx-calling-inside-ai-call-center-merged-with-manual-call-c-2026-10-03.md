# ePBX Calling inside AI Call Center (merged with Manual Call Center)

Each store connects its own ePBX account by pasting its API token. Calling, order-confirmation calls, history and recordings all live inside the existing Merchant **AI Call Center**. The separate Manual Call Center page moves in as a tab, and none of its old call records are lost.

## What the merchant sees (AI Call Center tabs)

1. **Overview**: provider, status, balance, default caller ID, today's calls, successful, failed, pending.
2. **Calls / Call History**: one list for automated, manual and representative calls. It has search, date range, status/order/agent filters and pages. Old Manual Call Center records show here too.
3. **Recordings**: Play and Download. Files come through our server and the link is never public.
4. **Agents**: ePBX extensions, if the API provides them. If not, it shows "Agent management is controlled by the connected provider."
5. **Phone Numbers / Caller ID**: only the numbers ePBX gives you. You can pick a default.
6. **Provider**: Connect ePBX shows a token box with Test Connection and Connect. After that you see connected date, last test, account info, balance, Test and Disconnect (with a confirm step). It is only marked connected after a real successful test.
7. **Settings**: auto-call ON/OFF, delay, retries (0–3), retry gap, business hours, manual calling ON/OFF and representative transfer. You can also edit every voice message (greeting, confirm, cancel, transfer, no-answer, busy, retry) per store.
8. The **Call Customer** button on orders and customers uses the store's connected provider. That is ePBX now, or Twilio/device for stores that already set it up.

The old Manual Call Center menu item redirects to this page.

## Order confirmation call

```text
New order -> store has auto-call ON + active ePBX -> wait delay / business hours
-> ePBX call with IVR: 1 confirm, 2 cancel, 0 representative
-> ePBX event -> 1: Confirmed | 2: Cancelled | 0: stays Pending + manual call task
-> no answer / busy: retry per settings
```

## Technical details

- **Provider layer**: a `VoiceProvider` interface (testConnection, getAccount, getBalance, makeCall, makeOrderVerificationCall, getCallStatus, getCallHistory, getRecording, getNumbers, handleWebhook). Adapters are `epbx`, plus the existing `twilio` and `device`, behind a `VoiceService`. The order system only calls `createOrderVerificationCall()`.
- **Database**: one migration with GRANTs, RLS through `is_store_owner` and no anon access.
  - `voice_provider_connections`: store_id, provider, encrypted token using the existing AES-256-GCM helper, masked preview, status, account_id, default caller ID/extension, connected/tested dates, and a hashed webhook secret.
  - `voice_automation_settings` and `voice_messages`, one set per store.
  - Extend the existing `calls` table with call_type, connection id, answered_at, dtmf, recording_ref and retry_count. Rows are only added, never removed.
  - `voice_call_queue` handles delayed calls and retries. It is drained by a cron endpoint.
  - `voice_call_events` uses a unique provider event id so duplicate webhooks do nothing.
  - `voice_audit_log` stores no secrets.
- **Server**: server functions using `requireSupabaseAuth`. The store always comes from the signed-in user, never from the browser. The token is never returned to the browser and never logged. Raw provider errors are turned into friendly messages.
- **Webhook**: `/api/public/voice/epbx/$connectionToken`. It checks the per-connection secret (and a signature too, if ePBX supports one). It finds the call by provider call id, updates the call and order inside one store only, and is safe to receive twice.
- **Owner panel**: the ElevenLabs/Twilio AI Call Center stays as it is.
- **Release**: tested in preview, then the database change goes to production and orzen.top is updated with the guarded wrangler deploy (not Lovable Publish).

## Blocker

The ePBX adapter needs the real API endpoints, authentication, IVR/DTMF format and webhook format from the ePBX documentation you will send. Everything else can be built first. The ePBX parts that depend on the documentation (calling, balance, numbers, agents, recordings) get wired up once it arrives, and nothing will show fake data.
