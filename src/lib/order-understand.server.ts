// Small AI "understanding" step for order details typed in chat.
// Runs ONLY while we are waiting for the customer's name/address/phone and the
// rule-based parser is unsure (half-written, misspelt or unusual text). It never
// guesses: low confidence → the caller asks the customer to confirm.
import { routedChatCompletion } from "@/lib/ai-provider.server";
import { checkPersonName, cleanNameValue, isLikelyAddress } from "@/lib/slot-validate";

export type OrderUnderstanding = {
  kind: "name" | "address" | "phone" | "name_and_address" | "question" | "other";
  name: string | null;
  address: string | null;
  phone: string | null;
  confidence: number;
};

const FIELD_EN: Record<string, string> = {
  customer_name: "full name",
  phone: "mobile number",
  full_address: "delivery address",
};

export async function understandOrderReply(
  text: string,
  waitingFor: string[],
): Promise<OrderUnderstanding | null> {
  const wanted = waitingFor.map((k) => FIELD_EN[k] ?? k).join(", ") || "order details";
  const system = [
    "You read ONE chat message from a Bangladeshi online-shop customer (Bangla, Banglish or English, often misspelt or half-written).",
    `The shop just asked the customer for: ${wanted}.`,
    "Decide what the message is and extract values. Fix obvious typos in your understanding but copy names/addresses as the customer wrote them.",
    "A question (e.g. about price, delivery charge, stock), greeting or product talk is NEVER a name or address.",
    'Reply with JSON only: {"kind":"name|address|phone|name_and_address|question|other","name":string|null,"address":string|null,"phone":string|null,"confidence":0..1}',
  ].join("\n");
  try {
    const raw = await routedChatCompletion({
      messages: [
        { role: "system", content: system },
        { role: "user", content: String(text ?? "").slice(0, 400) },
      ],
      jsonOnly: true,
      temperature: 0,
      maxTokens: 200,
    });
    if (!raw) return null;
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return null;
    const j = JSON.parse(m[0]) as Partial<OrderUnderstanding>;
    const kinds = ["name", "address", "phone", "name_and_address", "question", "other"];
    const out: OrderUnderstanding = {
      kind: (kinds.includes(String(j.kind)) ? j.kind : "other") as OrderUnderstanding["kind"],
      name: j.name ? cleanNameValue(String(j.name)).slice(0, 120) : null,
      address: j.address ? String(j.address).trim().slice(0, 500) : null,
      phone: j.phone ? String(j.phone).replace(/[^\d+]/g, "").slice(0, 16) : null,
      confidence: Math.max(0, Math.min(1, Number(j.confidence ?? 0) || 0)),
    };
    // The model's answer still has to pass our own checks.
    if (out.name) {
      const c = checkPersonName(out.name);
      if (!c.ok && c.hard) out.name = null;
    }
    if (out.address && !isLikelyAddress(out.address, { lenient: true })) out.address = null;
    return out;
  } catch (e) {
    console.warn("[order-understand] failed", (e as Error).message);
    return null;
  }
}
