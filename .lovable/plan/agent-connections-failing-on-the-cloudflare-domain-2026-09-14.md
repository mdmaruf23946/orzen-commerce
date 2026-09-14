# Agent connections failing on the Cloudflare domain

## What I found (verified live, just now)

The same request behaves differently on the two addresses:

| Address | Messenger webhook check | Result |
|---|---|---|
| `orzen-commerce.lovable.app` | returns the correct `403 Forbidden` | server code ran fine |
| `orzen.top` (Cloudflare) | returns `500` "This page didn't load" | server code crashed |

That request only does one thing: read the saved connection row from the
database. It crashes on `orzen.top` because the private server keys the app
needs at request time are **not available to the Cloudflare worker**:

- `SUPABASE_SERVICE_ROLE_KEY` — every admin/agent read and write
- `CREDENTIALS_ENCRYPTION_KEY` — decrypting the saved Page token / app secret
- `LOVABLE_API_KEY` — the AI replies themselves

So it is not CORS, not cookies, not OAuth, not the callback URL, and not a
duplicate connection. Sign-in works on both domains; only the private
server-side keys are missing on the Cloudflare side. This is why Messenger,
the Winner Admin agent, and every other agent connection all fail there
together, while the same account works from the Lovable URL.

Two things have to change: the app must read those values the way Cloudflare
actually provides them, and the values must exist in the Cloudflare project.

## Changes

1. **Read secrets from the Cloudflare worker binding as well as `process.env`.**
   On Cloudflare, secrets arrive as a per-request `env` object; depending on
   the compatibility settings they may never appear in `process.env`, which is
   exactly the failure above. `src/server.ts` already receives that `env` — it
   will store it once at the first request into a small shared module
   (`src/lib/server-env.ts`), and a `serverEnv(name)` helper will read
   `process.env` first, then the captured binding.

   Switch these to the helper (no behaviour change on Lovable hosting):
   - `src/integrations/supabase/client.server.ts` (service role + URL)
   - `src/integrations/supabase/auth-middleware.ts` (publishable key)
   - `src/lib/crypto/credentials.server.ts` (encryption keys)
   - the AI-agent entry points that read `LOVABLE_API_KEY`
     (`ai-admin/agent.server.ts`, `ai-admin/customer-agent.server.ts`,
     `ai-agent.server.ts`, `facebook-ai.server.ts`, landing/AI helpers)

   These two generated Supabase files normally stay untouched; the only edit
   is the environment lookup, nothing else.

2. **Stop silent 500s and say what is wrong.** Connection saving/verifying in
   the AI Admin pages will return a clear message such as "Server key
   SUPABASE_SERVICE_ROLE_KEY is missing on this deployment" instead of a blank
   crash page, so a misconfigured host is obvious immediately.

3. **A health check for the owner.** New owner-only server function plus a
   small "Deployment health" strip on the AI Admin overview page: shows, for
   the host you are currently on, whether database access, credential
   decryption and the AI service key are available — names only, never values.

4. **One canonical webhook URL.** The Messenger/WhatsApp pages will show the
   webhook URL derived from the current deployment rather than a hardcoded
   host, with the currently working URL kept as the default, so Meta keeps
   pointing at a single endpoint. No second connection, no second endpoint.

5. **Docs.** `docs/CLOUDFLARE_SETUP.md` gets the exact required secret list
   (`SUPABASE_SERVICE_ROLE_KEY`, `CREDENTIALS_ENCRYPTION_KEY`,
   `LOVABLE_API_KEY`, plus the existing Supabase URL/key variables) and the
   note that a redeploy is required after adding them.

## What you will have to do once (I cannot do it for you)

In the Cloudflare Pages project → Settings → Variables and Secrets, add the
three secrets above to **Production and Preview**, then redeploy once. The
encryption key must be the *same value* already used by the Lovable
deployment, otherwise the saved Page token cannot be decrypted and the
connection would have to be re-saved. I will tell you exactly which names to
add and how to confirm success from the new health check.

## Not changing

Existing Messenger connection, admin PSID allowlist, webhook signature
verification, agent behaviour, the Winner Admin Panel design, and the Lovable
deployment — all keep working exactly as they do today.
