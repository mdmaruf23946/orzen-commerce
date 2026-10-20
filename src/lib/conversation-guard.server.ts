import { detectAbuse } from "./conversation-guard";

/** True when the customer explicitly asks to talk to a person. */
export function asksForHuman(text: string): boolean {
  return /(মানুষ|এডমিন|অ্যাডমিন|অ্যাডমিন|admin|human|agent|representative|প্রতিনিধি|কল দিন|কল করুন|ফোন দিন|real person|owner|মালিক|ম্যানেজার|manager)/i.test(
    String(text ?? ""),
  );
}

const HANDOFF_ACK =
  "আপনার মেসেজটি পেয়েছি ✅ আমাদের একজন প্রতিনিধি শীঘ্রই উত্তর দেবেন। 🙏";

/**
 * Decides whether a conversation in human mode should get an AI reply.
 * - Merchant manual takeover or spam pause: stays human (AI silent), but the
 *   customer gets ONE acknowledgement so they are never left in silence.
 * - AI-made handoff (escalateToHuman) with no merchant reply for 5 min, or the
 *   customer simply asks a new question afterwards: returned to AI so no
 *   message is ever dropped.
 * Returns { resume: true } when the AI should answer, or { ack } text to send.
 */
export async function resolveHandoff(
  sb: any,
  conv: { id: string; handoff_mode?: string | null; handoff_reason?: string | null; handoff_at?: string | null },
): Promise<{ resume: boolean; ack: string | null }> {
  try {
    const reason = String(conv.handoff_reason ?? "");
    const at = conv.handoff_at ?? new Date(0).toISOString();
    const { data: outs } = await sb
      .from("ai_messages")
      .select("content,sent_by_user_id,created_at")
      .eq("conversation_id", conv.id)
      .eq("direction", "out")
      .gte("created_at", at)
      .order("created_at", { ascending: false })
      .limit(20);
    const rows = (outs ?? []) as any[];
    const merchantReplied = rows.some((r) => r.sent_by_user_id);
    const isSpam = reason.startsWith("auto_spam");
    const aiMade = !isSpam && !merchantReplied && reason !== "" && reason !== "manual";
    const ageMs = Date.now() - Date.parse(at);
    const customerAskedHuman = /request|asked for a human|wants a human|মানুষ|প্রতিনিধি/i.test(reason);
    if (aiMade && (!customerAskedHuman || ageMs > 5 * 60_000)) {
      // AI handed off on its own: give the customer back to the AI.
      await sb
        .from("ai_conversations")
        .update({ handoff_mode: "ai", handoff_reason: null, handoff_at: null })
        .eq("id", conv.id)
        .eq("handoff_mode", "human");
      return { resume: true, ack: null };
    }
    if (isSpam) return { resume: false, ack: null };
    const alreadyAcked = rows.length > 0 && rows[0].content === HANDOFF_ACK;
    return { resume: false, ack: alreadyAcked || merchantReplied ? null : HANDOFF_ACK };
  } catch {
    return { resume: false, ack: null };
  }
}

/**
 * Checks the conversation's recent customer messages. When abusive, AI is
 * paused for this conversation only (handoff_mode=human, reason auto_spam:*)
 * so the merchant sees it in the inbox / handoff queue and can return it to AI.
 * Returns true when the AI must NOT reply. Never throws.
 */
export async function guardConversation(sb: any, conversationId: string): Promise<boolean> {
  try {
    const since = new Date(Date.now() - 600_000).toISOString();
    const { data } = await sb
      .from("ai_messages")
      .select("content,created_at")
      .eq("conversation_id", conversationId)
      .eq("direction", "in")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(40);
    const verdict = detectAbuse((data ?? []) as any);
    if (!verdict.abusive) return false;
    await sb
      .from("ai_conversations")
      .update({
        handoff_mode: "human",
        handoff_reason: `auto_spam:${verdict.reason}`,
        handoff_at: new Date().toISOString(),
      })
      .eq("id", conversationId)
      .eq("handoff_mode", "ai");
    return true;
  } catch {
    return false;
  }
}
