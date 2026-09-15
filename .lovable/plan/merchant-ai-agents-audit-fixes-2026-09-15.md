# Merchant AI Agents — Audit & Fixes

Merchant Panel-er Master AI Agent ar tar 9 ta sub-agent (Messenger, WhatsApp, Facebook, Sales, Order, Customer, Courier, Notification, Handoff) puro code + database porre dekha hoyeche. Kathamo thik ache — sob kaj store-wise alada, permission ar approval system o jaygamoto ache. Kintu kayekta asol somossa peyechi, ja ekhon-i ba bhobishyot-e notun merchant account-e problem korbe.

## Ja pawa gelo

**1. Notification-e bhul column (nishchit)**
Notification pathanor somoy store-er malik khoja hocche `owner_id` naame ekta field diye, kintu database-e field-tar naam `owner_user_id`. Fole "Approval needed", "Customer wants a human" jatiyo alert-gulo malik-er naam chhara jacche — panel-er bell-e thik moto na-o dekhate pare.

**2. Plan/subscription check Messenger-WhatsApp path-e nei (nishchit)**
Panel theke command dile plan check hoy, kintu Messenger/WhatsApp theke verified merchant command dile kono plan ba subscription check hoy na. Expired ba plan-e AI na thakleo agent kaj kore felbe.

**3. Master Agent off korleo channel-e chole (nishchit)**
Panel-e Master Agent off korle-o Messenger/WhatsApp theke command chalu thake — shudhu sub-agent tool gulo bondho hoy.

**4. Protita command-e 24+ obhinno database query (nishchit)**
Prottek tool toiri korar somoy alada kore "ei agent ki on?" jiggesh kora hoy — ek command-e 24+ bar. Eta reply slow kore, Messenger-e deri barae.

**5. Approval YES/NO bhul jaygay lagte pare (nishchit)**
YES/NO dhora hoy store-er sob-cheye notun pending action-er upore — thread ba channel dekha hoy na. Panel-e toiri howa approval bhul kore Messenger-er YES diye execute hoye jete pare.

**6. Rate limit sudhu store-level, identity dhora hoy na (nishchit)**
Ekjon-er 15 command-e puro store-er (sob channel + panel) command bondho hoye jay.

**7. Search text database filter bhenge dite pare (nishchit)**
Product/order/customer search-e merchant-er lekha kotha sorasori filter-e boshano hoy; comma, bracket ba quote thakle query fail kore "failed" reply ashe.

**8. Webhook-e error chupchap gile fela hoy (nishchit)**
Messenger/WhatsApp-e merchant command fail korle catch block khali — kono log, kono alert nai. Tai ekhon porjonto ekta-o activity log/thread nai, ar bujhar upay thake na ki hoyeche.

**9. Facebook channel theke command deya jay na (nishchit)**
Registry-te Facebook agent ache, tool-o ache, kintu identity verification-e sudhu Messenger/WhatsApp — Facebook diye merchant command asha somvob noy. Eta ekhon documentation-level mismatch, Page comment-er kaj thik ache.

**10. Notun merchant account (nishchit)**
Notun store-e kono AI row toiri hoy na; default-e sob agent on, permission default level — mane notun merchant-er jonno kaj kore. Kintu Agents page-e status "needs setup"/"active" defaults ar Messenger/WhatsApp connect na thaka obostha clear na hoye bhul bujhate pare.

## Ki thik kora hobe

- Notification-e sothik owner field use kora hobe; owner na pele-o notification miss hobe na.
- Messenger/WhatsApp merchant command path-e plan + subscription check jog hobe; plan-e na thakle bhodro bhasay (Bangla/English mirror kore) janabe, agent chalabe na.
- Master Agent off thakle sob channel-e-o off — ekbar-i check hobe.
- Ek command-e agent state + permission ekbar load hobe (24+ query → 2 query), reply druto hobe.
- YES/NO approval ekhon shudhu oi thread/channel theke asha pending action-er upor kaj korbe, ar kon action-er kotha bola hocche seta reply-te thakbe.
- Rate limit prokrito sender identity-wise hobe (panel, Messenger PSID, WhatsApp number alada).
- Search text sanitize kora hobe, jate kono lekha diye-o query na bhange.
- Webhook-er merchant path-er error ekhon activity log-e likhbe ebong merchant-ke "somossa hoyeche" janabe — chupchap hariye jabe na.
- Facebook-ke identity channel hisebe swikriti deya hobe na (scope-e nei); poriborte Agents page-e Facebook agent-er kaj (comment/moderation) spostho kore lekha hobe, jate bhul bojhabujhi na hoy.
- Notun merchant-er jonno: store toiri hole ekbar default agent state + permission + notification rule seed kora hobe, jate Agents page prothom dinei sothik status dekhay ebong kichu configure na korleo sob kaj kore.

## Technical notes

- `src/lib/merchant-ai/notify.server.ts`: `owner_id` → `owner_user_id`.
- `src/lib/merchant-ai/router.server.ts`: plan/subscription gate (`loadStoreWithPlan` + `hasFeature('ai_agent')`-er server-side equivalent), `isAgentEnabled('master')` gate, identity-scoped rate limit, error logging via `logActivity`.
- `src/lib/merchant-ai/core.server.ts`: `withinRateLimit` identity-wise (activity log meta ba dedicated count), `loadAgentState` ekbar load kore map pass kora, `latestPendingAction` → `pendingActionForContext(threadId/via)`, `escapeOrTerm()` helper.
- `src/lib/merchant-ai/master.server.ts`: `buildTools` state/permission map niye kaj korbe (per-tool query bondho), approval reply-te pending title/id.
- `src/lib/merchant-ai/tools.server.ts`: `.or()` filter-e sanitize kora term.
- `src/routes/api/public/messenger/webhook.ts`, `src/routes/api/public/whatsapp/webhook.ts`: merchant router-er catch block-e log + friendly reply.
- Migration: notun store-er jonno `store_ai_agent_state` / `store_ai_notification_rules` default seed trigger (existing store-gulor jonno ekbar backfill). Sob row `store_id` scoped, existing RLS `has_store_access(store_id)` obikrito thakbe. Kono table drop/rename hobe na.
- Tenant isolation: `storeId` shob somoy server context theke — model kokhono store choose korte parbe na; `assertOwnedRow` obikrito thakbe.
