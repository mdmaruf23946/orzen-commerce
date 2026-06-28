
## AI Sales Agent — Remaining Work

Database, server functions, gateway helper, streaming chat route, Messenger webhook, and the lazy chat widget components are already in place from the previous turn. This plan finishes the user-facing surfaces and wires the widget into the storefront. No new dependencies, no homepage perf cost.

### 1. Owner → AI Settings (`/owner/ai`)
- New route `src/routes/_authenticated/owner/ai.tsx`.
- Form (reuses `SettingsPage`-style layout): Enable toggle, Default model select (Lovable AI catalog: `google/gemini-3-flash-preview` default + a few alternates), optional Provider API key (password input, never returned in plaintext to client — show "configured" badge).
- Usage panel: total tokens, estimated cost, per-store breakdown for last 30 days from `getAiUsageStats`.
- Sidebar link added in `src/routes/_authenticated/owner/route.tsx` (Sparkles icon).

### 2. Store Admin → AI Sales Agent (`/admin/ai-agent`)
- New route `src/routes/_authenticated/admin/ai-agent.tsx` with three tabs (shadcn `Tabs`):
  - **General**: Enable, Agent Name, Welcome Message.
  - **Knowledge**: Store Info, Delivery / Return / Warranty policies, Payment Methods, Business Hours, FAQs repeater (q/a pairs).
  - **Behavior**: Language (bn/en/both), Style, Emoji toggle, Human-like toggle.
- Single `updateMyAgent` save per tab.
- Sidebar link added in `src/routes/_authenticated/admin/route.tsx` (Bot icon).

### 3. Store Admin → Messenger (`/admin/messenger`)
- New route `src/routes/_authenticated/admin/messenger.tsx`.
- Form: Page ID, Page Access Token (password), auto-generated Verify Token (shown to copy into FB app), Webhook URL display (`/api/public/messenger/webhook`).
- Connection status + Disconnect button.
- Sidebar link added (MessageSquare icon).

### 4. Storefront Chat Widget mount
- Update `src/lib/storefront.functions.ts` `getStoreBySlug` to also return `ai_agent` row (enabled, agent_name, welcome_message) — single extra query, cached with existing storeQuery `staleTime`.
- Update `src/routes/store/$slug/route.tsx` to render `<AIChatLauncher>` only when `ai_agent.enabled`. Launcher already lazy-loads `AIChatPanel`; no impact on initial paint.

### 5. Verification
- Typecheck passes (current `ai`/`@ai-sdk/react` v7/v4 alignment).
- Smoke test via Playwright: open a storefront, click chat button, send "What products do you have?", confirm streamed reply lists only that store's products.
- Confirm `/owner/ai` and `/admin/ai-agent` render and save.

### Out of scope (already covered or future)
- Full FB OAuth (phase 2 — current flow uses pasted page token).
- New npm packages.
- Changes to existing storefront queries beyond adding the agent flag.
