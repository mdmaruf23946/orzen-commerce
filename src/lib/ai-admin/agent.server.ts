// AI Admin agent: natural-language admin commands -> allow-listed tool actions.
import { generateText, tool, stepCountIs } from "ai";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ACTION_BY_KEY } from "./catalog";
import { TOOLS, TOOL_BY_KEY, loadPermissions, logAction } from "./tools.server";
import { loadSettings } from "./connection.server";

export type AgentResult = { reply: string; actions: string[] };

/** Pick the reply language from the admin's own message (auto mode). */
function detectLanguageInstruction(text: string): string {
  if (/[\u0980-\u09FF]/.test(text ?? "")) {
    return "The admin wrote in Bengali script. Reply entirely in natural Bengali (বাংলা).";
  }
  return "The admin wrote in Latin script. Reply in the same language/style they used (English or Banglish).";
}

const SYSTEM = `You are the ORZEN platform AI Admin Assistant for the platform owner (Winner Admin).
You operate over WhatsApp and the admin console.

Rules:
- Understand natural language in English or Bengali.
- LANGUAGE MIRRORING (strict): if the admin's latest message contains any Bengali (Bangla) script,
  reply fully in natural Bengali — including confirmations, errors, labels and summaries. Keep product
  names, IDs, emails and numbers as-is. If the message is in Banglish (Bengali written with Latin
  letters), reply in Banglish. Otherwise reply in English. Never switch language on your own.
- CONVERSATION CONTEXT (strict): the messages above are the real, ongoing chat with this admin.
  A short reply such as "হ্যাঁ", "ঠিক আছে", "করো", "ok", "do it", "eta koro", "ta koro" always refers to
  the most recent thing YOU proposed or asked about. Resolve it from the previous turns and act on it.
  Never answer "I don't understand what you mean" when the previous turns make it resolvable.
  Only ask a clarifying question when two or more earlier items are genuinely ambiguous — and then
  list those options so the admin can pick one.
- Never invent data. Every fact must come from a tool result.
- Use tools for anything factual or for any change. You have no direct database access.
- Medium- and high-risk changes are held for confirmation automatically; when a tool returns
  { pending_confirmation: true }, tell the admin exactly what will happen and ask them to reply YES to confirm
  or NO to cancel. Do not claim the action is done.
- If a tool is unavailable it is disabled by permission settings; say so plainly.
- Keep WhatsApp replies short, structured and readable. Use plain text with line breaks, no markdown tables.
- Amounts are in BDT (৳).

HUMAN SUPPORT RELAY (important):
- Messenger customers of the platform Page can ask to talk to a human. When that happens you alert the
  admin here, and the admin answers YOU — you then speak to the customer on their behalf.
- Whenever the admin's message is meant for a waiting customer (e.g. "তাকে জিজ্ঞেস করো কেন কথা বলতে চায়",
  "বলে দাও আজ রাত ৮টায় ফ্রি আছি", "tell him we will call tomorrow"), call support_reply with a polished,
  polite, professional customer-facing message in the customer's own language — never a literal
  word-for-word copy of the admin's shorthand, and never expose that an admin dictated it.
- Use support_open_list when you are unsure who is waiting, and support_history to read what the customer
  already said before you answer. If more than one customer is waiting, ask the admin which one.
- After sending, confirm briefly to the admin what exactly you told the customer.
- When the admin says the matter is finished ("সাপোর্ট বন্ধ করো", "close it", "done"), call support_close.`;

type BuildArgs = {
  waId?: string | null;
  threadId?: string | null;
  actor: string;
  channel: "whatsapp" | "console" | "messenger";
};

/** Wrap the allow-listed action layer as AI SDK tools with permission + confirmation gating. */
async function buildTools(ctx: BuildArgs, executed: string[]) {
  const permissions = await loadPermissions(supabaseAdmin);
  const settings = await loadSettings();
  const confirmMedium = settings?.confirm_medium_risk ?? true;
  const confirmHigh = settings?.confirm_high_risk ?? true;

  const entries = TOOLS.filter((t) => permissions[t.key]).map((t) => {
    const meta = ACTION_BY_KEY[t.key];
    return [
      t.key,
      tool({
        description: `${t.description} (risk: ${t.risk})`,
        inputSchema: t.schema as z.ZodTypeAny,
        execute: async (args: any) => {
          const needsConfirm =
            (t.risk === "medium" && confirmMedium) || (t.risk === "high" && confirmHigh);
          const summary = t.summary(args);
          if (needsConfirm) {
            const { data: pending } = await supabaseAdmin
              .from("ai_admin_pending_actions")
              .insert({
                thread_id: ctx.threadId,
                wa_id: ctx.waId,
                action_key: t.key,
                args,
                summary,
                risk: t.risk,
              })
              .select("id")
              .maybeSingle();
            executed.push(`pending:${t.key}`);
            return {
              pending_confirmation: true,
              risk: t.risk,
              summary,
              pending_id: pending?.id ?? null,
              instruction:
                t.risk === "high"
                  ? "High-risk action. Ask the admin to reply CONFIRM to proceed."
                  : "Ask the admin to reply YES to proceed or NO to cancel.",
            };
          }
          try {
            const result = await t.run(supabaseAdmin, args);
            executed.push(t.key);
            await logAction(supabaseAdmin, {
              action_key: t.key,
              risk: t.risk,
              args,
              target_label: summary,
              channel: ctx.channel,
              actor: ctx.actor,
            });
            return result;
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            await logAction(supabaseAdmin, {
              action_key: t.key,
              risk: t.risk,
              args,
              result: "failed",
              result_detail: msg,
              target_label: summary,
              channel: ctx.channel,
              actor: ctx.actor,
            });
            return { error: msg };
          }
        },
      }),
      meta?.label,
    ] as const;
  });

  return Object.fromEntries(entries.map(([k, t]) => [k, t]));
}

