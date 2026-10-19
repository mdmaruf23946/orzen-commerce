import { detectAbuse } from "./conversation-guard";

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
