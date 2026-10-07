# Channels & AI — AI Messaging Apps (connection-based menus)

Same pattern as Marketing & Targeting Apps and Call & SMS Apps. Only the sidebar changes and one new page is added. Messenger/WhatsApp Inbox and Integration pages stay exactly as they are.

## New sidebar

```text
CHANNELS & AI
├── AI Messaging Apps        (always)
├── Messenger AI             (only when connected)
│   ├── Inbox                -> existing Messenger Inbox
│   └── Integration          -> existing Messenger AI Integration
├── WhatsApp AI              (only when connected)
│   ├── Inbox                -> existing WhatsApp Inbox
│   └── Integration          -> existing WhatsApp AI Integration
└── AI Command Center        (unchanged)
```

- The old "Omnichannel Inbox" and "Channel Setup" groups are replaced by the above.
- Handoff Queue (currently inside Omnichannel Inbox) is not in your list — it moves under AI Command Center so it is not lost.
- Unread badges on Messenger Inbox stay.

## AI Messaging Apps page
- Same look as the Marketing & Targeting Apps page.
- Two cards: Messenger AI and WhatsApp AI, each with official logo, name, one-line description, Connected / Not connected badge, and a "Connect / Setup" (or "Manage") button that opens the existing Integration page.
- No settings or fields on this page.

## What "connected" means
- Messenger AI: a Facebook Page is connected in the existing Messenger integration.
- WhatsApp AI: a WhatsApp number is connected in the existing WhatsApp integration.
- Disconnect there → its sidebar menu disappears; card shows "Not connected" again.

## Technical details
- New `src/lib/ai-messaging-apps.ts` registry (id, name, logo, description, inboxPath, integrationPath) + `useAiMessagingConnections()` reading the existing `getMessengerIntegration` / `getWhatsappIntegration` server functions (read-only, no database change).
- New route `admin/ai-messaging.apps.tsx` with its own head() metadata, reusing `MessengerMark` / `WhatsAppMark` and the marketing `StatusBadge`.
- `admin/route.tsx`: Channels & AI group built dynamically from the registry, like `providerItems` / `marketingItems`.
- Record the rule in `AGENTS.md`. Preview check; live deploy to orzen.top only when you ask.