const YES = /^(yes|y|ok|okay|confirm|approve|approved|proceed|হ্যাঁ|হ্যা|করো|কনফার্ম|ঠিক আছে)\b/i;
const NO = /^(no|n|cancel|reject|stop|না|বাতিল)\b/i;

/** Resolve a pending confirmation from a short reply. Returns null when the reply is not a decision. */
export async function resolvePendingDecision(args: {
  waId?: string | null;
  threadId?: string | null;
  text: string;
  actor: string;
  channel: "whatsapp" | "console" | "messenger";
}): Promise<string | null> {
  const text = args.text.trim();
  const isYes = YES.test(text);
  const isNo = NO.test(text);
  if (!isYes && !isNo) return null;

  let q = supabaseAdmin
    .from("ai_admin_pending_actions")
    .select("*")
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1);
  if (args.threadId) q = q.eq("thread_id", args.threadId);
  else if (args.waId) q = q.eq("wa_id", args.waId);
  const { data: pending } = await q.maybeSingle();
  if (!pending) return null;

  if (isNo) {
    await supabaseAdmin.from("ai_admin_pending_actions").update({ status: "cancelled" }).eq("id", pending.id);
    await logAction(supabaseAdmin, {
      action_key: pending.action_key,
      risk: pending.risk,
      args: pending.args,
      result: "cancelled",
      target_label: pending.summary,
      channel: args.channel,
      actor: args.actor,
    });
    return `❌ Cancelled: ${pending.summary}`;
  }

  const t = TOOL_BY_KEY[pending.action_key];
  if (!t) return "This action is no longer available.";
  const permissions = await loadPermissions(supabaseAdmin);
  if (!permissions[t.key]) {
    await supabaseAdmin.from("ai_admin_pending_actions").update({ status: "blocked" }).eq("id", pending.id);
    await logAction(supabaseAdmin, {
      action_key: t.key,
      risk: t.risk,
      args: pending.args,
      result: "blocked",
      result_detail: "Permission disabled",
      target_label: pending.summary,
      channel: args.channel,
      actor: args.actor,
    });
    return `🚫 Blocked: this action is disabled in Commands & Permissions.`;
  }

  try {
    const result = await t.run(supabaseAdmin, pending.args as any);
    await supabaseAdmin.from("ai_admin_pending_actions").update({ status: "executed" }).eq("id", pending.id);
    await logAction(supabaseAdmin, {
      action_key: t.key,
      risk: t.risk,
      args: pending.args,
      target_label: pending.summary,
      channel: args.channel,
      actor: args.actor,
    });
    return `✅ Done: ${pending.summary}\n\n${JSON.stringify(result, null, 2).slice(0, 1200)}`;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabaseAdmin.from("ai_admin_pending_actions").update({ status: "failed" }).eq("id", pending.id);
    await logAction(supabaseAdmin, {
      action_key: t.key,
      risk: t.risk,
      args: pending.args,
      result: "failed",
      result_detail: msg,
      target_label: pending.summary,
      channel: args.channel,
      actor: args.actor,
    });
    return `⚠️ Failed: ${pending.summary}\n${msg}`;
  }
}

export async function runAdminAgent(args: {
  text: string;
  history?: { role: "user" | "assistant"; content: string }[];
  waId?: string | null;
  threadId?: string | null;
  actor: string;
  channel: "whatsapp" | "console" | "messenger";
}): Promise<AgentResult> {
  const decision = await resolvePendingDecision({
    waId: args.waId,
    threadId: args.threadId,
    text: args.text,
    actor: args.actor,
    channel: args.channel,
  });
  if (decision) return { reply: decision, actions: ["confirmation"] };

  const settings = await loadSettings();
  const model = settings?.model || "google/gemini-3.8-flash";

  const executed: string[] = [];
  const tools = await buildTools(
    { waId: args.waId, threadId: args.threadId, actor: args.actor, channel: args.channel },
    executed,
  );

  const { routedModel } = await import("@/lib/ai-provider.server");
  const aiModel = await routedModel(model);
  const { text } = await generateText({
    model: aiModel,
    system:
      SYSTEM +
      (settings?.reply_language && settings.reply_language !== "auto"
        ? `\nAlways reply in ${settings.reply_language}.`
        : `\n${detectLanguageInstruction(args.text)}`),
    messages: [
      ...(args.history ?? []).slice(-10).map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: args.text },
    ],
    tools,
    stopWhen: stepCountIs(50),
  });

  return { reply: text?.trim() || "I could not produce a reply.", actions: executed };
}
