# Call & SMS Apps — provider-based menu

## What the merchant will see

```text
Customers & Support
  Call & SMS Apps
    ePBX                      -> /admin/call-sms/epbx
      (tabs inside: Overview, Calls & History, Recordings,
       Agents, Phone Numbers, Connection, Settings)
```

- The old "Call Center → AI Call Center" menu is replaced by **Call & SMS Apps**, with one sub-item per provider. Today only **ePBX**.
- The ePBX page holds exactly what the AI Call Center page has today (same panels, same behaviour). The "Provider" tab is renamed "Connection" because the page is already ePBX-only.
- The word "Messaging" is never used. SMS here means only normal mobile-number SMS. Messenger and WhatsApp stay where they are now under Channels & AI.
- Old links (`/admin/ai-call-center`, `/admin/call-center`) redirect to the ePBX page and keep the chosen tab, so bookmarks and the "Add one in AI Call Center → Agents" hint still work (the hint text changes to "Call & SMS Apps → ePBX → Agents").

## How future providers fit in

- One provider list (registry) describes each provider: id, display name, type (call / sms / both), icon, and its own page sections.
- The sidebar builds the "Call & SMS Apps" sub-menu from that list, so adding a provider later adds its own menu item with its own name and its own page. No new provider is added now.
- Each provider page only shows its own panels. ePBX panels are never shown on another provider's page, and the reverse.
- The "AI Voice Agent" tab (the older platform voice-agent feature, not part of ePBX) is kept out of the ePBX menu; it moves to a separate "AI Voice Agent" item under Call & SMS Apps so nothing is mixed into ePBX. Nothing about it changes otherwise.

## Not changing

- Any ePBX call, retry, webhook, test call, analytics, or order-verification logic.
- Database, server code, permissions data. The existing "call_center" plan feature and employee permission still control access.

## Technical details

- New `src/lib/call-sms-providers.ts`: `CALL_SMS_PROVIDERS = [{ id: "epbx", name: "ePBX", kind: "call", icon, path: "/admin/call-sms/epbx" }]` (client-safe metadata only).
- New route `src/routes/_authenticated/admin/call-sms.epbx.tsx` (with `validateSearch` tab, head meta) rendering the existing hub moved into `src/components/admin/calls/EpbxHub.tsx`; tab list without `ai`, `provider` key kept as alias for `connection`.
- New route `src/routes/_authenticated/admin/call-sms.ai-voice-agent.tsx` rendering `AiVoiceAgentPanel`.
- `ai-call-center.tsx` and `call-center.tsx` become redirects to `/admin/call-sms/epbx` (tab passed through; `tab=ai` goes to the AI Voice Agent page).
- `admin/route.tsx` sidebar: "Call & SMS Apps" group whose children are generated from `CALL_SMS_PROVIDERS` plus the AI Voice Agent item.
- `panel-sections.ts`: `call_center` section label "Call & SMS Apps", paths add `/admin/call-sms`.
- `CallButton.tsx`: update hint text only.
- Record the provider-registry rule in AGENTS.md. Verify with typecheck and a signed-in browser check (desktop and mobile); deploy to orzen.top only when you ask.
