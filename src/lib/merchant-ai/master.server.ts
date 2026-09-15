// Master Agent: understands a merchant command, picks the right sub-agents,
// enforces the 3-level permission system and logs every step.
import { generateText, tool, stepCountIs } from "ai";
import { z } from "zod";
import {
  addThreadMessage,
  createPendingAction,
  pendingActionForContext,
  loadAgentState,
  loadPermissions,
  logActivity,
  threadHistory,
  touchAgent,
  type Db,
} from "./core.server";

import { ACTION_BY_KEY, MERCHANT_ACTIONS } from "./registry";
import { runAction, type ActionCtx } from "./tools.server";
import { notifyMerchantEvent } from "./notify.server";

const BENGALI = /[\u0980-\u09FF]/;

function languageInstruction(text: string) {
  if (BENGALI.test(text)) return "Reply in Bengali (Bangla script).";
  if (/\b(ami|apni|koro|dekhao|koto|kore|hobe|ache)\b/i.test(text))
    return "Reply in Banglish (Bengali written with English letters).";
  return "Reply in English.";
}

const SYSTEM = `You are the Master AI Agent of an ORZEN merchant's own online store.
You are talking to the VERIFIED store owner or their authorised staff.

Rules you must never break:
- Use ONLY the data the tools return. Never invent an order, customer, price, stock number or tracking id.
- If a tool returns nothing, say plainly that nothing was found.
- You have no access to API keys, tokens, secrets or any other store's data. If asked, refuse briefly.
- Some actions need the merchant's approval. When a tool says approval is required, tell the merchant what is waiting and that they can reply YES to approve or NO to reject.
- Chain tools when a request needs several steps (find the customer, then the order, then submit to courier).
- Keep replies short, concrete and business-like. Use plain numbers and names, not tables.`;

const SCHEMAS: Record<string, z.ZodTypeAny> = {
  sales_product_search: z.object({ query: z.string().describe("name, sku or keyword") }),
  sales_product_details: z.object({ productId: z.string() }),
  sales_bestsellers: z.object({}),
  order_search: z.object({ query: z.string().describe("phone, name or invoice number") }),
  order_details: z.object({ orderId: z.string() }),
  order_today: z.object({}),
  order_create: z.object({
    customerName: z.string(),
    customerPhone: z.string(),
    address: z.string(),
    deliveryCharge: z.number().nullable(),
    items: z.array(z.object({ productId: z.string(), qty: z.number() })),
  }),
  order_update_status: z.object({ orderId: z.string(), status: z.string() }),
  order_verify: z.object({ orderId: z.string() }),
  order_cancel: z.object({ orderId: z.string() }),
  customer_search: z.object({ query: z.string() }),
  customer_details: z.object({ customerId: z.string() }),
  customer_orders: z.object({ phone: z.string() }),
  courier_ready_orders: z.object({}),
  courier_submit: z.object({
    orderId: z.string(),
    courierKey: z.string().nullable(),
    weight: z.number().nullable(),
    note: z.string().nullable(),
  }),
  courier_track: z.object({ orderId: z.string() }),
  fb_recent_comments: z.object({}),
  fb_reply_comment: z.object({ commentId: z.string(), message: z.string() }),
  fb_hide_comment: z.object({ commentId: z.string() }),
  notify_merchant: z.object({ event: z.string(), title: z.string(), body: z.string() }),
  handoff_open: z.object({ customerName: z.string(), customerPhone: z.string(), issue: z.string() }),
  handoff_close: z.object({ note: z.string().nullable() }),
};

export type MasterArgs = {
  db: Db;
  storeId: string;
  text: string;
  via: "panel" | "messenger" | "whatsapp" | "facebook";
  threadId: string;
  identityLabel?: string | null;
  /** Stable sender reference (panel user id, PSID, WhatsApp number) — rate limiting. */
  identityRef?: string | null;
  requestedBy?: string | null;
};


const YES = /^(yes|y|ok|okay|approve|approved|confirm|হ্যাঁ|হ্যা|ঠিক আছে|করো|কর|accept)\b/i;
const NO = /^(no|n|cancel|reject|rejected|না|নাহ|বাতিল|stop)\b/i;

/** Execute an approved pending action. Shared by chat YES and the panel button. */
export async function executePendingAction(db: Db, storeId: string, pendingId: string, decidedBy?: string | null) {
  const { data: pending } = await db
    .from("store_ai_pending_actions")
    .select("*")
    .eq("store_id", storeId)
    .eq("id", pendingId)
    .maybeSingle();
  if (!pending) throw new Error("Request not found.");
  if (pending.status !== "pending") throw new Error("This request was already handled.");

  const ctx: ActionCtx = { db, storeId, via: pending.requested_via ?? "panel" };
  try {
    const result = await runAction(ctx, pending.action_key, pending.payload);
    await db
      .from("store_ai_pending_actions")
      .update({
        status: "decided",
        decided_at: new Date().toISOString(),
        decided_by: decidedBy ?? null,
        result,
      })
      .eq("id", pendingId)
      .eq("store_id", storeId);
    await logActivity(db, storeId, {
      agent: pending.agent_key,
      actionKey: pending.action_key,
      message: `Approved and executed: ${pending.title}`,
      meta: { pendingId },
    });
    return { ok: true, result };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed";
    await db
      .from("store_ai_pending_actions")
      .update({ status: "failed", error: msg, decided_at: new Date().toISOString(), decided_by: decidedBy ?? null })
      .eq("id", pendingId)
      .eq("store_id", storeId);
    await logActivity(db, storeId, {
      agent: pending.agent_key,
      actionKey: pending.action_key,
      level: "error",
      message: `Execution failed: ${msg}`,
      meta: { pendingId },
    });
    throw new Error(msg);
  }
}

