# Dual AI Agents on the existing Messenger connection

One Facebook Page, one webhook, one set of credentials — already configured. The change is a secure router inside that webhook: messages from allow-listed admin PSIDs keep going to the existing Admin AI Agent; everyone else reaches a brand-new Customer AI Agent that only knows public information.

Nothing existing is removed: the current Messenger connection page, verify token, credentials, admin agent, permissions, notifications and logs stay exactly as they are.

## What changes for people using it

**Admin (you, from Messenger)** — unchanged behaviour, plus you receive escalation alerts when a customer asks for a human, and you can reply to take over that conversation.

**Customers (anyone messaging the Page)** — today they are silently ignored. After this they get an assistant that explains the business, features, pricing/plans, how the site works, account help, FAQs and policies, all drawn from a knowledge base you control. It can never see users, orders, payments, revenue or subscriptions, and has no admin actions at all.

**Escalation** — when a customer asks for a human, or raises anything about their payment/order/subscription, the customer agent stops answering that topic, files a support request, and sends you a Messenger alert with the customer's name, ID, problem summary and reason.

## New pages in the Winner Admin Panel (AI Admin Control section)

1. **AI Agents** — two cards side by side.
   - Admin AI Agent: status, authorized admin IDs, command log link, notification state.
   - Customer AI Agent: active/inactive toggle, knowledge entry count, open handoffs, recent conversation log.
   - A shared status strip: Messenger connection, webhook state, last received message, last processed event, last error.
2. **Knowledge Base** — add/edit/delete/reorder public entries, each with a category (Business info, Features, Pricing, Plans, FAQ, How-to, Support, Contact, Policy, Other), title, body, published toggle. This is the only content the customer agent is allowed to use.
3. **Customer Support** — the handoff queue: open/answered/closed requests with customer name, ID, summary, reason, full conversation transcript, and a reply box that sends a message to that customer through the Page, plus "Return to AI" to hand the thread back.

## Technical design

### Routing (one webhook, no new endpoint)
`src/routes/api/public/ai-admin/messenger-webhook.ts` keeps signature verification, dedup and event logging as the first steps. After the PSID is extracted:
- PSID present in `ai_admin_messenger_connections.admin_psids` → existing admin path (`runAdminAgent`), untouched.
- Otherwise → new customer path. The current "Sender not allow-listed → silently stop" branch becomes the customer branch. Routing is decided only from the allow-list; message content never affects it.

### New server modules
- `src/lib/ai-admin/customer-agent.server.ts` — runs the customer agent with its own system prompt (no admin context, explicit prompt-injection guard: claims of being owner/admin are ignored and answered as a normal customer), its own language mirroring (Bengali script → Bengali), history from the customer thread, and only the customer tool set.
- `src/lib/ai-admin/customer-tools.server.ts` — the only tools the customer agent gets: `get_public_business_info`, `get_public_features`, `get_public_pricing`, `get_public_faq`, `get_help_information`, `create_support_request`, `request_human_support`. Read tools query only the knowledge base table and the public packages/pricing list; they never touch users, orders, payments, subscriptions or revenue. The admin tool registry (`tools.server.ts`) is never imported by this module, so admin tools are unreachable by construction.
- `src/lib/ai-admin/support.server.ts` — creates a handoff request, builds the summary, and notifies every admin PSID through the existing `sendAdminMessengerMessage`; admin reply/close/return-to-AI helpers.

### New tables (owner-only RLS, plus grants; service role for webhook writes)
- `ai_admin_kb_entries` — category, title, body, published, sort order.
- `ai_admin_customer_threads` — psid, display name, status (`ai` | `human` | `closed`), last message time.
- `ai_admin_customer_messages` — thread id, role (`user` | `assistant` | `admin`), content.
- `ai_admin_support_requests` — thread id, psid, customer name, reason, summary, status (`open` | `answered` | `closed`), timestamps.
- `ai_admin_settings` gains `customer_agent_enabled` (default true) and `customer_agent_model`.

Customer threads/messages stay in their own tables, fully separate from the admin `ai_admin_threads`/`ai_admin_messages`, so no admin content can ever be loaded into a customer conversation.

### Server functions
Extend `src/lib/ai-admin.functions.ts` (owner-guarded, same pattern as today) with knowledge-base CRUD, customer agent toggle, support-request list/reply/close/return-to-AI, customer conversation transcript, and an agents-overview read for the status strip. When the admin is in "human" mode on a thread, the webhook forwards the customer's messages to the admin instead of answering, until returned to AI.

### Security
Signature verification, dedup and per-sender rate limiting apply to both paths (customer path gets its own, stricter per-PSID limit). Credentials keep using the existing encryption module; no token, secret or key is ever returned to the browser. Admin actions keep logging to `ai_admin_audit_logs`; every customer escalation is logged too. Business notifications continue to go only to verified admin PSIDs.
