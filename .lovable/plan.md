# ePBX-only Calling Provider in AI Call Center

## Goal
Keep the existing AI Call Center and its current tabs, history, recordings, agents, settings, and call actions, while removing the legacy Device / Manual provider setup completely.

## Changes
1. **Calls & History stays intact**
   - Keep call statistics, filters, search, history rows, retry, result logging, and delete actions.
   - Remove the embedded legacy provider card from this tab.
   - Replace the old “Manual Call Center” heading and description with “Calls & History” wording.

2. **Provider becomes ePBX-only**
   - Keep the existing ORZEN card/layout style in the Provider tab.
   - Show only the ePBX API-token connection flow, connection status, account/balance details, Test Connection, Connect, and Disconnect.
   - Remove the Device / Manual selector, Caller ID / Business Number, Your Phone (rings first), Save Provider, Twilio fields, and legacy credential messaging.

3. **Remove legacy provider behavior**
   - Remove the old Device / Manual and merchant Twilio provider settings functions and client types.
   - Stop reading `call_provider_settings` when a merchant starts a call.
   - Route merchant call actions through the store-scoped ePBX connection and encrypted token instead; disconnected ePBX returns the existing connect-provider prompt.
   - Remove browser `tel:` fallback and “your phone will ring first” behavior, while preserving call creation, history refresh, result logging, and failure states.
   - Keep historical call rows readable even if their stored provider value came from the retired system.

4. **Navigation and labels**
   - Keep `/admin/call-center` as a compatibility redirect to AI Call Center → Calls & History.
   - Remove remaining merchant-facing “Manual Call Center” labels from feature and permission listings, consolidating them under AI Call Center without changing access to other sections.
   - Keep the platform-owner AI provider tools unchanged; this cleanup is limited to the merchant AI Call Center’s retired provider setup.

## Verification
- Confirm no merchant-facing Device / Manual, Caller ID / Business Number, Your Phone, Save Provider, or legacy provider selector remains.
- Test the ePBX disconnected, invalid-token, connected, test, disconnect, and call-start states.
- Confirm Calls & History, filters, retry/result flow, Recordings, Agents, Phone Numbers, Settings, and AI Voice Agent still open normally.
- Check desktop and mobile layouts, then confirm the preview build has no errors.

## Technical note
The old `call_provider_settings` table and historical data will not be destructively deleted in this change. The active merchant call path will stop using it, avoiding data loss while fully retiring its UI and logic.
