# Merchant Messenger inbound reply fix

## Diagnosis
- The connected Merchant Page `A9N Ai` is subscribed, but its inbound messages are not reaching the Merchant webhook.
- Meta is delivering Messenger events to the existing Winner Admin callback because a Meta app supports one callback URL for the Page messaging subscription.
- The current Winner Admin webhook assumes every event belongs to its own Page. Events for Merchant Pages are therefore rejected by the Winner Admin App Secret check before Merchant routing, persistence, AI generation, or reply sending.
- The sender’s profile being associated with another ORZEN store is not the cause: a non-verified sender must remain a customer of the Page they message, without gaining merchant permissions.

## Implementation
1. Add a server-side Page-ID dispatcher to the existing Messenger callback:
   - Winner Admin Page ID continues through the existing Admin/Customer Agent route unchanged.
   - A Page ID found in a connected `messenger_integrations` row is forwarded internally to the existing Merchant webhook.
   - Unknown Page IDs are safely acknowledged and ignored.
2. Preserve the original raw body and `X-Hub-Signature-256`; the Merchant webhook will verify the event against that Merchant Page’s encrypted App Secret before processing it.
3. Add an internal loop guard and return a clear retryable error if internal routing fails.
4. Keep tenant isolation intact: the Merchant webhook resolves `store_id` exclusively from the signed Page ID, while sender PSID controls customer identity only—not tenant access.
5. Make Merchant setup diagnostics accurately treat App Secret as required for secure inbound processing, without exposing any secret.

## Verification
- Run the TypeScript check.
- Verify Winner Admin Page events still use the Winner Admin agent.
- Verify an `A9N Ai` event reaches the Merchant webhook, creates an inbound conversation/message under `mdmaruf` only, invokes the customer AI path, and attempts the Graph reply.
- Confirm a sender linked to another store receives no merchant privileges and no cross-tenant data.
- Confirm invalid signatures and unknown Page IDs cannot trigger AI or data access.