export async function rejectPendingAction(db: Db, storeId: string, pendingId: string, decidedBy?: string | null) {
  const { data } = await db
    .from("store_ai_pending_actions")
    .update({ status: "cancelled", decided_at: new Date().toISOString(), decided_by: decidedBy ?? null })
    .eq("store_id", storeId)
    .eq("id", pendingId)
    .eq("status", "pending")
    .select("title")
    .maybeSingle();
  if (data) {
    await logActivity(db, storeId, { message: `Rejected: ${data.title}`, actionKey: "approval_rejected" });
  }
  return { ok: true };
}

async function buildTools(args: MasterArgs, executed: string[]) {
  const { db, storeId, via } = args;
  // One read each instead of one per action — a command used to fire 24+ of these.
  const [levels, agentState] = await Promise.all([
    loadPermissions(db, storeId),
    loadAgentState(db, storeId),
  ]);
  const agentOn = (key: string) => {
    const row = agentState[key];
    return row ? !!row.enabled : true; // new stores: everything on by default
  };
  const ctx: ActionCtx = { db, storeId, via };
  const tools: Record<string, any> = {};

  for (const meta of MERCHANT_ACTIONS) {
    const level = levels[meta.key] ?? meta.defaultLevel;
    if (level === "restricted") continue;
    const schema = SCHEMAS[meta.key];
    if (!schema) continue;
    if (!agentOn(meta.agent)) continue;


    tools[meta.key] = tool({
      description: `${meta.label} — ${meta.description}`,
      inputSchema: schema,
      execute: async (input: any) => {
        try {
          if (level === "approval") {
            const id = await createPendingAction(db, storeId, {
              agent: meta.agent,
              actionKey: meta.key,
              title: meta.label,
              summary: JSON.stringify(input).slice(0, 400),
              payload: input ?? {},
              via,
              requestedBy: args.requestedBy ?? null,
            });
            executed.push(`${meta.key}:pending`);
            await logActivity(db, storeId, {
              agent: meta.agent,
              actionKey: meta.key,
              threadId: args.threadId,
              message: `Approval requested: ${meta.label}`,
              meta: { pendingId: id },
            });
            await notifyMerchantEvent(db, storeId, {
              event: "approval_needed",
              title: `Approval needed: ${meta.label}`,
              body: JSON.stringify(input).slice(0, 300),
              actionTarget: "/admin/ai/approvals",
              priority: "high",
            });
            return {
              approval_required: true,
              pending_id: id,
              message: "Waiting for the merchant to approve. Reply YES to approve or NO to reject.",
            };
          }
          const result = await runAction(ctx, meta.key, input);
          executed.push(meta.key);
          await touchAgent(db, storeId, meta.agent);
          await logActivity(db, storeId, {
            agent: meta.agent,
            actionKey: meta.key,
            threadId: args.threadId,
            message: `Ran ${meta.label}`,
            meta: { input },
          });
          return result;
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Failed";
          await touchAgent(db, storeId, meta.agent, { status: "error", last_error: msg });
          await logActivity(db, storeId, {
            agent: meta.agent,
            actionKey: meta.key,
            threadId: args.threadId,
            level: "error",
            message: `${meta.label} failed: ${msg}`,
          });
          return { error: msg };
        }
      },
    });
  }
  return tools;
}

export async function runMasterAgent(args: MasterArgs): Promise<{ reply: string; actions: string[] }> {
  const { db, storeId, text, threadId } = args;

  await addThreadMessage(db, storeId, threadId, "user", text, { via: args.via });
  await logActivity(db, storeId, {
    agent: "master",
    actionKey: "command_received",
    threadId,
    message: `Command via ${args.via}`,
    meta: { text: text.slice(0, 200) },
  });

  // YES / NO on the latest waiting approval — no model call needed.
  const pending = await latestPendingAction(db, storeId);
  if (pending && (YES.test(text.trim()) || NO.test(text.trim()))) {
    let reply: string;
    if (YES.test(text.trim())) {
      try {
        await executePendingAction(db, storeId, pending.id, args.requestedBy ?? null);
        reply = `Done — ${pending.title} has been executed.`;
      } catch (e) {
        reply = `Could not complete ${pending.title}: ${e instanceof Error ? e.message : "failed"}.`;
      }
    } else {
      await rejectPendingAction(db, storeId, pending.id, args.requestedBy ?? null);
      reply = `Cancelled — ${pending.title} was not executed.`;
    }
    await addThreadMessage(db, storeId, threadId, "assistant", reply, {});
    return { reply, actions: ["approval_decision"] };
  }

  const executed: string[] = [];
  const tools = await buildTools(args, executed);
  const history = await threadHistory(db, storeId, threadId, 12);
  const { routedModel } = await import("@/lib/ai-provider.server");
  const aiModel = await routedModel("google/gemini-3.8-flash");

  const { text: reply } = await generateText({
    model: aiModel,
    system: `${SYSTEM}\n${languageInstruction(text)}${
      args.identityLabel ? `\nYou are speaking with: ${args.identityLabel}.` : ""
    }`,
    messages: [...history.slice(-10), { role: "user" as const, content: text }],
    tools,
    stopWhen: stepCountIs(50),
  });

  const answer = reply?.trim() || "I could not produce a reply.";
  await addThreadMessage(db, storeId, threadId, "assistant", answer, { actions: executed });
  await touchAgent(db, storeId, "master");
  return { reply: answer, actions: executed };
}
