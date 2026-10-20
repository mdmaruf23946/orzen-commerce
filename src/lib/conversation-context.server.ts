// Compact conversation context shared by WhatsApp and Messenger:
// last N messages + a structured memory card kept in ai_conversations.psid_profile.memory.
// Private per-conversation data only — never cached across requests.
import { generateText } from "ai";

export const WINDOW = 4;
const MAX_CHARS = 300;
const LEGACY_LIMIT = 30;

export type ConversationMemory = {
  summary?: string;
  summary_upto?: string; // created_at of the newest message folded into summary
  facts?: { language?: string; name?: string; district?: string; notes?: string };
  recent_product_ids?: string[];
};

export type ConversationContext = {
  messages: { role: "user" | "assistant"; content: string }[];
  memory: ConversationMemory;
  pending_order: Record<string, any>;
  last_order: Record<string, any> | null;
  olderExists: boolean;
  oldestInWindow: string | null;
};

const MEDIA_TYPES = ["text", "quick_reply", "postback", "audio", "image"];

function fmt(m: any) {
  const c = String(m.content ?? "");
  const body = m.message_type && m.message_type !== "text" && m.message_type !== "quick_reply" ? `[${m.message_type}] ${c}`.trim() : c;
  return body.length > MAX_CHARS ? body.slice(0, MAX_CHARS) + "…" : body;
}

export async function loadConversationContext(
  sb: any,
  opts: { conversationId: string; compact: boolean; useHistory: boolean; latestText: string },
): Promise<ConversationContext> {
  const limit = opts.compact ? WINDOW + 1 : LEGACY_LIMIT;
  const [histRes, convRes, recsRes] = await Promise.all([
    opts.useHistory
      ? sb
          .from("ai_messages")
          .select("role,content,message_type,created_at")
          .eq("conversation_id", opts.conversationId)
          .in("role", ["user", "assistant"])
          .in("message_type", MEDIA_TYPES)
          .order("created_at", { ascending: false })
          .limit(limit)
      : Promise.resolve({ data: [] }),
    sb.from("ai_conversations").select("psid_profile").eq("id", opts.conversationId).maybeSingle(),
    sb
      .from("ai_product_recommendations")
      .select("product_id")
      .eq("conversation_id", opts.conversationId)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);
  let rows: any[] = (histRes as any).data ?? [];
  const olderExists = opts.compact && rows.length > WINDOW;
  if (opts.compact) rows = rows.slice(0, WINDOW);
  const messages = rows
    .reverse()
    .map((m) => ({ role: m.role as "user" | "assistant", content: fmt(m) }))
    .filter((m) => m.content);
  const latest = opts.latestText.trim();
  const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content?.trim();
  if (latest && lastUser !== latest) messages.push({ role: "user", content: latest });

  const profile = ((convRes as any)?.data?.psid_profile ?? {}) as Record<string, any>;
  const memory: ConversationMemory = { ...(profile.memory ?? {}) };
  const ids = Array.from(
    new Set([
      ...((recsRes as any).data ?? []).map((r: any) => String(r.product_id ?? "")),
      ...(memory.recent_product_ids ?? []),
    ].filter(Boolean)),
  ).slice(0, 5) as string[];
  memory.recent_product_ids = ids;
  return {
    messages,
    memory,
    pending_order: (profile.pending_order ?? {}) as Record<string, any>,
    last_order: profile.last_order ?? null,
    olderExists,
    oldestInWindow: rows[0]?.created_at ?? null,
  };
}

export async function updateConversationMemory(sb: any, conversationId: string, patch: Partial<ConversationMemory>) {
  const { data } = await sb.from("ai_conversations").select("psid_profile").eq("id", conversationId).maybeSingle();
  const profile = { ...((data?.psid_profile ?? {}) as Record<string, any>) };
  profile.memory = { ...(profile.memory ?? {}), ...patch };
  await sb.from("ai_conversations").update({ psid_profile: profile }).eq("id", conversationId);
}

/** Render the memory card for the system prompt (compact, <≈400 tokens). */
export function memoryCard(mem: ConversationMemory | undefined | null): string {
  if (!mem) return "";
  const lines: string[] = [];
  if (mem.summary) lines.push(`Earlier in this chat: ${mem.summary.slice(0, 600)}`);
  const f = mem.facts ?? {};
  const facts = [
    f.name && `name=${f.name}`,
    f.language && `language=${f.language}`,
    f.district && `area=${f.district}`,
    f.notes && `notes=${f.notes.slice(0, 160)}`,
  ].filter(Boolean);
  if (facts.length) lines.push(`Customer facts: ${facts.join(", ")}`);
  if (mem.recent_product_ids?.length) lines.push(`Products discussed recently (ids): ${mem.recent_product_ids.join(", ")}`);
  return lines.join("\n");
}

/**
 * Fold messages that dropped out of the window into a short rolling summary.
 * Runs after the reply is sent; failures are swallowed.
 */
export async function refreshSummary(sb: any, ctx: ConversationContext, conversationId: string) {
  try {
    if (!ctx.olderExists || !ctx.oldestInWindow) return;
    const since = ctx.memory.summary_upto ?? "1970-01-01";
    if (since >= ctx.oldestInWindow) return;
    const { data } = await sb
      .from("ai_messages")
      .select("role,content,message_type,created_at")
      .eq("conversation_id", conversationId)
      .in("role", ["user", "assistant"])
      .in("message_type", MEDIA_TYPES)
      .gt("created_at", since)
      .lt("created_at", ctx.oldestInWindow)
      .order("created_at", { ascending: true })
      .limit(40);
    const rows: any[] = data ?? [];
    if (!rows.length) return;
    const transcript = rows.map((m) => `${m.role === "user" ? "Customer" : "Shop"}: ${fmt(m).slice(0, 300)}`).join("\n");
    const { routedModel } = await import("@/lib/ai-provider.server");
    const model = await routedModel("google/gemini-3.1-flash-lite");
    const { text } = await generateText({
      model,
      system:
        'Update a shop chat memory. Return ONLY JSON: {"summary": "max 3 short lines", "name": "", "language": "bn|en|banglish", "district": "", "notes": "size/budget/preferences"}. Use empty strings when unknown. Never invent facts.',
      prompt: `Previous summary: ${ctx.memory.summary ?? "(none)"}\n\nNew older messages:\n${transcript}`,
    });
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return;
    const j = JSON.parse(m[0]);
    const facts = { ...(ctx.memory.facts ?? {}) } as any;
    for (const k of ["name", "language", "district", "notes"]) if (j[k]) facts[k] = String(j[k]).slice(0, 200);
    await updateConversationMemory(sb, conversationId, {
      summary: String(j.summary ?? ctx.memory.summary ?? "").slice(0, 600),
      summary_upto: rows[rows.length - 1].created_at,
      facts,
    });
  } catch (e) {
    console.warn("[memory] summary refresh failed", (e as Error).message);
  }
}
